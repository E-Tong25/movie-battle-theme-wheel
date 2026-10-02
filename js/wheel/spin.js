/* Wheel: spinning, the "now passing" readout, and finding the winner */
import { audioCtx, playTickSound } from '../core/sounds.js';
import { renderBench, runtimeChoices } from './genre-pool.js';
import { exclaim, openModal, setWinnerTitle } from './title-card.js';
import { UI, announce, reducedMotion, state } from './shared-state.js';
import { applyTheme, fireConfetti, playWinSound, soundKit, themePipeline } from './themes.js';

let currentRotation = 0;
export let isSpinning = false; // Stays true from the moment a spin starts until the result modal is closed
let lastTargetIndex = -1;

// How often Shift Spin may change themes (ms). Time-based so it's the same on every screen.
const SHIFT_INTERVAL_MS = 450;

function lockWheel() {
    isSpinning = true;
    UI.spinBtn.disabled = true;
    if (UI.shuffleBtn) UI.shuffleBtn.disabled = true;
    if (UI.editGenresBtn) UI.editGenresBtn.disabled = true;
}

export function unlockWheel() {
    isSpinning = false;
    UI.spinBtn.disabled = false;
    if (UI.editGenresBtn) UI.editGenresBtn.disabled = false;
    renderBench();                  // re-enables Shuffle if there's anything to shuffle
}

/* --- NOW PASSING READOUT --- */
// While spinning, the result line shows the full name under the pointer.
// Updates are capped so fast spins read as a flicker, not a blur.
const PASSING_MIN_MS = 70;
let lastPassingUpdate = 0;

function startPassingReadout() {
    state.showingPrompt = false;
    UI.result.setAttribute('aria-live', 'off');     // don't read every name aloud
    UI.result.classList.add('passing');
    UI.result.innerText = "Spinning...";
    lastPassingUpdate = 0;
}

function showPassing(index, timestamp) {
    if (timestamp - lastPassingUpdate < PASSING_MIN_MS) return;
    lastPassingUpdate = timestamp;
    const choice = runtimeChoices[index];
    if (choice) UI.result.innerText = choice.title;
}

function endPassingReadout() {
    UI.result.classList.remove('passing');
    UI.result.setAttribute('aria-live', 'polite');  // announce the winner
}

/* --- SPIN --- */

// Which slice is under the pointer (top of the wheel) at a given rotation
function segmentAtRotation(rotationDeg) {
    const numSegments = runtimeChoices.length;
    const degrees = ((rotationDeg % 360) + 360) % 360;
    return Math.floor(((360 - degrees + 270) % 360) / (360 / numSegments));
}

export function spin() {
    if (isSpinning) return;
    if (runtimeChoices.length === 0) return;

    // Unlock synth audio while we're still inside the user's click
    if (typeof audioCtx !== 'undefined' && audioCtx.state === 'suspended') audioCtx.resume();

    // --- GRAND FINALE EDGE CASE ---
    if (runtimeChoices.length === 1) {
        lockWheel();
        state.lastWinningIndex = 0;
        state.showingPrompt = false;
        UI.result.innerText = `The ultimate winner: ${exclaim(runtimeChoices[0].title)}`;

        playWinSound();
        announce('land', { winner: runtimeChoices[0].title, grandFinale: true });

        // Massive celebration blast
        fireConfetti({ particleCount: 250, spread: 100, origin: { y: 0.6 } });

        setTimeout(() => {
            setWinnerTitle('Grand winner: ', runtimeChoices[0].title, /[!?.…]$/.test(runtimeChoices[0].title) ? '' : '!');
            UI.eliminateBtn.innerText = "Reset the wheel";
            openModal();
        }, 600);

        return;
    }

    lockWheel();
    startPassingReadout();

    const isTurbo = UI.turbo.checked || reducedMotion.matches;
    const duration = isTurbo ? 1800 : 5000;

    const extraSpins = (Math.floor(Math.random() * 4) + (isTurbo ? 3 : 5)) * 360;
    // Any angle, not just whole degrees, so every slice has exactly equal odds
    const randomAngle = Math.random() * 360;
    const startRotation = currentRotation;
    const totalDistance = extraSpins + randomAngle;
    const totalTargetRotation = startRotation + totalDistance;
    const startTime = performance.now();
    let lastShiftTime = startTime;
    window.wheelMotion.spinning = true;
    announce('spin');
    const kit = soundKit();
    if (kit && kit.spinStart) kit.spinStart(duration);

    // The wheel is rotated by this loop every frame (no CSS transition),
    // so the ticks, pointer bounce and theme shifts line up with what you see.
    UI.canvas.style.transition = 'none';

    function animate(timestamp) {
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 4); // quartic ease-out: fast start, long slow finish
        const currentPos = startRotation + totalDistance * easeProgress;

        UI.canvas.style.transform = `rotate(${currentPos}deg)`;
        // Derivative of the easing curve = how fast the wheel is turning right now
        window.wheelMotion.velocity = 4 * Math.pow(1 - progress, 3) * totalDistance / duration;

        const segmentTrackIndex = segmentAtRotation(currentPos);
        if (segmentTrackIndex !== lastTargetIndex) {
            lastTargetIndex = segmentTrackIndex;

            // 1. Play audio click
            const tickKit = soundKit();
            if (tickKit && tickKit.tick) tickKit.tick();
            else if (typeof playTickSound === 'function') playTickSound();

            // 2. Show the full name of the slice passing under the pointer
            showPassing(segmentTrackIndex, timestamp);

            // 3. Pointer physical bounce
            UI.pointer.classList.add('tick');
            setTimeout(() => UI.pointer.classList.remove('tick'), 40);
        }

        // DIMENSION SHIFT: change theme on a steady timer while spinning
        if (UI.shift.checked && progress < 1 && timestamp - lastShiftTime >= SHIFT_INTERVAL_MS) {
            lastShiftTime = timestamp;
            state.currentThemeIndex = (state.currentThemeIndex + 1) % themePipeline.length;
            applyTheme(); // Redraw colors and fonts live
        }

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            currentRotation = totalTargetRotation;
            UI.canvas.style.transform = `rotate(${currentRotation}deg)`;
            window.wheelMotion.spinning = false;
            window.wheelMotion.velocity = 0;
            calculateWinner(); // wheel stays locked until the modal is closed
        }
    }

    requestAnimationFrame(animate);
}

function calculateWinner() {
    state.lastWinningIndex = segmentAtRotation(currentRotation);

    const winnerText = runtimeChoices[state.lastWinningIndex].title;
    endPassingReadout();
    UI.result.innerText = `Winner: ${exclaim(winnerText)}`;

    playWinSound();
    announce('land', { winner: winnerText });

    // Fire confetti blast
    fireConfetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });

    setTimeout(() => {
        setWinnerTitle('Winner: ', winnerText, /[!?.…]$/.test(winnerText) ? '' : '!');
        UI.eliminateBtn.innerText = "Just remove it from the wheel";
        openModal();
    }, 1200);
}
