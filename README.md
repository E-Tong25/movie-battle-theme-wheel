# Movie Battle

**Two Critics. One Couch. Zero Mercy.**

A themed spinning wheel for movie battle nights. Spin for a genre, each pick a
movie in secret, watch both back to back, and judge who wins. Every battle goes
on a running scoreboard.

## How a battle works

1. **Spin the wheel** for tonight's theme. Lock it in, or spin again.
2. **Pick a time** in Battle Night. One of you proposes, the other accepts.
3. **Choose your champions in secret.** Each of you locks in a movie for the
   theme, and can drop up to three cryptic clues that unlock during the countdown.
4. **The reveal.** An hour before the battle, both picks are revealed with a
   montage of stills from the two movies.
5. **Watch and judge.** Score both movies in secret. The verdict goes into the
   Battle Log, with the scoreboard and history.

## Opening the app

Double-click **Open Movie Battle.command**. It starts a small local web server
and opens the app in your browser; close its Terminal window to stop it.

- **First time only,** macOS may block it as being from an unidentified
  developer. Allow it under **System Settings > Privacy & Security**
  ("Open Anyway"), or on older macOS right-click it and choose **Open**.
- It uses **Python 3**, part of Apple's free Command Line Tools (installed with
  Git). If they're missing, macOS offers to install them, or run
  `xcode-select --install`.
- **Without the opener,** run `python3 -m http.server 8123 --bind 127.0.0.1` in
  this folder, then open <http://localhost:8123>.

Double-clicking `index.html` shows a notice instead: browsers don't run
JavaScript modules on pages opened straight from a file.

## Movie posters (TMDB)

Posters, movie search, clue ideas and the reveal montage use
[TMDB](https://www.themoviedb.org), a free movie database. To turn them on:

1. Make a free TMDB account, then go to **Settings > API** and request a key
   for personal use.
2. In the app, open Battle Night, click **Posters**, and paste the key.

The key is saved only in that browser (never in the project files), so paste
it once on each device you use. Without a key, the app shows stand-in posters.

## Customizing

| To change | Where |
|---|---|
| Genres on the wheel | In the app: **Edit genres** under the wheel |
| The starting genre list and slice colours | `js/wheel/genres-and-colors.js` |
| A theme's prompt, font, music or win sound | `js/wheel/themes.js` |
| A theme's look | `css/theme-<name>.css` |
| A theme's animated background | `lighting/<name>.js` |
| Background music tracks | `audio/music/` (one per theme) |

## Current status

- **Each device keeps its own data** (Battle Log, genres, battle nights) until
  the shared version, planned with Firebase.
- **Battle Night is a prototype on one device.** The bar at the bottom switches
  between the two players and can skip ahead in time, for trying the whole flow.
  With the shared version, each phone becomes its own player and picks stay
  sealed until the reveal.

## Where things are

```
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
```

## Third-party components

These files are included under their own licenses and are not covered by the
copyright notice below:

- **fonts/**: Orbitron, Cinzel, Cinzel Decorative, Forum, Press Start 2P,
  Creepster and Uncial Antiqua (SIL Open Font License 1.1), and Special Elite
  (Apache License 2.0). License texts: `fonts/LICENSES/`
- **libraries/confetti.browser.js**: canvas-confetti 1.6.0 (ISC License).
  License text: `libraries/canvas-confetti-LICENSE.txt`
- **Movie data and images** are provided by TMDB. This product uses the TMDB
  API but is not endorsed or certified by TMDB.

## Copyright

Copyright (c) 2026 Elizabeth Tong. All Rights Reserved.

This software and its accompanying files are proprietary and confidential.
Unauthorized copying, modification, distribution, or use of this code,
via any medium, is strictly prohibited without the express written
permission of the copyright holder.
