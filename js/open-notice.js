/* Shows the "open with Open Movie Battle.command" notice only if the app didn't start, which is
   what happens when index.html is opened by double-clicking it: browsers block
   JavaScript modules on pages opened straight from files. (This is a plain script,
   not a module, so it still runs in that case.) */
document.addEventListener('DOMContentLoaded', () => {
    if (location.protocol !== 'file:') return;
    if (document.documentElement.dataset.appStarted) return;     // it started (e.g. the single-file preview)
    const note = document.getElementById('openNotice');
    if (note) note.hidden = false;
});
