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
- `src/game.js` coordinates input → rules → reactions. `src/behaviors.js` = personality moments.
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
- The hill in the background is deliberately **not** tappable (it interrupted booping). The ranch
  opens only from the Ranch tab or the pearl counter.
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
choosing the next egg at move-out, four spark forms, Pure versions of all 22 forms, family tree).

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
