/* Wheel: keyboard, resizing, buttons, and start-up */
import { BattleLog } from '../features/battle-log.js';
import { GenreEditor } from '../features/genre-editor.js';
import { Welcome } from '../features/welcome-walkthrough.js';
import { BattleNight } from '../battle-night/page.js';
import { drawWheel, resizeCanvasForHDPI } from './drawing.js';
import { initGenres, shuffleWheel } from './genre-pool.js';
import { closeModal, eliminateOption } from './title-card.js';
import { spin } from './spin.js';
import { UI } from './shared-state.js';
import { applyTheme, buildThemeMenu, preloadFonts } from './themes.js';

/* --- KEYBOARD CONTROLS --- */
// Space / Enter spins, Escape closes the result popup (same as "Nah, spin again")
document.addEventListener('keydown', (e) => {
    if (BattleLog && BattleLog.isOpen()) return;   // the side panels handle their own keys
    if (GenreEditor && GenreEditor.isOpen()) return;
    if (BattleNight && BattleNight.isOpen()) return;
    if (Welcome && Welcome.isOpen()) return;
    const modalOpen = UI.modal.style.display === "flex";

    if (modalOpen) {
        if (e.key === 'Escape') closeModal();
        return;
    }

    // Buttons and switches already handle Space/Enter themselves
    const onControl = e.target.closest && e.target.closest('button, input, label');
    if ((e.key === ' ' || e.key === 'Enter') && !onControl) {
        e.preventDefault();
        spin();
    }
});

// Redraw at the new size whenever the wheel is resized
let lastWheelSize = 0;
new ResizeObserver(() => {
    const size = Math.round(UI.canvas.parentElement.clientWidth);
    if (size && size !== lastWheelSize) {
        lastWheelSize = size;
        resizeCanvasForHDPI();
        drawWheel();
    }
}).observe(UI.canvas.parentElement);

if (UI.shuffleBtn) UI.shuffleBtn.addEventListener('click', shuffleWheel);
UI.spinBtn.addEventListener('click', () => spin());
UI.keepBtn.addEventListener('click', () => closeModal());
UI.eliminateBtn.addEventListener('click', () => eliminateOption({ undoable: true }));

// Kickstart baseline setup loop
buildThemeMenu();
applyTheme();
preloadFonts();
initGenres();
