Copyright (c) 2026 Elizabeth Tong. All Rights Reserved.

This software and its accompanying files are proprietary and confidential. 
Unauthorized copying, modification, distribution, or use of this code, 
via any medium, is strictly prohibited without the express written 
permission of the copyright holder.

---

Opening the app

Double-click "Open Movie Battle.command". It starts a small local web server
and opens the app in your browser; close its Terminal window to stop it.
(Double-clicking index.html shows a notice instead: browsers don't run
JavaScript modules on pages opened straight from a file.)

- First time only, macOS may block it as being from an unidentified
  developer. Allow it under System Settings > Privacy & Security
  ("Open Anyway"), or on older macOS right-click it and choose Open.
- It uses Python 3, part of Apple's free Command Line Tools (installed with
  Git). If they're missing, macOS offers to install them, or run:
  xcode-select --install

Where things are

  Open Movie Battle.command   double-click to open the app
  index.html                  the page itself
  _headers                    security settings for the hosted site

  css/                        how everything looks
    layout.css                  page layout shared by every theme
    theme-*.css                 one file per theme (colours, fonts, effects)
    side-panels.css             the Battle Log and Genre Editor panels
    battle-night.css            the Battle Night page and the reveal
    messages.css                the short notes with Undo at the bottom
    welcome.css                 the first-visit walkthrough

  js/                         how everything works
    main.js                     the one entry point; loads everything below
    core/                       shared helpers: saved-data, sounds, page-elements
    wheel/                      the wheel
      genres-and-colors.js        the starting genres and slice colours
      themes.js                   the six themes (fonts, music, win sounds, prompts)
      genre-pool.js               12 on the wheel, the rest on the bench
      spin.js, drawing.js, title-card.js, controls-and-startup.js
    features/                   Battle Log, Genre Editor, movie lookup (TMDB),
                                clue ideas, music, messages, welcome walkthrough
    battle-night/               scheduling, champions, clues, the reveal, the
                                verdict (page.js ties them together)

  lighting/                   each theme's animated background
  audio/                      win sounds, the reveal sound, music/ per theme
  fonts/                      the theme fonts and their licences
  libraries/                  the confetti library and its licence

---

Third-party components

The following files are included under their own licenses and are not
covered by the notice above:

- fonts/ : Orbitron, Cinzel, Cinzel Decorative, Forum, Press Start 2P,
  Creepster and Uncial Antiqua (SIL Open Font License 1.1), and
  Special Elite (Apache License 2.0). License texts: fonts/LICENSES/
- libraries/confetti.browser.js : canvas-confetti 1.6.0 (ISC License).
  License text: libraries/canvas-confetti-LICENSE.txt
- Movie data and images are provided by TMDB. This product uses the
  TMDB API but is not endorsed or certified by TMDB.
