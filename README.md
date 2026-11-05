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

The game is published at **https://icy-scream.github.io/Slimekin/** (GitHub Pages, built from `docs/`).

1. Open that link in Safari on the iPhone.
2. Tap the Share button, then **Add to Home Screen**. It gets its own icon, opens full screen, and works offline after the first visit.
3. To bring a slime over from another device (for example the claude.ai version): on the old device open Settings, **Copy save code**; on the phone open Settings, **Load a save code**, paste, Load.

Phone notes: swipe the menu down (or its grip bar) to close it; drag a notification up or down to move them, tap or swipe one sideways to dismiss it. The game is portrait-only (turning sideways shows a reminder), runs at 60 fps and drops to 30 fps when nothing is happening to save battery, and lowers graphics quality on its own if a device struggles. Settings has a **Speed meter** to see frame rate on your phone. The two keyboard secrets have touch versions: tap the slime's name to call it, and swipe the cheat code on the background.

## What's in the prototype

| Feature | How it plays |
|---|---|
| Egg and hatching | Tap the egg to warm it, cracks spread, it hatches, looks around, then you name it. |
| Boop (the clicker) | Click or tap the slime. It squishes where you poke it and drops jelly. |
| Giggle Fever | Boop in a steady rhythm to fill the giggle meter: inside the pink zone boops pay x2 (x3 with an upgrade). Spam past the top and the slime gets dizzy for a few seconds, so a steady rhythm earns more than tapping as fast as you can. A worn-out slime gives little jelly, naps, and can't be poked awake until it has rested a bit. |
| Petting | Hold and stroke the slime. It closes its eyes, hums happily, leans into your hand, floats hearts. Less jelly than booping, much more joy and bond. The happy hum while petting can be turned off in Settings. |
| Feeding | Drag a snack onto the slime or tap it to toss. It opens wide, chomps, gulps (a bulge travels down), and the snack stays visible inside its jelly body while it digests. |
| Traits | Six channels (Sweet, Warm, Sturdy, Leafy, Zippy, Prismatic). The body color shifts toward what it eats, and at thresholds it grows sprinkles, a flame, iron studs, a leaf sprout, an antenna or crystals. Repeating the same snack shapes it less each time. |
| Tastes | Every slime has a hidden favorite and a disliked snack. You find out by watching its face when you hold a snack near it (sparkly eyes vs. a nervous wobbly mouth). |
| Combos | Two snacks in a row within 8 seconds can form a named combination with a buff. The Journal gives clues. |
| Needs | Tummy, Joy, Energy. Joy multiplies all jelly. When energy runs out it naps (helpers earn extra "dream jelly"). Needs freeze while the game is closed. |
| Requests | The slime asks for a snack, pets, play or a nap. Each answer is valid and nudges personality differently (e.g. "Ask to wait" builds patience). |
| Personality | Curious, Patient, Playful, Cuddly, Bold. Shown as tendencies, never as a good/bad score. It changes idle behavior and request frequency. |
| Bond | Ten levels from Curious Stranger to Forever Family. Each level adds +3% jelly and unlocks a behavior (watches you, leans toward you, greets you with a dance, blows kisses, hums). It grows from caring (petting, favorite snacks, requests, combos, coming back), barely from booping, and deeper levels take longer: the first few come in the first session, Soulbound takes about two weeks. |
| Helpers | Eight idle producers you can see in the world: orbiting tickle feathers (they really tickle it), bubbles you can pop, planters, hopping slimeling pals, a music box lullaby, moon lamps, a fountain, a telescope. |
| Lucky Glimmers | A golden spark drifts by every few minutes; the slime points it out. Catch it for a Jelly Rush, Sugar Rush or a lump sum. |
| Settled form | At the last stage the two strongest traits lock in a form (Hearth, Furnace, Nectar, Geode, Aurora... 22 in total, including a healthy generalist). |
| Journal | Combos found plus a dated memory log of your life together. |
| The menu on phones | A bottom sheet: drag it up (grip, tab bar, or the list) to a tall size under the top bar, down to normal and closed. |
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
| Grown-up forms | All 22 Settled forms have their own look on top of the diet color: a body shape (teardrop, blocky, lumpy...), a pattern (candy stripes, flames, rivets, circuits...), props (a beating heart inside, amethyst clusters, a chimney, a sunflower, a bee or ladybug friend...) and little effects. Head props hide under hats (spark forms keep theirs and the hat sits on top). |
| The ranch | A grassy hill behind the cushion where grown-up slimes live. Open the Ranch tab and the camera flies over; tap a slime to visit it up close and stroke it to pet it. They wander, play, and nap in nightcaps after dark. |
| The meadow | Home is outdoors: grass, flowers, rolling hills behind the ranch, drifting clouds, trees, and a moon at night. Settings → Background → **Classic** turns it all off for the original plain look, with only your slime to look at. |
| Moving out (a new generation) | A Settled slime can move to the ranch. That starts a new generation with a new egg: jelly, helpers, upgrades and the Jelly Jar start over; pearls, the ranch, outfits, combos and secrets stay. Each move-out raises the permanent Family Bonus on all jelly: it comes from all the jelly the whole family has ever made (so every slime's jelly counts, and rushing slimes out early no longer pays), and the ranch slime keeps making jelly. |
| Pearls | The ranch currency. Ranch slimes make about 4 an hour each (more when happy, so visit and pet them). Pearls pop out into the grass to pick up, roll into the Pearl Basket, and wait there while you're away. Spend them on more room and a bigger basket. |
| New homes and auctions | Three buyers offer a new home for a ranch slime (a better fit pays more, and it sends postcards with a few pearls for a week), or hold a live auction for usually a bit more. Offers and auctions are fixed for the day. |
| The Nursery (breeding) | A little cottage on the ranch. Pick two ranch slimes and they make an egg (25 pearls, ready in an hour, even while the game is closed; each slime can be a parent once a day; up to two eggs wait in the nest). When your slime moves to the ranch you choose which egg comes next: a new egg or a waiting one, even one still warming (it finishes warming on the cushion; taps wait until it is ready). The baby takes after its parents a little (a capped head start in their snack colors and a small personality nudge), but how you raise it decides its form. |
| The egg on the cushion | While an egg waits on the cushion, the Ranch tab stays open: visit, breed, and before it hatches swap it for a Nursery egg ("Put on the cushion"; a plain egg goes to a neighbor family, a Nursery egg goes back to the Nursery). |
| A new home for a baby | A slime that is not grown yet can go to a family that will raise it ("Find ... a new home" in the Slime tab), then the next egg comes (plain or from the Nursery). No pearls and no Family Bonus for a baby; it sends postcards. |
| Family sparks | Some parent pairs share a family spark: their egg twinkles, and a baby raised on the right snacks grows into a form only they can pass on: S'more (Hearth × Marshmallow), Honeycomb (Nectar × Candy), Campfire (Hearth × Root), Storm (Aurora × Volt). Raised differently, it grows into a normal form and the Journal keeps a clue. |
| Pure slimes | Two parents of the same form, and a baby that grows up the same way, make a Pure version of any of the 22 forms: brighter colors, a soft shimmer and twinkling sparkles. |
| Slime medals | A grown slime earns medals from the jelly it made itself: the Grown-Up Ribbon when it settles, then Bronze (1B), Silver, Gold, Platinum, Emerald, Diamond, Obsidian and Nova (10Q), every x10. Each one is a little ceremony and a Journal line; the medal shows by its name, on a small pin on its chest, on the ranch and in the family tree. On the ranch a medal makes more pearls (up to x3) and buyers pay more (up to +100%). |
| Heirlooms | Family treasures bought with jelly in their own tab (the chest; it glows when a new one becomes affordable). They stay forever and help every slime after: starting helpers, cheaper snacks, bigger Glimmers, a jar that keeps its size, more pearls, faster Nursery eggs, happier ranch slimes, better offers. Spending jelly never lowers the Family Bonus. |
| Moving Day signs | When moving out would make the next baby's jelly grow much faster, a grown slime starts showing it in its own way (a curious one gazes at the ranch hill, a cuddly one brings you a snack to share...). No text, no numbers, nothing happens if you ignore it; the Journal has one clue. |
| Family tree | A Journal page with your slime, its two parents and its generation, the spark forms found (silhouettes for the ones not found yet, clues for the ones you have seen) and the Pure forms raised. |

Saving: every few seconds to `localStorage`, and also to the player's private slot in the
artifact's database when it runs on claude.ai (so it follows you across devices).

## Code map

```
index.html            page shell, all CSS (light + dark themes), import map
src/main.js           boot: load save (local + cloud), start the game
src/game.js           coordinator: input -> rules -> reactions, effects, UI
src/behaviors.js      gestures, emotes and tricks, little moments, room play, secrets
src/data/content.js   ALL tuning and content: stages, foods, traits, helpers, upgrades, combos, bond, forms
src/core/sim.js       game rules and save state (no three.js, no DOM), including moving to the ranch
src/core/ranch.js     ranch rules: pearls, basket, slots, happiness, new homes, auctions, postcards, the Nursery
src/core/breeding.js  breeding rules: making an egg, what a baby inherits (capped), family sparks, Pure forms
src/core/random.js    seeded dice (the same egg, offer or auction every time it is reopened)
src/core/requests.js  slime requests
src/core/save.js      local + cloud save
src/core/format.js    number formatting
src/view/slime.js     the slime: CPU soft-body deformation, face patch, accessories, inner snacks
src/view/forms.js     the 22 grown-up form looks: shapes, patterns, props, effects
src/view/ranch.js     the ranch hill: scenery, wandering residents, pearls, basket, visit cameras
src/view/scenery.js   the meadow around home (grass, hills, clouds, flowers, trees, moon); off with the Classic background
src/view/face.js      canvas-drawn expressions (eyes, mouth, blush, tears, sweat)
src/view/stage.js     renderer, camera, lights, sky, cushion, day/night palettes
src/view/helpers3d.js visible helpers in the world
src/view/models.js    procedural 3D models for snacks/helpers + icon renderer
src/view/egg.js       the egg and hatching shards
src/view/egg-spark.js the twinkle (and warm night glow) on an egg with a family spark
src/view/fx.js        sprite particles
src/audio/sfx.js      synthesized sounds and slime "voice" (Web Audio, no files)
src/ui/hud.js         DOM interface
src/ui/icons.js       drawn icons (sparkle, heart, Journal memory icons, little slime drawings) used instead of emoji
tools/serve.mjs       local dev server
tools/build-web.mjs   builds the installable web app (manifest, icons, offline cache) into docs/
web/                  app icons and the offline service worker template
docs/                 built web app served by GitHub Pages (do not edit by hand; rebuild instead)
tools/economy-sim.mjs economy simulator: plays the real rules as an engaged or casual player and prints milestones
tools/smoke-test.cjs  headless phone-sized play-through (hatch, grow up, ranch, move out); setup notes inside
tools/breeding-smoke.cjs  headless breeding play-through from an old save (Nursery, spark egg, S'more, Pure)
tools/playtest-smoke.cjs  headless test of the playtest fixes: menu sheet drags (real touch), warming egg, egg swap, a baby's new home
tools/browser-kit.cjs     shared setup for the browser tests (free port, offline, step deadlines, stall notes)
tools/breeding-test.mjs   breeding rules check in plain node (caps, seeds, sparks, Pure, cooldowns, old saves, cushion egg, new homes)
tools/jelly-loop-test.mjs jelly loop rules check in plain node (Family Bonus and old saves, medals, heirlooms, Moving Day)
tools/jelly-loop-smoke.cjs headless jelly loop play-through from an old save (heirlooms, medals, move-out screen, every sign)
src/core/medals.js    which medal a slime has (from the jelly it made)
src/core/heirlooms.js heirloom effects over the save (multipliers, starting helpers)
src/core/movingday.js the Moving Day ratio, its levels and which sign a slime shows
src/moving-day.js     plays the Moving Day signs (built from what the slime already does) and the travel bundle
src/view/medal-pin.js the small medal pin on a grown slime's chest (placeholder, drawn from the emoji)
UI-CHANGES.md             every on-screen element the breeding work added or changed (for the UI branch)
tools/fixtures/       old saves made with the code from before breeding (tools/fixtures/make-old-saves.mjs) and from
                      just before the jelly loop, plus the Moving Day tester save (tools/fixtures/make-jelly-loop-saves.mjs)
tools/render-samples.cjs  renders looks day and night and builds labeled contact sheets
AGENTS.md, CLAUDE.md  hand-off guide for coding agents (how it ships, how to test, gotchas, roadmap)
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

To see how a second generation plays, after a slime that made 1 billion jelly moved to the ranch:

```bash
node tools/economy-sim.mjs 4 casual quiet gen2=1e9
```

Current targets: a casual player (about 40 minutes a day) has a grown-up slime on day 2 and is still saving
for the Slime Spa after 12 days; an engaged player (about 80 minutes a day) gets the Party Hat around day 6,
the Crown around day 10 and the Rainbow Arch around day 12. Tapping as fast as possible (`spam`) should never beat a normal player:

```bash
node tools/economy-sim.mjs 2 quiet spam
```


Everything lives in `src/data/content.js`: `TUNING` (needs decay, giggle window, offline cap,
glimmer and request timing), `STAGES` (growth thresholds, boop power, food price multiplier),
food nutrition/fullness/traits, helper costs and rates, upgrade costs and unlock rules, and `BREEDING`
(egg cost, timer, how much a baby inherits) with `SPARK_FORMS` (one entry per family spark).

Breeding: `node tools/breeding-test.mjs` checks the rules. A bred baby compared with a plain one (the only
difference is the favorite snack it may inherit):

```bash
node tools/economy-sim.mjs 4 casual quiet gen2=1e9 bred
```

The jelly loop (all in `content.js`, checked by `node tools/jelly-loop-test.mjs`):

| What | Where | Now |
| --- | --- | --- |
| Family Bonus | `RANCH.bonusPercent`, `RANCH.bonusJelly` | `5 * cbrt(family lifetime jelly / 1e7)` percent, recomputed at each move-out, never lower |
| Medals | `MEDALS` | jelly steps (1B ... 10Q), ranch pearls x1 ... x3, buyer offers +0 ... +100% |
| Heirlooms | `HEIRLOOMS` | price (10M ... 1Q), effect (`fx`), where it lives; `buyable: false` for ones not for sale yet |
| Heirloom tab | `HEIRLOOM_TAB` | icon, how many unowned ones show their price (3) |
| Moving Day | `MOVING_DAY.levels` | ratio steps 1.5 / 2 / 3 and seconds between signs at each (`every`), travel bundle chance |
| Moving Day signs | `MOVING_DAY.signs` | one per personality lean: length, turn toward the hill, hops, distance |

To try the Moving Day signs: open with `#debug`, Settings shows each sign's button and where this slime is; or load
`tools/fixtures/moving-day-almost.json` (a slime just under "ready" that gets there after a few minutes of play).

## Not in this prototype (from the GDD, deliberately left for later)

More family sparks, rare and lucky eggs, and rewards for special slimes (later breeding slices), the Training
Center and trips, contests and slime battles, world conditions and forecasts, contracts.
