/* --- SPIN THE WHEEL CORE ENGINE --- */

// Centralized DOM Registry Cache
const UI = {
    canvas: document.getElementById('wheel'),
    spinBtn: document.getElementById('spinBtn'),
    result: document.getElementById('result'),
    pointer: document.getElementById('pointer'),
    modal: document.getElementById('eliminationModal'),
    winner: document.getElementById('modalWinner'),
    turbo: document.getElementById('turboToggle'),
    shift: document.getElementById('shiftToggle'), // Tracking for the shift toggle element
    // Baseline CSS dimensions for vector tracking calculations
    baseWidth: 360,
    baseHeight: 360
};

const ctx = UI.canvas.getContext('2d');

let runtimeChoices = [];
let currentRotation = 0;
let isSpinning = false;
let lastTargetIndex = -1;
let lastWinningIndex = -1;

// Keep track of our theme rotation order
const themePipeline = [
    { css: 'theme-cyberpunk.css', palette: cyberpunkColors, font: 'Orbitron', winSound: 'audio/cyberpunk-win.mp3' },
    { css: 'theme-cinema.css',    palette: cinemaColors,    font: 'Cinzel', winSound: 'audio/cinema-win.mp3' },
    { css: 'theme-noir.css',      palette: noirColors,      font: 'Special Elite' }, // Safely removed property without breaking syntax
    { css: 'theme-arcade.css',    palette: arcadeOverdriveColors, font: 'Press Start 2P', winSound: 'audio/arcade-win.mp3' },
    { css: 'theme-horror.css',    palette: horrorColors,    font: 'Creepster' }      // Safely removed property without breaking syntax
];

let currentThemeIndex = 0;

function resizeCanvasForHDPI() {
    // Get screen pixel density ratio (Retina/4K = 2+, Standard = 1)
    const dpr = window.devicePixelRatio || 1;

    // Resize the canvas internal drawing buffer to match real physical screen pixels
    UI.canvas.width = UI.baseWidth * dpr;
    UI.canvas.height = UI.baseHeight * dpr;

    // Pin visible display boundaries down to our CSS sizing rules
    UI.canvas.style.width = `${UI.baseWidth}px`;
    UI.canvas.style.height = `${UI.baseHeight}px`;

    // Auto-scale all vector coordinate operations to prevent layout shrinkage
    ctx.scale(dpr, dpr);
}

function setupWheel() {
    if (typeof themes !== 'undefined' && runtimeChoices.length === 0) {
        runtimeChoices = [...themes];
    } else if (runtimeChoices.length === 0) {
        runtimeChoices = ["Sci-Fi", "Fantasy", "Action", "Horror", "Comedy", "Drama", "Superhero", "Indie"];
    }

    // Compute crisp screen boundaries before firing vectors
    resizeCanvasForHDPI();
    drawWheel();
}

function drawWheel() {
    const numSegments = runtimeChoices.length;
    if (numSegments === 0) {
        ctx.clearRect(0, 0, UI.baseWidth, UI.baseHeight);
        UI.result.innerText = "No options left!";
        return;
    }

    // FIXED / SAFETY SEED: If colors array is missing or broken during a shift landing, restore it instantly
    if (typeof colors === 'undefined' || !colors || colors.length === 0) {
        const activeTheme = themePipeline[currentThemeIndex];
        colors = activeTheme ? [...activeTheme.palette] : ['#333', '#666'];
    }

    const arcSize = (2 * Math.PI) / numSegments;
    const radius = UI.baseWidth / 2;

    // Clear using baseline workspace sizes to account for scale changes
    ctx.clearRect(0, 0, UI.baseWidth, UI.baseHeight);

    // Grab current theme font, fall back to standard text rules if missing
    const activeFont = themePipeline[currentThemeIndex]?.font || 'sans-serif';

    runtimeChoices.forEach((choice, i) => {
        const angle = i * arcSize;

        // Draw Base Slice
        ctx.beginPath();
        ctx.fillStyle = colors[i % colors.length];
        ctx.moveTo(radius, radius);
        ctx.arc(radius, radius, radius, angle, angle + arcSize);
        ctx.lineTo(radius, radius);
        ctx.fill();

        // Contrast Borders to keep slices structurally clean
        ctx.strokeStyle = "rgba(15, 15, 26, 0.4)";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw Text
        ctx.save();
        ctx.translate(radius, radius);
        ctx.rotate(angle + arcSize / 2);
        ctx.textAlign = "right";

        // High-Contrast Visibility Outline Mix
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";

        // Dynamic High-Fidelity Font Scaler Engine
        let maxFontWidth = radius - 45;
        let optimalFontSize = 15;
        ctx.font = `bold ${optimalFontSize}px "${activeFont}", sans-serif`;

        while (ctx.measureText(choice).width > maxFontWidth && optimalFontSize > 9) {
            optimalFontSize -= 1;
            ctx.font = `bold ${optimalFontSize}px "${activeFont}", sans-serif`;
        }

        // Draw outline backdrop, then lay text directly on top
        ctx.strokeText(choice, radius - 25, optimalFontSize * 0.3);
        ctx.fillText(choice, radius - 25, optimalFontSize * 0.3);

        ctx.restore();
    });
}

function spin() {
    if (isSpinning || runtimeChoices.length <= 1) return;

    isSpinning = true;
    let tickCount = 0; // Local counter to track how many segments pass the pointer
    UI.spinBtn.disabled = true;
    UI.result.innerText = "Spinning...";

    const isTurbo = UI.turbo.checked;
    const duration = isTurbo ? 1800 : 5000;

    const extraSpins = (Math.floor(Math.random() * 4) + (isTurbo ? 3 : 5)) * 360;
    const randomAngle = Math.floor(Math.random() * 360);
    const totalTargetRotation = currentRotation + extraSpins + randomAngle;

    const startRotation = currentRotation;
    const totalDistance = extraSpins + randomAngle;
    const startTime = performance.now();

    UI.canvas.style.transition = `transform ${duration}ms cubic-bezier(0.1, 0.8, 0.25, 1)`;

    function trackTicks(timestamp) {
        const elapsed = timestamp - startTime;
        if (elapsed < duration) {
            const progress = elapsed / duration;
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const currentPos = startRotation + (totalDistance * easeProgress);

            const numSegments = runtimeChoices.length;
            const currentDegrees = currentPos % 360;
            const segmentTrackIndex = Math.floor((360 - currentDegrees + 270) % 360 / (360 / numSegments));

            if (segmentTrackIndex !== lastTargetIndex) {
                lastTargetIndex = segmentTrackIndex;

                // 1. Play audio click
                playTickSound();

                // 2. CHECK IF THE DIMENSION SHIFT TOGGLE IS ON
                if (UI.shift.checked) {
                    tickCount++;

                    // Paced theme shifts: updates layout every 3 ticks instead of every single one
                    if (tickCount % 3 === 0) {
                        currentThemeIndex = (currentThemeIndex + 1) % themePipeline.length;
                        const activeTheme = themePipeline[currentThemeIndex];

                        document.getElementById('globalTheme').setAttribute('href', activeTheme.css);
                        colors = [...activeTheme.palette];
                        drawWheel(); // Redraw colors and fonts live
                    }
                }

                // 3. Pointer physical bounce
                UI.pointer.classList.add('tick');
                setTimeout(() => UI.pointer.classList.remove('tick'), 40);
            }

            requestAnimationFrame(trackTicks);
        }
    }

    requestAnimationFrame(trackTicks);
    currentRotation = totalTargetRotation;
    UI.canvas.style.transform = `rotate(${currentRotation}deg)`;

    setTimeout(() => {
        isSpinning = false;
        UI.spinBtn.disabled = false;
        calculateWinner();
    }, duration);
}

function calculateWinner() {
    const numSegments = runtimeChoices.length;
    const actualDegrees = currentRotation % 360;
    lastWinningIndex = Math.floor((360 - actualDegrees + 270) % 360 / (360 / numSegments));

    const winnerText = runtimeChoices[lastWinningIndex];
    UI.result.innerText = `🎉 ${winnerText}! 🎉`;

    // --- DYNAMIC THEME AUDIO ENGINE ---
    // 1. Get the active theme based on where the index left off
    const activeTheme = themePipeline[currentThemeIndex];

    if (activeTheme && activeTheme.winSound) {
        // 2. Create a temporary Audio object using the theme's specific sound file
        const dynamicWinSound = new Audio(activeTheme.winSound);
        dynamicWinSound.currentTime = 0;
        dynamicWinSound.play().catch(err => console.log("Audio playback blocked by browser."));
    } else {
        // Fallback sound just in case a theme config is missing its sound
        playSelectionSound('arcade_levelup');
    }

    // Fire confetti blast
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });

    setTimeout(() => {
        UI.winner.innerText = `🎉 Winner: ${winnerText}! 🎉`;
        UI.modal.style.display = "flex";
    }, 1200);
}

function toggleGlobalTheme() {
    currentThemeIndex = (currentThemeIndex + 1) % themePipeline.length;
    const activeTheme = themePipeline[currentThemeIndex];

    // 1. Swap active visual layout stylesheet
    document.getElementById('globalTheme').setAttribute('href', activeTheme.css);

    // 2. FIXED: Safely explicitly mirror array color configurations over to global pointer
    colors = [...activeTheme.palette];

    // Redraw wheel instantly with upgraded resolution properties
    drawWheel();
}

function eliminateOption() {
    if (lastWinningIndex > -1) {
        runtimeChoices.splice(lastWinningIndex, 1);
        lastWinningIndex = -1;
        setupWheel();
    }
    closeModal();
}

function closeModal() {
    UI.modal.style.display = "none";
}

// Kickstart baseline setup loop
setupWheel();
