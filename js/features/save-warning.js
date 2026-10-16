/* A persistent warning, separate from short-lived Undo messages. */
import { h } from '../core/page-elements.js';
import { retryStorage, storageIssues } from '../core/saved-data.js';

const text = h('span', { class: 'save-warning-text', role: 'alert' });
const retry = h('button', { type: 'button', onclick: async () => {
    retry.disabled = true;
    try { await retryStorage(); } finally { retry.disabled = false; }
} }, 'Retry saving');
const backup = h('button', { type: 'button', onclick: () => window.dispatchEvent(new CustomEvent('backup:request')) }, 'Download backup');
const warning = h('aside', { class: 'save-warning', 'aria-label': 'Saving status', hidden: true }, text, retry, backup);
document.body.append(warning);
function update() {
    const issues = storageIssues();
    warning.hidden = !issues.length;
    retry.hidden = !issues.some(issue => issue.retryable);
    text.textContent = [...new Set(issues.map(issue => issue.message))].join(' ');
}
window.addEventListener('storage:changed', update);
update();
