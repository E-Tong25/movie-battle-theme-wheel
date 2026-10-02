/* Wheel: drawing the slices and fitting the labels */
import { allGenres, runtimeChoices } from './genre-pool.js';
import { UI, ctx, state } from './shared-state.js';
import { themePipeline } from './themes.js';

/* --- CANVAS SETUP --- */

export function resizeCanvasForHDPI() {
    // Get screen pixel density ratio (Retina/4K = 2+, Standard = 1)
    const dpr = window.devicePixelRatio || 1;

    // Draw at the wheel's actual size, so a bigger wheel means more room for text
    // (not the same drawing stretched larger)
    const size = Math.round(UI.canvas.parentElement.clientWidth) || 360;
    UI.baseWidth = UI.baseHeight = size;

    // Resize the canvas internal drawing buffer to match real physical screen pixels.
    // (Setting width/height also resets the context transform, so scale() never stacks up.)
    UI.canvas.width = UI.baseWidth * dpr;
    UI.canvas.height = UI.baseHeight * dpr;

    // Display size is handled by CSS (see css/layout.css).

    // Auto-scale all vector coordinate operations to prevent layout shrinkage
    ctx.scale(dpr, dpr);
}

// Options can be plain text or { label, title }:
//   label = short name drawn on the wheel, title = full name shown when it wins
export function normalizeChoice(choice) {
    if (typeof choice === 'string') return { label: choice, title: choice };
    const title = choice.title || choice.label || '';
    return { label: choice.label || title, title };
}

/* --- LABEL FITTING --- */

// Returns { size, lines } for a label: one line if it fits, otherwise two lines,
// otherwise a truncated line with an ellipsis as a last resort.
// Does a block of text fit inside a slice? It has to fit along the slice (rim toward
// the center) AND across it: slices get narrower toward the center, so the inner end
// of the text is where it runs out of room first.
const LABEL_RIM_GAP = 25;          // text ends this far in from the rim
const LABEL_MARGIN = 0.78;         // use this share of the slice's width (breathing room on both sides)
function fitsSlice(width, halfHeight, arc, radius) {
    const outer = radius - LABEL_RIM_GAP;
    const inner = outer - width;
    if (inner < radius * 0.22) return false;                    // keep out of the crowded middle
    if (arc >= Math.PI * 0.99) return true;                     // 1-2 slices: plenty of room
    const room = inner * Math.tan(arc / 2) * LABEL_MARGIN;      // half the slice's width where the text starts
    return halfHeight <= room;
}

// How far a block of lines reaches above or below the slice's middle line (using the
// font's real letter shapes, so tall capitals and dips like "g" are counted)
function labelHalfHeight(lines, size) {
    const lh = size * 1.1, first = -((lines.length - 1) * lh) / 2;
    let reach = 0;
    lines.forEach((line, i) => {
        const m = ctx.measureText(line), y = first + i * lh;
        reach = Math.max(reach, Math.abs(y - m.actualBoundingBoxAscent), Math.abs(y + m.actualBoundingBoxDescent));
    });
    return reach + 1.5;                                          // plus the outline
}

// Returns { size, lines } for a label: one line if it fits, then two, then three,
// shrinking until it fits the slice; a truncated line as a last resort.
export function fitLabel(text, font, arc, radius) {
    const setFont = size => { ctx.font = `bold ${size}px "${font}", sans-serif`; ctx.textBaseline = 'middle'; };
    // A little larger on a bigger wheel (14px at 360px wide, up to 16px)
    const scale = Math.min(Math.max(UI.baseWidth / 360, 1), 1.15);
    const startSize = Math.round(14 * scale);
    const width = lines => Math.max(...lines.map(l => ctx.measureText(l).width));

    // 1. Single line, shrinking from the start size down to 11px
    for (let size = startSize; size >= 11; size--) {
        setFont(size);
        if (fitsSlice(width([text]), labelHalfHeight([text], size), arc, radius)) return { size, lines: [text] };
    }

    // 2. Two lines, then three, split at the word breaks that keep the longest line shortest
    const words = text.split(' ');
    const bestSplit = lineCount => {
        let best = null;
        const tryLines = lines => {
            const w = width(lines);
            if (!best || w < best.width) best = { width: w, lines };
        };
        for (let a = 1; a < words.length; a++) {
            if (lineCount === 2) tryLines([words.slice(0, a).join(' '), words.slice(a).join(' ')]);
            else for (let b = a + 1; b < words.length; b++) {
                tryLines([words.slice(0, a).join(' '), words.slice(a, b).join(' '), words.slice(b).join(' ')]);
            }
        }
        return best;
    };
    for (const lineCount of [2, 3]) {
        if (words.length < lineCount) break;
        for (let size = startSize - 1; size >= 9; size--) {
            setFont(size);
            const best = bestSplit(lineCount);
            if (fitsSlice(best.width, labelHalfHeight(best.lines, size), arc, radius)) return { size, lines: best.lines };
        }
    }

    // 3. Last resort: the smallest size that fits the slice's height, truncated to fit its length
    let size = 9;
    setFont(size);
    while (size > 6 && !fitsSlice(0, labelHalfHeight([text], size), arc, radius)) setFont(--size);
    let clipped = text;
    while (clipped.length > 1 && !fitsSlice(ctx.measureText(clipped + '…').width, labelHalfHeight([clipped], size), arc, radius)) {
        clipped = clipped.slice(0, -1);
    }
    return { size, lines: [clipped === text ? text : clipped.trimEnd() + '…'] };
}

// Slice color that never matches its neighbor where the wheel wraps around
// (the last slice sits next to the first, and the colors repeat in a cycle)
function sliceColor(i, numSegments) {
    let c = i % state.colors.length;
    if (i === numSegments - 1 && numSegments > 1 && c === 0 && state.colors.length > 2) c = 1;
    return state.colors[c];
}

export function drawWheel() {
    const numSegments = runtimeChoices.length;
    if (numSegments === 0) {
        ctx.clearRect(0, 0, UI.baseWidth, UI.baseHeight);
        if (allGenres.length) UI.result.innerText = "No options left!";
        return;
    }

    // SAFETY SEED: If colors array is missing or broken, restore it instantly
    if (typeof state.colors === 'undefined' || !state.colors || state.colors.length === 0) {
        const activeTheme = themePipeline[state.currentThemeIndex];
        state.colors = activeTheme ? [...activeTheme.palette] : ['#333', '#666'];
    }

    const arcSize = (2 * Math.PI) / numSegments;
    const radius = UI.baseWidth / 2;

    // Clear using baseline workspace sizes to account for scale changes
    ctx.clearRect(0, 0, UI.baseWidth, UI.baseHeight);

    // Grab current theme font, fall back to standard text rules if missing
    const activeFont = themePipeline[state.currentThemeIndex]?.font || 'sans-serif';
    const divider = themePipeline[state.currentThemeIndex]?.divider || { color: "rgba(15, 15, 26, 0.4)", width: 2 };
    const labelStyle = { fill: '#fff', stroke: '#000', strokeWidth: 3, ...(themePipeline[state.currentThemeIndex]?.label || {}) };

    runtimeChoices.forEach(({ label: choice }, i) => {
        const angle = i * arcSize;

        // Draw Base Slice
        ctx.beginPath();
        ctx.fillStyle = sliceColor(i, numSegments);
        ctx.moveTo(radius, radius);
        ctx.arc(radius, radius, radius, angle, angle + arcSize);
        ctx.lineTo(radius, radius);
        ctx.fill();

        // Contrast Borders to keep slices structurally clean
        ctx.strokeStyle = divider.color;
        ctx.lineWidth = divider.width;
        ctx.stroke();

        // Draw Text
        ctx.save();
        ctx.translate(radius, radius);
        ctx.rotate(angle + arcSize / 2);
        ctx.textAlign = "right";

        // High-Contrast Visibility Outline Mix
        // Label colors: white with a black outline unless the theme sets `label`
        ctx.fillStyle = labelStyle.fill;
        ctx.strokeStyle = labelStyle.stroke;
        ctx.lineWidth = labelStyle.strokeWidth;
        ctx.lineJoin = "round";

        // Fit the label (sets ctx.font to the chosen size)
        const { size, lines } = fitLabel(choice, activeFont, arcSize, radius);
        ctx.font = `bold ${size}px "${activeFont}", sans-serif`;
        ctx.textBaseline = 'middle';

        // Center one or two lines on the slice's middle line
        const lineHeight = size * 1.1;
        const firstY = -((lines.length - 1) * lineHeight) / 2;       // lines centered on the slice's middle
        lines.forEach((line, n) => {
            const y = firstY + n * lineHeight;
            // Draw outline backdrop, then lay text directly on top
            if (labelStyle.strokeWidth > 0) ctx.strokeText(line, radius - LABEL_RIM_GAP, y);
            ctx.fillText(line, radius - LABEL_RIM_GAP, y);
        });

        ctx.restore();
    });

    UI.canvas.setAttribute('aria-label', `Wheel with ${numSegments} option${numSegments === 1 ? '' : 's'}: ${runtimeChoices.map(c => c.title).join(', ')}`);
}
