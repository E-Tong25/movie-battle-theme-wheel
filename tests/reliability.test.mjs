import test from 'node:test';
import assert from 'node:assert/strict';
import { app, storage, Element, all } from './helpers.mjs';
import { normalizeNight, prepareBackup, normalizeLog, normalizeGenres } from '../js/core/data-validation.js';
const HOUR = 3600000, MIN = 60000, T = 1800000000000;
const plain = x => JSON.parse(JSON.stringify(x));
const battle = { id: 'b1', date: '2026-10-15', theme: 'Music', movieA: 'A', movieB: 'B', winner: 'a', createdAt: T };

async function nightApp(deadline = 'extend', ahead = 2 * HOUR) {
    const a = await app();
    const state = await a.load('js/battle-night/shared-state.js');
    const actions = await a.load('js/battle-night/actions.js');
    const rules = await a.load('js/battle-night/rules.js');
    await actions.startNight('Music');
    await actions.propose(T + ahead, deadline);
    state.proto.viewAs = 'b';
    await actions.accept();
    return { ...a, ...state, actions, rules };
}
function lock(a, same = false) {
    for (const side of ['a', 'b']) Object.assign(a.S.night.players[side], { pick: same ? 'Same Movie' : side, lockedAt: T });
}

test('short-notice battles do not forfeit; reveal waits for both picks', async () => {
    for (const policy of ['extend', 'forfeit']) {
        const a = await nightApp(policy, 15 * MIN);
        assert.equal(a.S.night.quickStart, true);
        await a.rules.resolveMoments();
        assert.equal(a.S.night.forfeit, null);
        assert.equal(a.rules.phase(), 'countdown');
        lock(a);
        await a.rules.resolveMoments();
        assert.equal(a.rules.phase(), 'reveal');
        a.setTime(T + 16 * MIN);
        assert.equal(a.rules.phase(), 'judging');
    }
});

test('quick-start also waits for picks after the nominal start', async () => {
    const a = await nightApp('forfeit', 15 * MIN);
    a.setTime(T + HOUR);
    await a.rules.resolveMoments();
    assert.equal(a.rules.phase(), 'countdown');
    assert.equal(a.S.night.forfeit, null);
    lock(a); await a.rules.resolveMoments();
    assert.equal(a.rules.phase(), 'judging');
});

test('exactly one hour ahead uses quick-start; ordinary battles retain their reveal', async () => {
    assert.equal((await nightApp('forfeit', HOUR)).S.night.quickStart, true);
    const a = await nightApp(); lock(a);
    assert.equal(a.S.night.quickStart, false);
    assert.equal(a.rules.phase(), 'countdown');
    a.setTime(T + HOUR); await a.rules.resolveMoments();
    assert.equal(a.rules.phase(), 'reveal');
});

test('scheduled deadlines honor instant forfeits and the full 30-minute extension', async () => {
    const instant = await nightApp('forfeit');
    instant.setTime(T + HOUR); await instant.rules.resolveMoments();
    assert.equal(instant.rules.phase(), 'forfeit');
    const extended = await nightApp();
    extended.setTime(T + HOUR); await extended.rules.resolveMoments();
    assert.equal(extended.S.night.extendedUntil, T + HOUR + 30 * MIN);
    assert.equal(extended.S.night.forfeit, null);
    extended.setTime(T + HOUR + 29 * MIN); await extended.rules.resolveMoments();
    assert.equal(extended.S.night.forfeit, null);
    extended.setTime(T + HOUR + 30 * MIN); await extended.rules.resolveMoments();
    assert.equal(extended.rules.phase(), 'forfeit');
});

test('reopening after an entire extension has elapsed resolves immediately', async () => {
    const a = await nightApp(); a.setTime(T + 2 * HOUR);
    await a.rules.resolveMoments();
    assert.equal(a.rules.phase(), 'forfeit');
});

test('same-movie checks still apply during quick-start', async () => {
    const a = await nightApp('extend', 15 * MIN); lock(a, true);
    await a.rules.resolveMoments();
    assert.equal(a.rules.phase(), 'same');
});

test('judges get separate drafts; submitted scores cannot be resubmitted', async () => {
    const a = await nightApp(); lock(a); a.proto.viewAs = 'a';
    const { renderJudging } = await a.load('js/battle-night/verdict.js');
    let main = new Element(); renderJudging(main);
    for (const group of main.querySelectorAll('.score-buttons')) await group.children[4].emit('click');
    const submit = all(main).find(x => x.tag === 'button' && x.textContent === 'Submit my scores');
    await submit.click();
    const submitted = plain(a.S.night.judging.a);
    a.proto.viewAs = 'b'; main = new Element(); renderJudging(main);
    assert.equal(main.querySelectorAll('.score-btn').filter(x => x.getAttribute('aria-checked') === 'true').length, 0);
    assert.equal(all(main).find(x => x.tag === 'button' && x.textContent === 'Submit my scores').disabled, true);
    for (const group of main.querySelectorAll('.score-buttons')) await group.children[0].emit('click');
    await all(main).find(x => x.tag === 'button' && x.textContent === 'Submit my scores').click();
    assert.deepEqual(plain(a.S.night.judging.a), submitted);
    assert.equal(a.S.night.judging.b.scores.a.fit, 1);
    await submit.click();
    assert.deepEqual(plain(a.S.night.judging.a), submitted);
});

test('unfinished draft scores survive a fresh application instance', async () => {
    const a = await nightApp(); lock(a); a.proto.viewAs = 'a';
    const { renderJudging } = await a.load('js/battle-night/verdict.js');
    const main = new Element(); renderJudging(main);
    await main.querySelectorAll('.score-buttons')[0].children[3].emit('click');
    const fresh = await app({ saved: a.saved });
    const loaded = await (await fresh.load('js/core/saved-data.js')).NightStore.load();
    assert.equal(loaded.draftScores.a.a.fit, 4);
    assert.equal(loaded.draftScores.b.a.fit, undefined);
});

test('failed saves retain current state and retry the latest edit', async () => {
    const a = await app(); const stores = await a.load('js/core/saved-data.js');
    a.saved.blocked = true;
    assert.equal(await stores.NightStore.save({ value: 1 }), false);
    assert.equal(await stores.NightStore.save({ value: 2 }), false);
    assert.equal((await stores.NightStore.load()).value, 2);
    assert.equal(stores.storageIssues().some(x => x.retryable), true);
    a.saved.blocked = false;
    assert.equal(await stores.retryStorage(), true);
    assert.equal(JSON.parse(a.saved.data.get('movieBattle.night.v1')).value, 2);
    assert.equal(stores.storageIssues().length, 0);
});

test('failed clears retry removal rather than resurrecting a battle', async () => {
    const a = await nightApp(); const stores = await a.load('js/core/saved-data.js');
    a.saved.blocked = true; assert.equal(await stores.NightStore.clear(), false);
    assert.equal(await stores.NightStore.load(), null);
    a.saved.blocked = false; await stores.retryStorage();
    assert.equal(a.saved.data.has('movieBattle.night.v1'), false);
});

test('bad dates and unrelated or unsupported backups are rejected', () => {
    for (const date of [123, {}, '2026-02-30', 'not-a-date']) assert.throws(() => prepareBackup({ battles: [{ ...battle, date }] }));
    for (const value of [null, {}, { battles: 'wrong' }, { version: 9, battles: [] }, { backupVersion: 9, battles: [] }]) assert.throws(() => prepareBackup(value));
    const prepared = prepareBackup({ battles: [battle, { ...battle, id: 'bad', date: 123 }] });
    assert.equal(prepared.skipped, 1);
    assert.equal(prepared.log.battles.length, 1);
});

test('legacy arrays and logs remain supported; duplicate IDs do not duplicate records', () => {
    assert.equal(prepareBackup([battle]).log.battles.length, 1);
    assert.equal(prepareBackup({ version: 1, battles: [battle, battle] }).log.battles.length, 1);
});

test('invalid night data is rejected before any part of a backup is applied', () => {
    assert.throws(() => prepareBackup({ battles: [battle], night: { status: 'scheduled' } }));
    assert.throws(() => normalizeNight([]));
    const genres = normalizeGenres({ genres: [{ id: 'x', title: 'A' }, { id: 'x', title: 'B' }] }).genres;
    assert.notEqual(genres[0].id, genres[1].id);
});

test('malformed saved data cannot poison the log on reload; raw recovery is retained', async () => {
    const initial = JSON.stringify({ version: 1, battles: [battle, { ...battle, id: 'bad', date: 123 }] });
    const a = await app({ saved: storage({ 'movieBattle.log.v1': initial, 'movieBattle.night.v1': '{broken' }) });
    const stores = await a.load('js/core/saved-data.js');
    assert.equal((await stores.BattleStore.load()).battles.length, 1);
    assert.equal(await stores.NightStore.load(), null);
    assert.equal(stores.storageRecovery()['movieBattle.log.v1'], initial);
    assert.equal(stores.storageRecovery()['movieBattle.night.v1'], '{broken');
    assert.equal(a.saved.data.get('movieBattle.log.v1'), initial);
});

test('export contains the active battle and score drafts, excluding credentials', async () => {
    const a = await app({ actualLog: true });
    const log = await a.load('js/features/battle-log.js');
    await new Promise(setImmediate);
    const stores = await a.load('js/core/saved-data.js');
    const setup = await nightApp(); setup.S.night.draftScores.a.a.fit = 4;
    await stores.NightStore.save(plain(setup.S.night));
    a.saved.data.set('movieBattle.tmdbKey', 'secret-key');
    await a.document.getElementById('exportBtn').click();
    const backup = JSON.parse(await a.downloads[0].text());
    assert.equal(backup.night.draftScores.a.a.fit, 4);
    assert.equal(JSON.stringify(backup).includes('secret-key'), false);
    assert.equal(prepareBackup(backup).night.id, setup.S.night.id);
});

test('import rejects malformed files without changing history and merges duplicates safely', async () => {
    const initial = JSON.stringify({ version: 1, players: { a: 'A', b: 'B' }, battles: [battle] });
    const a = await app({ actualLog: true, saved: storage({ 'movieBattle.log.v1': initial }) });
    await a.load('js/features/battle-log.js'); await new Promise(setImmediate);
    const input = a.document.getElementById('importFile');
    input.files = [{ size: 50, text: async () => JSON.stringify({ battles: [{ ...battle, id: 'bad', date: 123 }] }) }];
    await input.emit('change');
    assert.equal(a.saved.data.get('movieBattle.log.v1'), initial);
    input.files = [{ size: 50, text: async () => JSON.stringify({ battles: [battle, { ...battle, id: 'b2' }] }) }];
    await input.emit('change'); await input.emit('change');
    assert.equal(JSON.parse(a.saved.data.get('movieBattle.log.v1')).battles.length, 2);
});

test('declining active-night replacement cancels the entire import', async () => {
    const source = await nightApp();
    const a = await app({ actualLog: true, confirm: () => false });
    await a.load('js/features/battle-log.js'); await new Promise(setImmediate);
    const stores = await a.load('js/core/saved-data.js');
    const existing = plain(source.S.night); existing.id = 'existing';
    await stores.NightStore.save(existing);
    const input = a.document.getElementById('importFile');
    input.files = [{ size: 100, text: async () => JSON.stringify({ battles: [battle], night: plain(source.S.night) }) }];
    await input.emit('change');
    assert.equal((await stores.NightStore.load()).id, 'existing');
    assert.equal(a.saved.data.has('movieBattle.log.v1'), false);
});

test('schedule form explains quick-start and hides inapplicable deadline controls', async () => {
    const a = await nightApp();
    a.S.night.proposal = null;
    const { renderSchedule } = await a.load('js/battle-night/schedule.js');
    const main = new Element(); renderSchedule(main);
    const input = main.querySelectorAll('input').find(x => x.type === 'datetime-local');
    const policy = main.querySelector('fieldset');
    const { toLocalInput } = await a.load('js/battle-night/time-format.js');
    input.value = toLocalInput(T + 15 * MIN);
    await input.emit('input');
    assert.equal(policy.hidden, true);
    assert.equal(policy.disabled, true);
    assert.match(main.textContent, /Quick-start battle/);
    input.value = toLocalInput(T + 2 * HOUR);
    await input.emit('input');
    assert.equal(policy.hidden, false);
    assert.equal(policy.disabled, false);
});

test('save failure warning stays visible, offers a backup, and clears after retry', async () => {
    const a = await app();
    await a.load('js/features/save-warning.js');
    const stores = await a.load('js/core/saved-data.js');
    const warning = a.document.body.querySelector('aside');
    assert.equal(warning.hidden, true);
    a.saved.blocked = true;
    await stores.NightStore.save({ id: 'test' });
    assert.equal(warning.hidden, false);
    assert.match(warning.textContent, /Changes aren’t saved/);
    let backups = 0; a.window.addEventListener('backup:request', () => backups++);
    await warning.querySelectorAll('button').find(x => x.textContent === 'Download backup').click();
    assert.equal(backups, 1);
    a.saved.blocked = false;
    await warning.querySelectorAll('button').find(x => x.textContent === 'Retry saving').click();
    assert.equal(warning.hidden, true);
});

test('valid imports restore the active night and publish the restored state', async () => {
    const source = await nightApp(); source.S.night.draftScores.b.b.fun = 3;
    const a = await app({ actualLog: true });
    await a.load('js/features/battle-log.js'); await new Promise(setImmediate);
    let restored;
    a.window.addEventListener('night:restored', event => { restored = event.detail.night; });
    const input = a.document.getElementById('importFile');
    input.files = [{ size: 100, text: async () => JSON.stringify({ battles: [battle], night: plain(source.S.night) }) }];
    await input.emit('change');
    assert.equal(restored.draftScores.b.b.fun, 3);
    assert.equal(JSON.parse(a.saved.data.get('movieBattle.night.v1')).id, source.S.night.id);
});

test('saving the same night result twice creates one scoreboard entry', async () => {
    const a = await app({ actualLog: true });
    const { BattleLog } = await a.load('js/features/battle-log.js'); await new Promise(setImmediate);
    await BattleLog.addBattle({ ...battle, id: 'night:one' });
    await BattleLog.addBattle({ ...battle, id: 'night:one' });
    assert.equal(JSON.parse(a.saved.data.get('movieBattle.log.v1')).battles.length, 1);
});
