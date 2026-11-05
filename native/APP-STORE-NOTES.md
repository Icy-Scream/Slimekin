# App Store notes (iPhone app, slice W1)

What the App Store Connect forms ask, with how each answer was checked. All checks were run on the build machine on
2026-11-05 (outputs in the W1 report); re-run them after any change. This build has **no purchases and no ads**: if
either is added, every section below must be redone.

## Network requests: none

- The app's web folder has no web links and the game's code uses no network function:
  `node tools/check-ios-www.mjs` (run by `node tools/build-ios.mjs`) prints `OK: no links, no network APIs in the
  game code, every file named and imported is there`. The only `http` text left is two XML namespace names
  (`http://www.w3.org/2000/svg`, `http://www.w3.org/1999/xhtml`): identifiers, never fetched.
- The game played start to finish in a browser with every outside request refused and counted:
  `SLIMEKIN_ROOT=native/www SLIMEKIN_STRICT=1 node tools/smoke-test.cjs` (and `tools/jelly-loop-smoke.cjs`) end with
  `0 outside request(s) were aborted`.
- `capacitor.config.json` has no `server` block, so the app loads only its bundled files (`node tools/check-ios.mjs`).
- Building on the Mac downloads Capacitor's Swift package from GitHub (Xcode does it); the app itself never connects.

## Permissions: none

- No `NS...UsageDescription` keys, no background modes, no URL schemes, no App Transport Security exceptions:
  `node tools/check-ios.mjs`. The app asks for nothing (no camera, photos, location, contacts, tracking, notifications).

## App Privacy ("nutrition label"): Data Not Collected

- No accounts or sign-in, no analytics, no ads, no tracking: `grep -rniE "analytics|gtag|telemetry|tracking|advert|admob|adsense" src index.html`
  finds only the empty `ads` slot in `src/platform/index.js`.
- Privacy manifest `ios/App/App/PrivacyInfo.xcprivacy`: tracking false, no tracking domains, no collected data types;
  one required-reason API, UserDefaults (the save backup, `@capacitor/preferences`), reason `CA92.1` (data only this
  app reads). Checked by `node tools/check-ios.mjs`.
- The save stays on the phone (web view storage plus the UserDefaults copy). A save code is made only when the player
  taps "Copy save code"; the player copies and pastes it.

## Third-party code

`THIRD-PARTY.md` (licenses in `licenses/`): three.js 0.170.0 (MIT), DynaPuff and M PLUS Rounded 1c fonts (SIL OFL
1.1), Capacitor 8.6.0 with Preferences 8.0.1 and Haptics 8.0.2 (MIT; Capacitor's iOS runtime includes Apache-2.0
Cordova parts). None of them sends or receives anything. No SDKs.

## Encryption (export compliance)

`ITSAppUsesNonExemptEncryption = false` in Info.plist (`node tools/check-ios.mjs`): the app has no encryption of its own
and makes no network connections. App Store Connect then skips the export compliance question for each build.

## Age rating questionnaire: facts for the answers

- Cartoon slimes in a cozy 3D scene. Interactions: boop (tap), pet, feed, dress up, tricks. A booped-in-the-eye slime
  gets grumpy and boops back; nothing more. No violence, no fear, no mature or suggestive themes.
- In-game currency only (jelly, pearls), earned by playing. Nothing can be bought with real money in this build.
- No chat or messaging, no user-generated content shared with anyone (the slime's name stays on the phone), no web
  browsing (the game has no links), no ads, no contests with other players.
- Random things in play, none of them a wager: a Lucky Glimmer gives a random bonus when caught; a bred egg takes after
  its parents with some chance; an in-game "auction" lets pretend buyers bid pearls for a ranch slime the player chooses
  to send to a new home. The player never stakes anything and nothing is paid for. Reading: "Simulated Gambling: None".
  The captain answers the questionnaire.
- Audience: everyone. Not the Kids Category.

## Screenshots

From Apple's "Screenshot specifications" page in App Store Connect Help (read again 2026-11-05, 18:10 UTC):

- Required: "To submit your app, you must provide screenshots for the following required display sizes: iPhone: At
  least one screenshot for iPhone with Dynamic Island (medium display)." That is portrait **1206 x 2622** or
  1179 x 2556 (the page lists iPhone 18 Pro, 17 Pro, 17, 16 Pro, 16, 15 Pro, 15 and 14 Pro).
- Optional: "iPhone with Dynamic Island (large display)", portrait **1320 x 2868**, 1290 x 2796 or 1260 x 2736 (iPhone
  Air, 18 Pro Max, 17 Pro Max and others): listed with no "required" line. The older classes (Face ID, Home Button)
  are optional too; when one is missing, Apple uses scaled screenshots from a neighbouring class.
- Scaling: "If your app's user interface is consistent across multiple device sizes and localizations, you only need
  to provide screenshots for the highest required resolution. App Store Connect automatically scales them down for
  smaller device sizes."
- At least 1, up to 10 per size, `.jpeg`, `.jpg` or `.png`. "Images can't include alpha channels or transparencies."
- Plan, to be safe: the same screens twice, on the Pro (1206 x 2622, the required slot) and on the Pro Max
  (1320 x 2868, the large slot) of the newest iPhone family in Xcode, each set uploaded into its own slot. Turn off the
  Speed meter first.
- How: Xcode 27 takes them in Device Hub: run the app on the simulated iPhone, go to the screen, click the Screenshot
  button below the device; the file goes to the Desktop at the device's full resolution (Apple's "Capturing
  screenshots and videos from devices"). Xcode 26 and older: the Simulator app, File > Save Screen. Check each file's
  size (Finder, Get Info, Dimensions) and export it as JPEG from Preview (no transparency then).
- Apple's page also says iPhone Duo screenshots become required in April 2027 for apps built with the iOS 27.1 SDK or
  later. Not needed for this first build.

## Notes for the reviewer (App Review Information > Notes)

> No login or account. Slimekin is a gentle, fully offline game for all ages. Tap the egg a few times to hatch it and
> give the slime a name. Then tap it to boop it, hold and drag on it to pet it, and drag a snack from the bottom tray
> onto it to feed it. The tabs at the bottom open the shop (helpers and upgrades), outfits, your slime's page and
> journal, the ranch, and the heirloom chest.
>
> The ranch, the Nursery (breeding), medals and heirlooms open once a slime grows up, after about 45 to 60 minutes of
> play. To see them at once: after naming the first slime, open Settings (the gear at the end of the name bar, top
> left), tap "Load a save code", paste the code from the attached file and tap Load. A second-generation baby appears, and the family's first
> slime, Juniper, lives grown up on the ranch (Ranch tab; the Nursery needs two ranch slimes).

Attach `review/reviewer-save-code.txt` as a file (one line, `SLIMEKIN1:...`, 3,242 characters; long, so attach it
rather than pasting it into Notes). It is the test save `tools/fixtures/main-gen2.json` (the slime Pebble, second
generation, a young baby; Juniper, a grown Hearth Slime, on the ranch; 22 pearls), encoded the way the game's "Copy
save code" does it. A save with two ranch slimes (to show breeding at once) can be made the same way: say if wanted.

## Listing text: DRAFT (the captain's words win)

- Name: Slimekin
- Subtitle (27 of 30 characters): `Raise a tiny, squishy slime`
- Keywords (95 of 100 characters): `slime,virtual pet,cozy,cute,idle,clicker,kawaii,squishy,hatch,egg,breeding,ranch,relaxing,jelly`
- Category suggestion: Games > Simulation (second: Games > Casual).
- Price: free.
- Description:

> Hatch an egg, name your slime, and watch it grow.
>
> Boop it, pet it and feed it. What it eats changes its color and grows little things on its body: sprinkles, a tiny
> flame, crystals, a leaf. How you treat it shapes who it becomes: curious, cuddly, playful, bold or patient. Every
> slime has a favorite snack and a favorite outfit for you to discover.
>
> Grown-up slimes move to the ranch on the hill, where they make pearls, play, and nap in nightcaps after dark. Visit
> them any time. Pair two of them in the Nursery for a new egg that takes after its parents, and find the rare family
> forms only some pairs can pass on.
>
> Cozy by design: nothing bad happens while you are away, there is no timer to beat and no one to compete with. No ads,
> no accounts, and the game never goes online.

## Before submitting

1. Fill `{{CONTACT_EMAIL}}` and `{{DATE}}` in `web/pages/`, run `node tools/check-store-pages.mjs` until it says OK,
   publish the web build so the pages are live (privacy and support URLs: the web game's address followed by
   `privacy.html` and `support.html`).
2. Final bundle id in `capacitor.config.json` (it cannot change after the app is created in App Store Connect).
3. App icon: done. `assets/AppIcon-1024.png` is icon B, the close-up of the happy mint slime (the captain's pick). To
   change it: replace that file (1024 x 1024 PNG, no transparency, square corners) and run `node tools/patch-ios.mjs`;
   `node tools/check-ios.mjs` checks all three.
4. In App Store Connect, Pricing and Availability: decide whether the iPhone app may also be offered on Mac (Apple
   silicon) and Apple Vision Pro.
5. Raise `build` in `app-version.json` for every upload.
