/* Wheel: the six themes, and switching between them */
import { playSelectionSound, soundKits } from '../core/sounds.js';
import { drawWheel } from './drawing.js';
import { arcadeOverdriveColors, cinemaColors, cyberpunkColors, fantasyColors, horrorColors, noirColors } from './genres-and-colors.js';
import { UI, state } from './shared-state.js';

       // is the result line showing the theme's prompt (not a winner or readout)?

// Keep track of our theme rotation order.
// `music` is the looping background track while the wheel waits to be spun (see js/features/music.js).
// `prompt` is the line under the title while the wheel is waiting to be spun.
export const themePipeline = [
    { name: 'Cyberpunk', prompt: 'Initiate spin sequence.', css: 'css/theme-cyberpunk.css', music: 'audio/music/cyberpunk.mp3', palette: cyberpunkColors, font: 'Orbitron', winSound: 'audio/cyberpunk-win.mp3' },
    // TODO: replace audio/cinema-win.mp3 with a new Cinema win sound when you find one.
    // To add a drumroll or projector clicks too, see SOUND KITS at the bottom of js/core/sounds.js.
    { name: 'Cinema', prompt: 'Lights. Camera. Spin.', css: 'css/theme-cinema.css', music: 'audio/music/cinema.mp3',    palette: cinemaColors,    font: 'Cinzel', winSound: 'audio/cinema-win.mp3',
      divider: { color: 'rgba(212, 175, 55, 0.8)', width: 1 } },   // thin gold trim between slices
    { name: 'Noir', prompt: 'Take your chances, pal.', css: 'css/theme-noir.css', music: 'audio/music/noir.mp3',      palette: noirColors,      font: 'Special Elite' },
    { name: 'Arcade', prompt: 'Insert coin to spin', css: 'css/theme-arcade.css', music: 'audio/music/arcade.mp3',    palette: arcadeOverdriveColors, font: 'Press Start 2P', winSound: 'audio/arcade-win.mp3' },
    { name: 'Horror', prompt: 'Spin… if you dare.', css: 'css/theme-horror.css', music: 'audio/music/horror.mp3',    palette: horrorColors,    font: 'Creepster' },
    // TODO: Fantasy has no win sound yet (it uses the synth fanfare). Add winSound: 'audio/your-file.mp3'
    { name: 'Fantasy', prompt: 'Summon the wheel of fate.', css: 'css/theme-fantasy.css', music: 'audio/music/fantasy.mp3', palette: fantasyColors, font: 'Uncial Antiqua',
      divider: { color: 'rgba(226, 184, 87, 0.75)', width: 1 },
      label: { fill: '#3a1f6e', stroke: 'rgba(255, 255, 255, 0.7)', strokeWidth: 2 } }   // dark ink on pastel slices
];

// Win sounds are loaded once at startup so they play instantly
const winSounds = {};
themePipeline.forEach(theme => {
    if (theme.winSound) {
        const audio = new Audio(theme.winSound);
        audio.preload = 'auto';
        winSounds[theme.css] = audio;
    }
});

/* --- SMALL HELPERS --- */

// Confetti comes from a CDN; if it fails to load, skip the effect instead of crashing
export function fireConfetti(options) {
    if (typeof confetti === 'function') confetti(options);
}

// Win sound: theme mp3 if it has one, otherwise the synth fanfare from js/core/sounds.js
// The current theme's sound kit from js/core/sounds.js, if it has one
export function soundKit() {
    const name = themePipeline[state.currentThemeIndex]?.sound;
    return (name && soundKits && soundKits[name]) || null;
}

export function playWinSound() {
    const kit = soundKit();
    if (kit && kit.win) { kit.win(); return; }
    const activeTheme = themePipeline[state.currentThemeIndex];
    const sound = activeTheme && winSounds[activeTheme.css];
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(() => { /* blocked until the page is clicked; the synth fallback is fine */ });
    } else if (typeof playSelectionSound === 'function') {
        playSelectionSound('arcade_levelup');
    }
}

// Canvas text doesn't redraw itself when a web font finishes downloading,
// so load every theme's font up front and redraw as each one arrives.
export function preloadFonts() {
    if (!document.fonts) return;
    themePipeline.forEach(theme => {
        document.fonts.load(`bold 15px "${theme.font}"`)
            .then(() => { if (themePipeline[state.currentThemeIndex].font === theme.font) drawWheel(); })
            .catch(() => {});
    });
}

// Activate the current theme's stylesheet (all are already loaded) and palette
export function applyTheme() {
    // Stop any sound that belongs to the theme we're leaving (e.g. Cinema's drumroll)
    Object.values(soundKits || {}).forEach(kit => kit.stop && kit.stop());
    const activeTheme = themePipeline[state.currentThemeIndex];
    UI.themeSheets.forEach(sheet => {
        const file = sheet.getAttribute('href') || sheet.dataset.href;
        sheet.media = file === activeTheme.css ? 'all' : 'not all';
    });
    state.colors = [...activeTheme.palette];
    if (UI.themeSelect) UI.themeSelect.value = String(state.currentThemeIndex);   // keep the menu in sync (Shift Spin)
    if (state.showingPrompt) UI.result.innerText = activeTheme.prompt || UI.result.innerText;
    // the theme's name from its stylesheet: 'css/theme-arcade.css' -> 'arcade'
    document.body.dataset.theme = activeTheme.css.match(/theme-([a-z0-9-]+)\.css$/)[1];
    drawWheel();
}

// Theme menu: one entry per theme in themePipeline
export function buildThemeMenu() {
    if (!UI.themeSelect) return;
    themePipeline.forEach((theme, i) => {
        const option = document.createElement('option');
        option.value = String(i);
        option.textContent = theme.name;
        UI.themeSelect.appendChild(option);
    });
    UI.themeSelect.addEventListener('change', () => {
        state.currentThemeIndex = Number(UI.themeSelect.value);
        applyTheme();
    });
}

// Step to the next theme (kept for Shift Spin-style cycling and old links)
function toggleGlobalTheme() {
    state.currentThemeIndex = (state.currentThemeIndex + 1) % themePipeline.length;
    applyTheme();
}
