# Reliability update

This update is based on commit `7307a982191a48af6ab88cbfcdf097bd17f40260`.
It keeps the plain JavaScript app and its existing themes. It does not add
hosting, shared accounts, Firebase, or two-phone play.

## Try the updated project

1. In your existing app, open Battle Log and select **Export** before switching
   versions. Keep that backup.
2. Unzip the updated project into a new folder. Close the old app's server
   Terminal window before starting the new one.
3. Double-click **Open Movie Battle.command** in the new folder, as usual.
   The browser, hostname and port must match the old app to reuse its browser
   data (normally `http://localhost:8123`). If the log appears empty, use
   **Import** to bring in the backup instead.
4. Try a test battle with the checklist below before using it for a real night.

For an existing Git checkout, the accompanying patch can also be applied from
its root using `git apply --check /path/to/Movie_Battle_Reliability_Fixes.patch`,
then `git apply /path/to/Movie_Battle_Reliability_Fixes.patch`. Start with a clean
working tree at the base commit, or review overlapping edits before applying.
The patch includes new files as well as modifications. No changes were pushed
to GitHub.

## What changed

- Each judge has an independent score draft inside the saved battle. Scores
  save as they are selected, survive refreshes, and remain separate after
  submission. A submitted score sheet cannot be submitted again.
- Battles accepted one hour or less before their start use quick-start mode.
  Reveal waits for both picks; clues and missed-pick forfeits are off. Judging
  still waits until the scheduled start. A late second pick can finish this
  flow even after the scheduled start.
- Normal battles retain one-hour reveals, three clue unlocks, and the chosen
  missed-pick policy. Extensions last until the original reveal time plus
  30 minutes. Reopening after that deadline resolves the forfeit immediately.
- Backups include the active schedule, picks, clues, score drafts and submitted
  scores. They exclude the TMDB credential. They contain BOTH players' secrets,
  so keep them private until the reveal.
- Imports are validated before data is changed. Invalid history entries are
  skipped with a count; files whose history entries are all invalid are
  rejected. Old backups and array-only history exports remain supported.
  An unfinished battle is replaced only after confirmation. Duplicate battle
  IDs do not create duplicate scoreboard records.
- Loading saved data uses the same validation. Unreadable raw records remain
  available in the backup's `recovery` field for manual inspection; they are
  not run through the page. The recovery field is not automatically imported.
- Failed writes and deletes retain the session's current state, show a
  persistent warning, and offer **Retry saving** and **Download backup**.
  Retry saves the latest edits; a failed deletion retries the deletion.
- A completed battle has a stable log ID, preventing duplicate entries if
  saving the result is repeated. Movie title edits clear stale movie metadata;
  search selections also save before the pick is locked.

## Automated checks

With Node.js 20 or newer, from the project folder:

```sh
node --experimental-vm-modules --test tests/reliability.test.mjs
```

No dependency installation is needed. Node may print a notice that VM modules
are experimental; they are used only by the tests. The test suite exercises
application modules with a small DOM adapter and simulated browser storage.
It does not verify visual rendering, real downloads, or TMDB connectivity.

## Manual browser checks

Use a test browser profile or export your real data first.

1. **Independent judging:** choose different movies and use the prototype clock
   to reach judging. Score as Player 1, switch to Player 2, and confirm the
   second form is blank. Refresh after entering a few scores and confirm that
   player's draft returns. Submit different scores for each player and check
   the combined result.
2. **Quick-start:** propose a battle 15 minutes away and accept as the other
   player. Confirm neither player forfeits, lock both picks, and check the
   reveal. Use the prototype clock to reach judging. Repeat with identical
   movies to check the same-movie re-pick.
3. **Regular deadlines:** schedule a battle at least two hours ahead. Leave
   one pick unlocked and skip to the reveal. Check both the instant-forfeit
   rule and the extension rule in separate battles. For an extension, skip
   through all 30 minutes and confirm the forfeit.
4. **Backups:** export during an unfinished battle. Import into a separate
   browser profile and check the schedule, picks and drafts. In the original
   app, decline replacing an unfinished battle and confirm nothing changed.
   Import a legacy backup twice and verify no duplicate history entries.
5. **Storage failures:** in a test profile, use browser developer tools to
   simulate blocked storage or a full quota. Confirm the warning remains
   visible, backup works, and retry clears the save warning after storage is
   available again. Do not refresh before exporting unsaved work.
6. **Presentation:** check the warning and scheduling form on a phone-sized
   screen and in each theme, including keyboard use and reduced motion.

## Implementation map

| Area | Main files |
| --- | --- |
| Data validation | `js/core/data-validation.js` |
| Memory fallback, recovery and retries | `js/core/saved-data.js` |
| Save warning | `js/features/save-warning.js`, `css/messages.css` |
| Backup export/import | `js/features/battle-log.js` |
| Quick-start and deadlines | `js/battle-night/actions.js`, `rules.js`, `schedule.js` |
| Independent saved score drafts | `js/battle-night/verdict.js` |
| Regression tests | `tests/reliability.test.mjs` |
