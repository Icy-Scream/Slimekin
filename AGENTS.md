# Slimekin: guide for coding agents

Read this first, then `README.md` (features, code map, tuning). This file is the hand-off: how the
project works, how it ships, how to test it, what the owner cares about, and what comes next.

## What it is

A cozy slime-raising clicker in three.js (no build step, plain ES modules). You hatch an egg, name
the slime, boop/feed/pet it; what it eats shapes its body, how you treat it shapes its personality.
Grown slimes move to a ranch (prestige), make pearls, and can be placed in new homes or auctioned.

- Played mostly on an **iPhone** as a home-screen web app: https://icy-scream.github.io/Slimekin/
  (GitHub Pages from `main` / `docs/`; the path is case-sensitive). Kids play it too.
- There is also a claude.ai Artifact copy of the same code (cloud save via the artifact database).
  It can only be republished from a Claude session that has the Artifact tool; everything else
  works from any machine.

## Run it

```bash
node tools/serve.mjs
```

Open http://localhost:5173 (add `#debug` for debug buttons in Settings and `window.slimekin`).
Node 18+. three.js 0.170.0 loads from jsDelivr through the import map in `index.html`.

## Ship a change (phone version)

```bash
node tools/build-web.mjs
```

Then commit everything **including `docs/`** and push `main`. Pages updates in about a minute; check
that `https://icy-scream.github.io/Slimekin/sw.js` shows the new `VERSION`. The installed app picks
it up the next time it is opened online (sometimes it takes two opens). Never edit `docs/` by hand.

## Architecture rules

- `src/core/` = rules and save state only (no three.js, no DOM). `sim.js` (slime, economy, moving
  to the ranch), `ranch.js` (pearls, basket, slots, offers, auctions, postcards).
- `src/view/` = presentation only. `slime.js` (soft-body avatar; `lite` mode for ranch residents),
  `forms.js` (the 22 grown-up looks), `ranch.js` (ranch scene and cameras), `stage.js`, etc.
- The ranch screen is the Barn ranch: `src/barn-ranch.js` coordinates it (who is on the stand, swaps, touch, the name
  card, framing above the menu), `src/view/barn.js` draws it (the baked barn from `src/assets/barn/`, ONE full
  `SlimeAvatar` on the show stand re-dressed for each resident, the burrow swap, straw, nest, pearls),
  `src/view/barn-math.js` is its plain math (node-testable), `src/ui/barn-card.js` the card and ‹ ›. Numbers in `BARN`
  (`content.js`). `src/view/ranch.js` is now only home's ranch hill in the Meadow background.
- `src/game.js` coordinates input → rules → reactions. `src/behaviors.js` = personality moments.
  game.js only builds the Game and runs the frame; its methods live in parts, one subject per file in `src/game/`
  (the list is at the top of game.js), and the menu's pages are the Hud's parts in `src/ui/panels/` (list at the top
  of hud.js). `mixParts` (`src/mixin.js`) copies them onto Game/Hud.prototype, so everything is still `g.x()` /
  `g.hud.x()` and `this` is the Game or the Hud. Put a new method in the part for its subject (or a new part, added
  to the `mixParts` call); a name defined twice stops the game at load. Parts import what they use and never
  game.js or hud.js; shared module consts go in `src/game/shared.js` / `src/ui/dom.js`.
- **All tuning and content lives in `src/data/content.js`** (`TUNING`, `STAGES`, `FOODS`, `HELPERS`,
  `UPGRADES`, `BOND`, `RANCH`, `BUYERS`, forms...). Balance there, not in logic.
- Saves: `localStorage` key `slimekin.save.v1`. Old saves must keep working: add new fields to
  `createState()` and let `migrate()` fill them in; never remove or rename a field without a
  migration. `migrateRanch()` does the same for `state.ranch`. A new number field: run it through `num()`
  (`core/save-check.js`) in `migrate()` so a string or NaN in it can't reach the game.
- Save safety (H1): only a save that passes `checkSave` is loaded, written, mirrored to the phone or accepted as a
  code. `slimekin.save.prev` is the previous good save (kept once per visit, every 30 min, and when a code replaces
  the slime); `slimekin.save.broken` keeps an unreadable save's text (never delete it). Boot falls back phone backup ->
  .prev -> new egg. Saving stops after a few failed frames (the hiccup card); don't call `store.saveLocal` directly
  from new code, use `saveNow()` (it respects that).

## Gotchas (learned the hard way)

- The menu has four tabs (Shop = Helpers + Upgrades, Outfits, your slime = its page + the Journal, Ranch); the
  pages keep their own names in code (`selectTab('journal')` etc.), see UI-CHANGES.md "UI pass 2". To reach the
  Journal in a test, click `#tab-slime` first, then `#tab-journal`.
- The meadow (grass, hills, clouds, flowers, trees, moon) is `src/view/scenery.js`. Settings → Background →
  Classic turns it off (`settings.scene`), restores the plain floor and sky, and hides the ranch hill unless you
  are visiting it. Anything new in the home scene's background should respect that setting.

- In `SlimeAvatar`, `this.look` is the **eye gaze** vector; the grown-up form look is `this.form`.
- Things inside the transmissive slime body (snacks in the belly, Hearth's heart, gems) are drawn
  as overlays with `depthTest: false`. Ranch residents hide theirs unless you are visiting.
- Traits objects must contain every trait key; a missing one turns the body math into NaN and the
  slime silently disappears (`setTraits` now guards this).
- Phone audio: low frequencies (under ~150 Hz) turn into buzz/static on iPhone speakers, and
  restarting a sound on every touch makes it click. The petting "hum" is one voice that only fades.
  Audio only unlocks on a finished tap (`touchend`/`click`).
- Slimeling pals' bodies are centered on their origin: lift them by `PAL_LIFT` onto `groundY()`.
- Prop limit: `SHOWN` in `src/view/helpers3d.js` caps how many copies of each helper are drawn (fewer on Low
  graphics, also when Auto lowers quality); owning more still earns more. Planters' and pals' parts are merged
  into one mesh each (`bake()`), and each cloud is one mesh: keep new props to a few draw calls.
- Anything that sits on the ranch grass needs a small lift or it z-fights with the ground.
- The ranch screen is the barn only (`src/barn-ranch.js`, `src/view/barn.js`). The old meadow ranch screen is gone:
  `src/view/ranch.js` is now just home's ranch hill in the Meadow (not tappable: it interrupted booping). The barn's
  files load in idle time a moment after home shows (`BARN.preload`); tapping Ranch before they are in stays home with
  an "Off to the barn" pill. A browser test that opens Ranch must wait for `window.slimekin.barnRanch.on` (or
  `.view.failed`) before it uses the barn.
- In the barn, `g.ranch.resident(id)` is the hidden ranch's lite avatar. What the barn draws is
  `g.barnRanch.view.av` (the one on the stand, `g.barnRanch.curId`); to see a given resident there:
  `g.barnRanch.show(id); g.advance(1.2)`.
- In the barn a press on the slime pets only once it can't be a quick sideways swipe (or on lift for a tap), so a swipe
  across it never pets. Keep that if you add gestures there.
- `tools/fixtures/*.json` are OLD saves: every node test migrates all of them. A save made by today's rules goes in a
  subfolder (`tools/fixtures/barn/barn-six.json`, remade by `node tools/fixtures/make-barn-save.mjs`).
- The goodbye (moving out, a baby's new home) is the travel bubble in `src/send-off.js` (numbers in `SENDOFF`, the pure
  rule in `src/view/bubble-math.js`: it floats out of the picture, or pops before it is seen meeting the room). New
  things in the Greenhouse's upper half (hanging from the roof, tall furniture): add them to `greenhouseRoom()` and run
  `node tools/bubble-test.mjs` and `node tools/send-off-smoke.cjs`.
- The game's start waits for the Greenhouse room under the loading screen ("Warming the nest"): `main.js` fades it once
  `game.firstLook()` resolves (the room in and drawn, or failed, or `GREENHOUSE.arrive.wait` 8 s). Past the wait home
  shows the Classic look (world 'loading') and the room cross-fades in (`canvas#homeFade`). The Meadow and Classic
  don't wait. Things the start shows on a timer go through `game.whenShown()`. `window.slimekin` (#debug) appears when
  the loading screen starts to go, so a test that delays or blocks the room's files waits longer for it; what home drew
  last is on `<html data-home-world>`.
- Breeding uses seeded dice (`core/random.js`): an egg's inheritance is fixed when it is made, so
  reopening the game never rerolls it. Egg timers use the wall clock; `g.advance()` moves a test clock
  (`g.timeSkip`) along so tests can wait out the Nursery.
- A new spark form is one `SPARK_FORMS` entry in `content.js` plus one `FORM_LOOKS['spark:<id>']` look.
- The jelly loop rules: Family Bonus `familyBonusFor/legacyFor` in `core/ranch.js` (from `family.lifetime + family.legacy`,
  never lower), medals `core/medals.js`, heirlooms `core/heirlooms.js` (+ `Sim.buyHeirloom`), Moving Day math
  `core/movingday.js` and its signs `src/moving-day.js`; all numbers in `MEDALS`, `HEIRLOOMS`, `MOVING_DAY` in `content.js`.

## Testing

- `node tools/smoke-test.cjs` plays through hatch → Settled → ranch → move out in a headless
  phone-sized browser (setup steps are at the top of the file). Screenshots go to `tools/out/`.
- The browser tests use `tools/browser-kit.cjs`: their own dev server on a free loopback port, fully
  offline (three.js from node_modules, every other outside request aborted and logged), a deadline on
  every step (`page.evaluate` has none of its own) and timestamped progress. A stuck step fails with a
  note on what the browser was doing: a busy `gpu-process` means software WebGL is just slow on a loaded
  machine; everything asleep means a stall. Run browser tests one at a time on a busy box, and not from
  inside a service that has a memory limit: when that group goes over its limit, the system throttles
  every process in it and the browser stalls with all its processes asleep (no frames, `page.evaluate`
  never answers, the reload never reaches "load"). The kit warns at the start when there is less than about
  1 GB left under the limit, and a failure says when the system throttled the group.
- Useful debug hooks (with `#debug`): `g.advance(seconds)` fast-forwards the game, `g.debug('grow' |
  'jelly' | 'mega' | 'bond' | 'glim' | 'req' | 'needs')`, `g.tapEgg(...)`, `g.hud.closeModal()`,
  `g.slime.setForm(id)`, `g.ranch.sync([...])`, `g.focusResident(id)`.
- Software WebGL is slow (a few fps). Headless Chrome only advances CSS transitions when it draws, so
  take a screenshot (or a few) before measuring layout after an animation.
- Touch gestures: use CDP `Input.dispatchTouchEvent` (Playwright's tap alone can't drag).
- Economy: `node tools/economy-sim.mjs 12 quiet` (engaged), add `casual`, `spam`, or `gen2=1e9`.
  Spamming must never beat normal play. Targets are in the README. `bred` makes the gen-2 baby from a
  Nursery egg.
- Barn ranch: `node tools/barn-test.mjs` (plain node: the barn's files, the swap's pose curve, the order and wrap, the
  card's line, the nest and basket spots, framing) and `node tools/barn-smoke.cjs [--quick] [--only=open,swipe,...]`
  (real touch swipes, petting, the card, Ranch life, pearls, the Nursery nest, a new home, the sheet, Low, Reduced
  motion, the empty barn, the files blocked; screenshots in `tools/out/barn/`).
- Send-off: `node tools/bubble-test.mjs` (plain node: the bubble's size, path and pop rule for every camera angle and
  160 hand-turned cameras) and `node tools/send-off-smoke.cjs [--quick] [--frames] [--only=front,wide,...]` (headless:
  a grown slime and a baby leave in every Background and angle, rays from the camera check the bubble never meets
  anything drawn; frames in `tools/out/send-off/`). The game's start with the barn loading ahead of time:
  `node tools/barn-start-probe.cjs --runs=4 [--before=<an older copy of the game>]`.
- The start: `node tools/home-load-smoke.cjs [--only=delay3,delay12,offline,meadow,classic] [--film]` (cold loads with
  the room's files 3 s or 12 s late or blocked; every frame's world and the loading screen's opacity are recorded; --film
  saves screenshots to tools/out/home-load/). Cold start to playable, against an older copy:
  `node tools/home-load-smoke.cjs --only=cold --runs=6 --before=<folder> [--delay=3000]`.
- Save safety: `node tools/save-safety-test.mjs` (plain node) and `node tools/health-smoke.cjs` (the cards and toasts at
  375 px, `--only broken,prev,code,hiccup,gl,savefail,boot,name`).
- Playtest fixes: `node tools/playtest-smoke.cjs` (menu sheet drags with real touch events, warming egg at
  move-out, swapping the cushion egg, a baby's new home; `--only sheet,egg,swap,rehome`, `--dpr 1 --quick`).
- Jelly loop: `node tools/jelly-loop-test.mjs` (plain node) and `node tools/jelly-loop-smoke.cjs` (headless, from an old save;
  screenshots in `tools/out/jelly-loop/`). The Moving Day tester save is `tools/fixtures/moving-day-almost.json`.
- Breeding: `node tools/breeding-test.mjs` (plain node: caps, seeds, sparks, Pure, cooldowns, old saves
  from `tools/fixtures/`), and `node tools/breeding-smoke.cjs` (headless play-through from an old save,
  screenshots in `tools/out/breeding/`). `g.debug('pearls')` adds 100 pearls.

UI work: `UI-CHANGES.md` lists every on-screen element the breeding core and the playtest fixes added or changed. Its last section
("UI pass 1") lists the drawn icon set in `src/ui/icons.js`: use it instead of emoji or text glyphs for new UI.

## How the owner likes to work

- Plain, short explanations; they read on a phone. Lead with what changed and how to try it.
- **For new visuals or combos, send rendered sample images first** (labeled contact sheets worked
  well), then build. Check every visual at iPhone size (393×852) and in night mode.
- Keep it cozy: nothing bad happens while away, no guilt, selling is framed as a new home.
- Real-device feedback matters most (a recent iPhone). When something "sounds like static" or "phases
  through the floor", reproduce it in a render or a sound file and show the fix.

## Roadmap

Done: alive pass (gestures, emotes, tricks, secrets), economy (Jelly Jar, upgrades, outfits), iPhone
web app, 22 grown-up form looks, ranch + pearls + prestige + new homes + auctions, anti-spam and
slower bond, swipe-to-close menu, movable notifications, breeding core (Nursery, capped inheritance,
choosing the next egg at move-out, four spark forms, Pure versions of all 22 forms, family tree), the Barn ranch,
the barn loads ahead of time, the travel-bubble send-off, the start waits for the Greenhouse (no other scene first),
save safety (H1).

Next, in this order (agreed with the owner):

1. **More breeding**: the core is built (the Nursery, family sparks for S'more, Honeycomb, Campfire
   and Storm, Pure versions). Next: signature moves for every slime, more spark forms (Opal = Geode ×
   Aurora, Fairy Ring = Root × Nectar, Pop Rocks = Candy × Volt...; samples first), rewards for rare
   breeds, rare Sparkle (~1/50), Golden (~1/500) and Ghost (hatches at night) variants, Royal crown
   after three generations of one line.
2. **Training Center** (Bounce, Speed, Sturdy, Smarts, Charm; costs pearls and time) and **trips**
   (send a resident away for hours; it brings back pearls, a rare snack, a souvenir and a story).
3. **Contests** (Beauty Show, Slime Sprint, Bounce-Off) and then **Slime Sumo battles** (cozy,
   coached not controlled; tease the arena early on the ranch as "coming soon").
4. Later: pearl-only cosmetics and snacks (new traits), more ranch buildings, an App Store build
   (wrap the same code with Capacitor; needs a Mac with Xcode and an Apple Developer account).

The owner's original design documents (GDD v0.1, OOP guide) are not in this public repo; ask the
owner for them if you need the details.
