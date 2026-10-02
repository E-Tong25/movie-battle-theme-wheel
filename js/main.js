/* ==========================================================================
   MOVIE BATTLE: the one entry point. index.html loads this file as a module,
   and it brings in everything else. Each import below loads that part of the
   app (and whatever it depends on) in this order.

     js/core/      shared helpers: saving, sounds, building page elements
     js/wheel/     the wheel: themes, drawing, the genre pool, spinning, the title card
     js/features/  the Battle Log, Genre Editor, posters, clue ideas, music, toasts, welcome
     js/battle-night/     Battle Night: scheduling, champions, clues, the reveal, the verdict
   The theme lighting (lighting/) is separate: plain scripts that only listen to
   the wheel's events.
   ========================================================================== */
import './wheel/controls-and-startup.js';
import './features/battle-log.js';
import './features/genre-editor.js';
import './battle-night/page.js';
import './features/music.js';
import './features/welcome-walkthrough.js';

// The app is running: js/open-notice.js only shows its notice when this never happens
document.documentElement.dataset.appStarted = 'yes';
