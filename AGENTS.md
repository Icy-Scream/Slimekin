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
  migration. `migrateRanch()` does the same for `state.ranch`.

## Gotchas (learned the hard way)

- In `SlimeAvatar`, `this.look` is the **eye gaze** vector; the grown-up form look is `this.form`.
- Things inside the transmissive slime body (snacks in the belly, Hearth's heart, gems) are drawn
  as overlays with `depthTest: false`. Ranch residents hide theirs unless you are visiting.
- Traits objects must contain every trait key; a missing one turns the body math into NaN and the
  slime silently disappears (`setTraits` now guards this).
- Phone audio: low frequencies (under ~150 Hz) turn into buzz/static on iPhone speakers, and
  restarting a sound on every touch makes it click. The petting "hum" is one voice that only fades.
  Audio only unlocks on a finished tap (`touchend`/`click`).
- Slimeling pals' bodies are centered on their origin: lift them by `PAL_LIFT` onto `groundY()`.
- Anything that sits on the ranch grass needs a small lift or it z-fights with the ground.
- The hill in the background is deliberately **not** tappable (it interrupted booping). The ranch
  opens only from the Ranch tab or the pearl counter.

## Testing

- `node tools/smoke-test.cjs` plays through hatch → Settled → ranch → move out in a headless
  phone-sized browser (setup steps are at the top of the file). Screenshots go to `tools/out/`.
- Useful debug hooks (with `#debug`): `g.advance(seconds)` fast-forwards the game, `g.debug('grow' |
  'jelly' | 'mega' | 'bond' | 'glim' | 'req' | 'needs')`, `g.tapEgg(...)`, `g.hud.closeModal()`,
  `g.slime.setForm(id)`, `g.ranch.sync([...])`, `g.focusResident(id)`.
- Software WebGL is slow (a few fps). Headless Chrome only advances CSS transitions when it draws, so
  take a screenshot (or a few) before measuring layout after an animation.
- Touch gestures: use CDP `Input.dispatchTouchEvent` (Playwright's tap alone can't drag).
- Economy: `node tools/economy-sim.mjs 12 quiet` (engaged), add `casual`, `spam`, or `gen2=1e9`.
  Spamming must never beat normal play. Targets are in the README.

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
slower bond, swipe-to-close menu, movable notifications.

Next, in this order (agreed with the owner):

1. **Breeding**: a Nursery building on the ranch. Two residents make an egg; the baby leans toward
   its parents' traits (capped, per the design doc). Some parent pairs give the egg a "family spark":
   raised on the right snacks it becomes a breeding-only form. First four to build (samples first):
   S'more Slime (Hearth × Marshmallow), Honeycomb Slime (Nectar × Candy), Campfire Slime (Hearth ×
   Root), Storm Slime (Aurora × Volt). Later: Opal (Geode × Aurora), Fairy Ring (Root × Nectar),
   Pop Rocks (Candy × Volt), Pure versions (same form × same form), rare Sparkle (~1/50), Golden
   (~1/500) and Ghost (hatches at night) variants, Royal crown after three generations of one line.
2. **Training Center** (Bounce, Speed, Sturdy, Smarts, Charm; costs pearls and time) and **trips**
   (send a resident away for hours; it brings back pearls, a rare snack, a souvenir and a story).
3. **Contests** (Beauty Show, Slime Sprint, Bounce-Off) and then **Slime Sumo battles** (cozy,
   coached not controlled; tease the arena early on the ranch as "coming soon").
4. Later: pearl-only cosmetics and snacks (new traits), more ranch buildings, an App Store build
   (wrap the same code with Capacitor; needs a Mac with Xcode and an Apple Developer account).

The owner's original design documents (GDD v0.1, OOP guide) are not in this public repo; ask the
owner for them if you need the details.
