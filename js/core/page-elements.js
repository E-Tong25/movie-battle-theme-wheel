/* Small helpers for building page elements. Text always goes in as text, never as
   HTML, so nothing a person types can turn into code on the page. */

export const $ = id => document.getElementById(id);

// el('p', 'class-name', 'text')
export const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
};

// ---------- Small DOM helper: h('div', {class: 'x'}, 'text', child) ----------
export function h(tag, props = {}, ...children) {
    const e = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
        if (v === undefined || v === null || v === false) return;
        if (k === 'class') e.className = v;
        else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
        else if (k in e && k !== 'list') e[k] = v;
        else e.setAttribute(k, v === true ? '' : v);
    });
    children.flat().forEach(c => {
        if (c === null || c === undefined || c === false) return;
        e.append(c instanceof Node ? c : document.createTextNode(String(c)));   // text, never HTML
    });
    return e;
}
