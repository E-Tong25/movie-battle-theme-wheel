/* Wheel: page elements, the drawing context, and shared state */
import { cyberpunkColors } from './genres-and-colors.js';

/* --- SPIN THE WHEEL CORE ENGINE --- */

// Centralized DOM Registry Cache
export const UI = {
    canvas: document.getElementById('wheel'),
    spinBtn: document.getElementById('spinBtn'),
    result: document.getElementById('result'),
    pointer: document.getElementById('pointer'),
    modal: document.getElementById('eliminationModal'),
    winner: document.getElementById('modalWinner'),
    turbo: document.getElementById('turboToggle'),
    shift: document.getElementById('shiftToggle'), // Tracking for the shift toggle element
    // Theme stylesheets: <link> tags normally, or inline <style> tags in the single-file preview
    themeSheets: document.querySelectorAll('.theme-sheet'),
    themeSelect: document.getElementById('themeSelect'),
    eliminateBtn: document.getElementById('eliminateBtn'),
    keepBtn: document.getElementById('keepBtn'),
    scheduleBtn: document.getElementById('scheduleBtn'),
    benchInfo: document.getElementById('benchInfo'),
    shuffleBtn: document.getElementById('shuffleBtn'),
    editGenresBtn: document.getElementById('editGenresBtn'),
    // Drawing size in CSS pixels; updated to the wheel's real on-screen size
    baseWidth: 360,
    baseHeight: 360
};

export const ctx = UI.canvas.getContext('2d');

// Values that several wheel files change live on one shared object
// (a module can read another module's variables, but not reassign them)
export const state = {
    lastWinningIndex: -1,          // the slice that just won (-1: none)
    showingPrompt: true,           // is the result line showing the theme's prompt (not a winner or readout)?
    currentThemeIndex: 0,          // the active theme (index into themePipeline)
    colors: [...cyberpunkColors]   // the active theme's slice colours
};

// Live wheel state for visual effects (the lighting in lighting/ reads this every frame)
//   velocity: current spin speed in degrees per millisecond
window.wheelMotion = { spinning: false, velocity: 0 };

// Tell visual effects what just happened: 'spin', 'land', 'closed'
export function announce(eventName, detail = {}) {
    window.dispatchEvent(new CustomEvent(`wheel:${eventName}`, { detail }));
}

// Respect the "reduce motion" accessibility setting with a shorter spin
export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
