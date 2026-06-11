// Your text options array
const themes = [
    "Blah",
    "Thank",
    "Daddy",
    "I"
];

// Theme Palette A
const cyberpunkColors = ['#ff007f', '#00f0ff', '#7000ff', '#ff00ff', '#00ff66', '#960018', '#120136', '#03001e'];

// Theme Palette B
const cinemaColors = ['#800020', '#d4af37', '#1c1c1c', '#aa7c11', '#4a0e17', '#fdf6e2', '#3a3a3a', '#b8860b'];

// NEW: Theme Palette C (Grayscale Film Noir)
const noirColors = ['#1a1a1a', '#ffffff', '#333333', '#dddddd', '#222222', '#aaaaaa', '#0a0a0a', '#eeeeee'];

// Theme Palette D (Hacker / Matrix)
const arcadeOverdriveColors = ['#00FF00', '#003300', '#00AA00', '#0D0D0D', '#1A1A1A', '#005f00', '#00ff88', '#101010'];

// NEW: Theme Palette E (Gory Horror Void)
const horrorColors = ['#800000', '#1a0000', '#4a0000', '#0d0d0d', '#660000', '#1f0000', '#000000', '#330000'];

// This is the active pointer your wheel code reads.
// We set it to cyberpunk by default to match your starting HTML stylesheet!
let colors = [...cyberpunkColors];
