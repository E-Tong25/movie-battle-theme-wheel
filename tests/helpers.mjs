/* Tiny DOM adapter for testing application handlers without a browser dependency. */
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export class Element {
    constructor(tag = 'div', props = {}, ...children) {
        this.tag = tag; this.children = []; this.listeners = new Map(); this.attributes = {};
        this.className = ''; this.hidden = false; this.disabled = false; this.value = ''; this.style = {}; this.dataset = {};
        this.classList = { add() {}, remove() {}, toggle() {}, contains: x => this.className.split(' ').includes(x) };
        for (const [key, value] of Object.entries(props)) {
            if (key.startsWith('on')) this.addEventListener(key.slice(2), value);
            else if (key === 'class') this.className = value;
            else { this[key] = value; this.attributes[key] = value; }
        }
        this.append(...children);
    }
    append(...children) { this.children.push(...children.flat().filter(x => x !== null && x !== undefined && x !== false)); }
    appendChild(child) { this.append(child); return child; }
    set textContent(value) { this.children = []; this._text = String(value); }
    get textContent() { return (this._text || '') + this.children.map(x => x?.textContent ?? String(x)).join(''); }
    addEventListener(name, handler) { this.listeners.set(name, [...(this.listeners.get(name) || []), handler]); }
    async emit(name, event = {}) { for (const fn of this.listeners.get(name) || []) await fn({ target: this, currentTarget: this, preventDefault() {}, ...event }); }
    setAttribute(key, value) { this.attributes[key] = value; }
    getAttribute(key) { return this.attributes[key]; }
    querySelectorAll(selector) {
        const nodes = this.children.filter(x => x instanceof Element).flatMap(x => [x, ...x.querySelectorAll('*')]);
        if (selector === '*') return nodes;
        return nodes.filter(x => selector.startsWith('.') ? x.className.split(' ').includes(selector.slice(1)) : x.tag === selector);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    reset() {} focus() {} scrollIntoView() {} click() { return this.emit('click'); } remove() {}
}
export const all = node => [node, ...node.querySelectorAll('*')];
export function storage(initial = {}) {
    const data = new Map(Object.entries(initial));
    return { data, blocked: false,
        getItem(key) { if (this.blocked) throw Error('blocked'); return data.get(key) ?? null; },
        setItem(key, value) { if (this.blocked) throw Error('quota'); data.set(key, String(value)); },
        removeItem(key) { if (this.blocked) throw Error('blocked'); data.delete(key); }
    };
}
export async function app({ saved = storage(), clock = 1800000000000, actualLog = false, confirm = () => true } = {}) {
    const elements = new Map();
    const document = { activeElement: null, body: new Element('body'),
        getElementById(id) { if (!elements.has(id)) elements.set(id, new Element('div', { id })); return elements.get(id); },
        createElement(tag) { return new Element(tag); }, addEventListener() {}, contains: () => true };
    let time = clock;
    class Clock extends Date { constructor(...args) { super(...(args.length ? args : [time])); } static now() { return time; } }
    const window = new EventTarget();
    Object.assign(window, { matchMedia: () => ({ matches: true }), crypto: globalThis.crypto });
    const downloads = [];
    const context = vm.createContext({ console: { warn() {} }, window, document, localStorage: saved, Date: Clock,
        CustomEvent, URL: class extends URL { static createObjectURL(blob) { downloads.push(blob); return 'blob:test'; } static revokeObjectURL() {} },
        Blob, crypto: globalThis.crypto, setTimeout: () => 0, clearTimeout() {}, requestAnimationFrame: fn => fn(), confirm });
    const cache = new Map();
    const h = (tag, props, ...children) => new Element(tag, props, ...children);
    const stubs = {
        'js/core/page-elements.js': { h, el: (tag, cls, text) => new Element(tag, { class: cls }, text), $: id => document.getElementById(id) },
        'js/features/messages.js': { Toast: { show() {} } },
        'js/battle-night/page.js': { render() {}, tick() {}, close() {}, updateBenchButton() {} },
        'js/battle-night/movie-art.js': { dress() {} },
        'js/battle-night/movie-picker.js': { posterEl: () => new Element('span') },
        'js/wheel/genres-and-colors.js': { themes: [] },
        'js/wheel/genre-pool.js': { MovieBattle: { genres: () => [{ id: 'a', title: 'Action', label: 'Action' }, { id: 'b', title: 'Comedy', label: 'Comedy' }], favorUnplayed: () => true, async updateGenres() {} } }
    };
    if (!actualLog) stubs['js/features/battle-log.js'] = { BattleLog: { players: () => ({ a: 'A', b: 'B' }), async addBattle(entry) { return entry.id; } } };
    async function get(relative) {
        if (cache.has(relative)) return cache.get(relative);
        let module;
        if (stubs[relative]) {
            const values = stubs[relative];
            module = new vm.SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context, identifier: relative });
        } else module = new vm.SourceTextModule(await readFile(path.join(root, relative), 'utf8'), { context, identifier: relative });
        cache.set(relative, module);
        return module;
    }
    async function load(relative) {
        const module = await get(relative);
        if (module.status === 'unlinked') await module.link((specifier, parent) => get(path.posix.normalize(path.posix.join(path.posix.dirname(parent.identifier), specifier))));
        if (module.status === 'linked') await module.evaluate();
        return module.namespace;
    }
    return { load, saved, window, document, elements, downloads, setTime(value) { time = value; } };
}
