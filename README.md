# Slimekin (three.js prototype)

A cozy slime-raising clicker. You hatch an egg, name the slime, and then boop, feed and pet it.
What it eats changes its color and grows things on its body, and how you treat it shapes its
personality. The clicker economy (jelly, helpers, upgrades) is built around the slime instead of
replacing it.

This is the "First Twelve Feedings" promise prototype from `Slime_GDD_v0.1`, rebuilt in three.js
and stretched into a full first lifecycle (Hatchling → Sprout → Rascal → Settled, roughly 45–60 minutes).

## Run it locally

No build step. You need Node 18+ (only for the tiny dev server).

```bash
node tools/serve.mjs
```

Then open http://localhost:5173. Add `#debug` to the URL (`http://localhost:5173/#debug`) to get
debug buttons in Settings (free jelly, skip a stage, spawn a Lucky Glimmer, force a request).

`index.html` is written as a claude.ai Artifact body (no `<html>`/`<head>` tags); the dev server
wraps it in the same skeleton the artifact host adds. three.js 0.170.0 loads from jsDelivr via an
import map.

## Play on your iPhone

The game is published at **https://icy-scream.github.io/slimekin/** (GitHub Pages, built from `docs/`).

1. Open that link in Safari on the iPhone.
2. Tap the Share button, then **Add to Home Screen**. It gets its own icon, opens full screen, and works offline after the first visit.
3. To bring a slime over from another device (for example the claude.ai version): on the old device open Settings, **Copy save code**; on the phone open Settings, **Load a save code**, paste, Load.

Phone notes: the game is portrait-only (turning sideways shows a reminder), runs at 60 fps and drops to 30 fps when nothing is happening to save battery, and lowers graphics quality on its own if a device struggles. Settings has a **Speed meter** to see frame rate on your phone. The two keyboard secrets have touch versions: tap the slime's name to call it, and swipe the cheat code on the background.

## What's in the prototype

| Feature | How it plays |
|---|---|
| Egg and hatching | Tap the egg to warm it, cracks spread, it hatches, looks around, then you name it. |
| Boop (the clicker) | Click or tap the slime. It squishes where you poke it and drops jelly. |
| Giggle Fever | Boop in a steady rhythm to fill the giggle meter: inside the pink zone boops pay x2 (x3 with an upgrade). Spam past the top and the slime gets dizzy for a few seconds. |
| Petting | Hold and stroke the slime. It closes its eyes, purrs, leans into your hand, floats hearts. Less jelly than booping, much more joy and bond. |
| Feeding | Drag a snack onto the slime or tap it to toss. It opens wide, chomps, gulps (a bulge travels down), and the snack stays visible inside its jelly body while it digests. |
| Traits | Six channels (Sweet, Warm, Sturdy, Leafy, Zippy, Prismatic). The body color shifts toward what it eats, and at thresholds it grows sprinkles, a flame, iron studs, a leaf sprout, an antenna or crystals. Repeating the same snack shapes it less each time. |
| Tastes | Every slime has a hidden favorite and a disliked snack. You find out by watching its face when you hold a snack near it (sparkly eyes vs. a nervous wobbly mouth). |
| Combos | Two snacks in a row within 8 seconds can form a named combination with a buff. The Journal gives clues. |
| Needs | Tummy, Joy, Energy. Joy multiplies all jelly. When energy runs out it naps (helpers earn extra "dream jelly"). Needs freeze while the game is closed. |
| Requests | The slime asks for a snack, pets, play or a nap. Each answer is valid and nudges personality differently (e.g. "Ask to wait" builds patience). |
| Personality | Curious, Patient, Playful, Cuddly, Bold. Shown as tendencies, never as a good/bad score. It changes idle behavior and request frequency. |
| Bond | Ten levels from Curious Stranger to Forever Family. Each level adds +3% jelly and unlocks a behavior (watches you, leans toward you, greets you with a dance, blows kisses, hums). |
| Helpers | Eight idle producers you can see in the world: orbiting tickle feathers (they really tickle it), bubbles you can pop, planters, hopping slimeling pals, a music box lullaby, moon lamps, a fountain, a telescope. |
| Lucky Glimmers | A golden spark drifts by every few minutes; the slime points it out. Catch it for a Jelly Rush, Sugar Rush or a lump sum. |
| Settled form | At the last stage the two strongest traits lock in a form (Hearth, Furnace, Nectar, Geode, Aurora... 22 in total, including a healthy generalist). |
| Journal | Combos found plus a dated memory log of your life together. |
| Welcome back | Returning after a while: the slime is happy to see you and nothing bad happened. Helper jelly from your time away waits in the Jelly Jar. |
| Jelly Jar | Catches part of what helpers make while you're away: 15% for up to 2 hours at first, up to 30% for 24 hours after four upgrades (in the Upgrades tab). Tap the jar under the jelly count, or "Pour it out" on the welcome screen, to collect it. |
| Upgrades | Every helper has five "twice as good" tiers (at 1, 10, 25, 50 and 100 owned), plus late-game upgrades. Some reward the personal side of the game: Show-Off gives +3% per learned trick, Secret Keeper +2% per secret found. The Upgrades tab shows a breakdown of every bonus. |
| Outfits | Nine dress-up items for head, face and neck, from 1K to 100B jelly. Each slime secretly has a favorite outfit; wearing it keeps them happier. |
| Late game | Two more helpers, the Slime Spa and the Rainbow Arch, plus pricier late upgrades and outfits so there's still something to work toward days after your slime is grown. |
| Dissolving snacks | Eaten snacks sink into the bottom of the belly, soften, crumble, and leave a colored swirl before fading (2 to 6 minutes depending on the snack). What's in the tummy is saved, so it's still there when you come back. The profile tab shows each one's progress. |
| Gestures | Drag off the body to stretch it like taffy. Press and hold for a hug. Rub in circles to melt it. Shake it left and right. Flick sideways to spin it. Boop its sides to tickle, its mouth for a nibble, its eyes (it gets grumpy, then boops you back). Double-tap its head and it offers a high five. |
| Emotes and tricks | The smile button opens Wave, Dance, Kiss, Spin, Peekaboo, Sing. The slime copies you, clumsily at first; after three tries it learns the trick and starts doing it on its own. |
| Little moments | Hiccups after eating fast, a burp when its tummy is full, daydream bubbles about its favorite snack, dreams while napping, a nightcap when asleep, a morning stretch, sleepier at night. |
| Playing with the room | It pops nearby bubbles, swats tickle feathers, slimeling pals hop over to visit, dance breaks to the music box, stargazing with the telescope. |
| Secrets | 14 hidden interactions, each with a clue in the Journal. |

Saving: every few seconds to `localStorage`, and also to the player's private slot in the
artifact's database when it runs on claude.ai (so it follows you across devices).

## Code map

```
index.html            page shell, all CSS (light + dark themes), import map
src/main.js           boot: load save (local + cloud), start the game
src/game.js           coordinator: input -> rules -> reactions, effects, UI
src/behaviors.js      gestures, emotes and tricks, little moments, room play, secrets
src/data/content.js   ALL tuning and content: stages, foods, traits, helpers, upgrades, combos, bond, forms
src/core/sim.js       game rules and save state (no three.js, no DOM)
src/core/requests.js  slime requests
src/core/save.js      local + cloud save
src/core/format.js    number formatting
src/view/slime.js     the slime: CPU soft-body deformation, face patch, accessories, inner snacks
src/view/face.js      canvas-drawn expressions (eyes, mouth, blush, tears, sweat)
src/view/stage.js     renderer, camera, lights, sky, cushion, day/night palettes
src/view/helpers3d.js visible helpers in the world
src/view/models.js    procedural 3D models for snacks/helpers + icon renderer
src/view/egg.js       the egg and hatching shards
src/view/fx.js        sprite particles
src/audio/sfx.js      synthesized sounds and slime "voice" (Web Audio, no files)
src/ui/hud.js         DOM interface
tools/serve.mjs       local dev server
tools/build-web.mjs   builds the installable web app (manifest, icons, offline cache) into docs/
web/                  app icons and the offline service worker template
docs/                 built web app served by GitHub Pages (do not edit by hand; rebuild instead)
tools/economy-sim.mjs economy simulator: plays the real rules as an engaged or casual player and prints milestones
```

The split follows the OOP guide's boundaries: `core/` owns rules and returns result objects,
`view/` only presents, `game.js` sequences the two, and content lives in data so balancing never
touches logic. It ports to Godot cleanly: `content.js` → Resources, `sim.js` → RefCounted domain
classes, `slime.js` → the SlimeAvatar scene.

## Publishing the phone version

After changing anything in `src/` or `index.html`, rebuild and commit `docs/`:

```bash
node tools/build-web.mjs
```

GitHub Pages serves the `docs/` folder on `main`. Each build gets a new version number, so installed copies pick up the update the next time they're opened online.

## Tuning

Check pacing after any change with the simulator:

```bash
node tools/economy-sim.mjs 12 quiet
```

```bash
node tools/economy-sim.mjs 12 casual quiet
```

Current targets: a casual player (about 40 minutes a day) has a grown-up slime on day 2 and is still saving
for the Slime Spa after 12 days; an engaged player (about 80 minutes a day) gets the Party Hat around day 5,
the Crown around day 8 and the Rainbow Arch around day 10.


Everything lives in `src/data/content.js`: `TUNING` (needs decay, giggle window, offline cap,
glimmer and request timing), `STAGES` (growth thresholds, boop power, food price multiplier),
food nutrition/fullness/traits, helper costs and rates, upgrade costs and unlock rules.

## Not in this prototype (from the GDD, deliberately left for later)

Mature futures (placement, auctions, contracts), world conditions and forecasts, breeding/lineage,
automated sporting events, multiple resident slimes.
