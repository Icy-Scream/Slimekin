# Third-party code and fonts in the iPhone app

Everything below is open source and talks to nothing: the app makes no network requests (see APP-STORE-NOTES.md).
Exact versions are pinned in `package.json` / `package-lock.json` (npm installs them; nothing is downloaded at run time).
License texts are in `licenses/`.

| What | Version | License | Where it comes from | In the app as |
|---|---|---|---|---|
| three.js | 0.170.0 (same as the web version's import map) | MIT | npm `three` | `www/vendor/three/`: `build/three.module.min.js` (the official minified build) and the three addon files the game imports (`utils/BufferGeometryUtils.js`, `geometries/RoundedBoxGeometry.js`, `environments/RoomEnvironment.js`) |
| DynaPuff (display font) | Google Fonts v9, via `@fontsource/dynapuff` 5.3.0 | SIL OFL 1.1 | npm `@fontsource/dynapuff` | `www/fonts/`: woff2, Latin subset, weights 500, 600, 700 |
| M PLUS Rounded 1c (body font) | Google Fonts v22, via `@fontsource/m-plus-rounded-1c` 5.3.0 | SIL OFL 1.1 | npm `@fontsource/m-plus-rounded-1c` | `www/fonts/`: woff2, Latin subset, weights 500, 700, 800 |
| Capacitor (the app shell: web view, bridge) | 8.6.0 | MIT; its iOS runtime includes parts of Apache Cordova (Apache 2.0) | npm `@capacitor/core`, `@capacitor/ios` (build tool: `@capacitor/cli`) | compiled into the app by Xcode |
| Capacitor Preferences (save backup) | 8.0.1 | MIT | npm `@capacitor/preferences` | compiled into the app |
| Capacitor Haptics (gentle taps) | 8.0.2 | MIT | npm `@capacitor/haptics` | compiled into the app |

Notes

- The fonts are the same files Google Fonts serves (Fontsource repackages them unchanged). Only the Latin subset is
  bundled: letters, digits, punctuation and Latin-1 accents. Emoji, hearts, stars and arrows in the game's text were
  never in these fonts and use the iPhone's own fonts, as on the web.
- The game's own code (everything in `src/` and `index.html`) is Slimekin's.
- `licenses/` files: `three.js-0.170.0-MIT.txt`, `DynaPuff-OFL-1.1.txt`, `M-PLUS-Rounded-1c-OFL-1.1.txt`,
  `capacitor-8.6.0-MIT.txt` (core, ios, cli: the same text), `capacitor-plugins-MIT.txt` (Preferences, Haptics: the
  same text), `apache-cordova-Apache-2.0.txt` (the Apache License 2.0, for the Cordova parts of Capacitor's iOS runtime).
