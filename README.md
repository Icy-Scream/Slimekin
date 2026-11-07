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
| Two breeds on one body | Every slime is a Curly (a jelly drop with a curl on top) or a Dollop (a soft gummy dome), on one living body: each breed is a recipe of numbers, and growing up only blends them, so the curl or the dome grows in and baby features melt away, never popping. A plain egg hatches a pure Curly or Dollop (about half and half; now and then a surprise Cat-ear or Topknot Dollop), fixed when the egg is made. Grab the curl's tip (or the top of a Dollop's dome) and pull: it follows your finger and boings back. |
| In-betweens and special eggs | A Curly and a Dollop make an in-between in the Nursery (part curl, part dome; only breeding makes these). Cat-ear and Topknot eggs can be bought with pearls in the Nursery (75 pearls, the type guaranteed); they wait in the nest like any Nursery egg. The Wishing Star heirloom makes surprise special Dollops twice as likely. |
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
| The ranch | Grown-up slimes live in a cozy barn. Open the Ranch tab (or tap the pearl counter) and you are in the barn, with one slime at a time on the round show stand. Swipe sideways (or tap ‹ ›) for the next one: it wiggles, burrows into the straw nest in a poof of straw and the next one pops up. Tap or stroke the slime on the stand to pet it, tap its name card for its page. Pearls pop out into the straw; the Pearl Basket at the front right collects them. At home, the Meadow background still shows the ranch hill behind the cushion, where the slimes wander, play and nap in nightcaps after dark. The barn loads in the background a moment after the game starts; tap Ranch before it is in and "Off to the barn" shows at home until it opens (the very first time offline, a toast asks to try again in a moment). |
| The Greenhouse | Home is a cozy glass greenhouse: plank floor, a braided rug, the slime's mossy stump, a potting bench, jars of snacks, hanging plants, a lantern and fairy lights at night, the garden and sky through the glass, fireflies after dark. It blends from day to night when the theme changes. Every save starts there (an old save on the meadow moves there once; one on Classic stays Classic). Helpers you buy stand in the room. |
| Turning the camera | In the Greenhouse, the camera button (top left) steps through Front, Wide, Left and Right, and the game remembers the last one. Drag on the background (not on the slime) to turn the camera around your slime, up and down to look from higher or lower, and pinch with two fingers to come nearer or go farther. It stays inside the room. After you turn it, the button shows a little arrow: tap it to go back to Front. Booping, petting, feeding and everything else work the same from every angle. |
| The meadow | Settings → Background → **Meadow**: home is outdoors: grass, flowers, rolling hills behind the ranch, drifting clouds, trees, and a moon at night. **Classic** turns it all off for the original plain look, with only your slime to look at. The camera stays fixed in both. |
| Status at a glance | The slime's name, a heart that fills up as your bond grows (with the bond level), and three rings for tummy, joy and energy, all in one slim pill at the top. A ring pulses when it runs low, and the slime shows a little "Hungry!", "Sleepy..." or "Lonely..." bubble. Tap the heart or a ring for the details. |
| Menu | Four tabs: Shop (Helpers and Upgrades), Outfits, your slime (its page and the Journal) and Ranch. Shop and your slime's tab switch pages with a toggle at the top of the menu. |
| Moving out (a new generation) | A Settled slime can move to the ranch. That starts a new generation with a new egg: jelly, helpers, upgrades and the Jelly Jar start over; pearls, the ranch, outfits, combos and secrets stay. Each move-out raises the permanent Family Bonus on all jelly: it comes from all the jelly the whole family has ever made (so every slime's jelly counts, and rushing slimes out early no longer pays), and the ranch slime keeps making jelly. The goodbye: it waves, a soap bubble grows around it and floats it up and out of the picture with a trail of sparkles (where a roof is in the picture, it pops in a burst of sparkles first). |
| Pearls | The ranch currency. Ranch slimes make about 4 an hour each (more when happy, so visit and pet them). Pearls pop out into the straw (on the hill: the grass) to pick up, roll into the Pearl Basket, and wait there while you're away. Spend them on more room and a bigger basket. |
| New homes and auctions | Three buyers offer a new home for a ranch slime (a better fit pays more, and it sends postcards with a few pearls for a week), or hold a live auction for usually a bit more. Offers and auctions are fixed for the day. |
| Ranch life (Training Center and trips) | Every ranch slime has five skills (Bounce, Speed, Sturdy, Smarts, Charm), 0 to 5 stars each. Train one from its page (one lesson = one star: 5 to 50 pearls, 20 minutes to 6 hours; it keeps making pearls meanwhile) or send it on a free trip to one of six places the buyers live (1, 3 or 6 hours; the farther ones open with Sturdy). It comes home on its own with pearls in its bag, the next souvenir from that place, a treat for your slime at home and a little story; it can be called home early. Skills help now (more pearls, shorter trips and lessons, slower fading, better offers) and later in contests. Its personality's strongest lean sets what it loves (e.g. Playful: Bounce lessons 25% shorter). One lane and one wagon to start, more for pearls; all three souvenirs from a place make you a Friend of it (its buyer pays 10% more, a postcard with 20 pearls). Real time, so it goes on while the game is closed. |
| The Nursery (breeding) | A little cottage on the ranch. Pick two ranch slimes and they make an egg (25 pearls, ready in an hour, even while the game is closed; each slime can be a parent once a day; up to two eggs wait in the nest). When your slime moves to the ranch you choose which egg comes next: a new egg or a waiting one, even one still warming (it finishes warming on the cushion; taps wait until it is ready). The baby takes after its parents a little (a capped head start in their snack colors and a small personality nudge), but how you raise it decides its form. |
| The egg on the cushion | While an egg waits on the cushion, the Ranch tab stays open: visit, breed, and before it hatches swap it for a Nursery egg ("Put on the cushion"; a plain egg goes to a neighbor family, a Nursery egg goes back to the Nursery). |
| A new home for a baby | A slime that is not grown yet can go to a family that will raise it ("Find ... a new home" in the Slime tab), then the next egg comes (plain or from the Nursery). No pearls and no Family Bonus for a baby; it sends postcards. A baby leaves in the same travel bubble, drifting a little toward its new family. |
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
src/view/body.js      the recipe body's pure math: ring topology (full for the pet, lite for residents), resting shape, curl frame
src/view/scarf.js     the Cozy Scarf's fit (pure math): every frame it follows the body's real outline just under the mouth
src/core/recipe.js    the breeds' recipes and blends (Curly, Dollop, in-betweens, growth), the body's dice (plain, bred, special eggs)
src/view/forms.js     the 22 grown-up form looks: shapes, patterns, props, effects
src/view/ranch.js     the ranch hill behind home in the Meadow background: residents wandering, the basket, the nest
src/view/scenery.js   the meadow around home (grass, hills, clouds, flowers, trees, moon); off with the Classic background
src/view/greenhouse.js the Greenhouse room (baked outside the repo into src/assets/greenhouse/): room, sky, glass, night glows
src/view/greenhouse-math.js  Greenhouse math without three.js: ground, roof, camera limits and turning, pal hops, spot check
src/greenhouse-home.js which background home shows (Greenhouse / Meadow / Classic) and the camera you can turn
src/ui/camera-button.js the Greenhouse camera button
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
src/ui/eggs.js        special eggs in the Nursery, a Nursery egg's title, the Breed line on your slime's page
tools/serve.mjs       local dev server
tools/build-web.mjs   builds the installable web app (manifest, icons, offline cache) into docs/ (or the folder given)
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
tools/greenhouse-test.mjs  Greenhouse check in plain node (the room's files, helper spots on High and Low, pal hops, camera limits, the move of old saves)
tools/greenhouse-smoke.cjs headless Greenhouse test with real touches (every angle day and night, drag, pinch, petting, menu sheet, Settings, ranch, helpers, egg)
tools/greenhouse-offline.cjs each asset folder's own offline cache (the room, the barn) across test builds in tools/out/web-test (never docs/)
tools/home-load-smoke.cjs  the game's start on a cold load with the room's files late or missing: no other scene before the Greenhouse, the cross-fade past the wait, offline; --film for a filmstrip, --only=cold for the start time
tools/greenhouse-samples.cjs contact sheet of the new slime body in the Greenhouse (four bodies, Front vs the Meadow, Wide, Left, outfits, eggs, the Cuddly sign)
src/assets/greenhouse/ the baked room (made outside this repo; do not edit by hand)
src/assets/barn/      the baked barn for the ranch (made in Blender outside this repo; loaded ahead of time, after home shows)
src/view/barn.js      the Barn ranch's 3D: the barn, sky, glows, the slime on the stand, the burrow swap, straw, nest, pearls
src/view/barn-math.js the Barn ranch's plain math (swap pose curve, order and wrap, swipe, name card line, framing, spots)
src/barn-ranch.js     the Barn ranch: who is on the stand, swaps, touch, the name card, fitting it above the menu
src/ui/barn-card.js   the Barn ranch's name card and ‹ › buttons, and the "Off to the barn" loading moment
tools/barn-test.mjs   Barn ranch check in plain node (the barn's files, the swap curve, the order, the card, the spots)
tools/barn-smoke.cjs  headless Barn ranch test with real touches (swipes, petting, the card, Ranch life, pearls, Nursery, Low, slow and failed loads)
tools/barn-start-probe.cjs the game's start measured with the barn loading ahead of time (and an older copy with --before)
src/send-off.js       the goodbye's travel bubble (moving out, a baby's new home): wave, bubble, float or pop
src/view/travel-bubble.js the soap bubble itself, drawn in code (thin-film rim, glints, wobble; one pass on Low)
src/view/bubble-math.js the bubble's plain math: its size, the float path, what the camera sees of it, the pop rule
tools/bubble-test.mjs the bubble's math in plain node (size, path, the rule for every camera angle, turned cameras)
tools/send-off-smoke.cjs headless send-off in every Background and camera angle: the bubble never meets anything drawn
src/core/medals.js    which medal a slime has (from the jelly it made)
src/core/heirlooms.js heirloom effects over the save (multipliers, starting helpers)
src/core/movingday.js the Moving Day ratio, its levels and which sign a slime shows
src/core/ranch-life.js ranch life rules: skills, lessons, lanes, trips, wagons, souvenirs, Friend of, treats, time while closed
src/ui/ranch-life.js  ranch life menus: a resident's skills and pickers, the Ranch life row, the return card (plain cards)
tools/ranch-life-test.mjs ranch life rules check in plain node (lessons, trips, rewards fixed at departure, old saves)
tools/ranch-life-smoke.cjs headless ranch life play-through from an old save (train, trip, close and reopen, refusals)
tools/pearl-sim.mjs   pearl simulator: 30 days of the ranch with and without ranch life, against the design targets
src/moving-day.js     plays the Moving Day signs (built from what the slime already does) and the travel bundle
src/view/medal-pin.js the small medal pin on a grown slime's chest (placeholder, drawn from the emoji)
UI-CHANGES.md             every on-screen element the breeding work added or changed (for the UI branch)
tools/fixtures/       old saves made with the code from before breeding (tools/fixtures/make-old-saves.mjs) and from
                      just before the jelly loop, plus the Moving Day tester save (tools/fixtures/make-jelly-loop-saves.mjs)
tools/render-samples.cjs  renders looks day and night and builds labeled contact sheets
tools/recipe-test.mjs     recipe body check in plain node (recipes, blends, body points, the body's dice, special eggs, old saves,
                          the scarf's fit on every body; that last part needs three.js, as the browser tests do)
tools/recipe-smoke.cjs    headless recipe body play-through (a Curly, a Cat-ear Dollop, an in-between; real touch pulls; the ranch)
tools/recipe-samples.cjs  recipe body contact sheets (stages, in-betweens, outfits, the scarf, forms, ranch, Nursery) and its cost
                          (perf.json)
src/platform/index.js the iPhone app's seam (Capacitor): isNative, save backup, haptics; a no-op on the web
tools/build-ios.mjs   builds native/www/ for the iPhone app (offline: three.js and fonts copied in), then runs the gate
tools/check-ios-www.mjs   gate for native/www/: no links, no network calls in the game code (only the room's reads of its own
                          bundled files), every import resolves
tools/platform-test.cjs   headless test of src/platform/ with a fake Capacitor and without one
src/core/save-check.js the shape a save must have (checkSave, readSave), number repair (num) and the save code's text
src/core/save.js      the save on this device: slimekin.save.v1, .prev (the previous good save), .broken (a save that
                      could not be read, kept); loadBoot picks the best readable one
src/ui/notice.js      the save safety cards (start-up snag, hiccup, lost picture, unreadable save), plain DOM
tools/save-safety-test.mjs save safety in plain node: broken saves and backups, .prev, save codes, number repair
tools/health-smoke.cjs    save safety in the real game at 375 px, a screenshot of every card and toast (tools/out/health/)
tools/check-store-pages.mjs  App Store pages (web/pages/) ready to submit? (only before a submission)
native/               the iPhone app (Capacitor 8): MAC-GUIDE.md, mac-build.sh, APP-STORE-NOTES.md, the Xcode
                      project in native/ios/, its settings as code in native/tools/ (patch-ios, check-ios)
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
Each folder under `src/assets/` (the Greenhouse room, the barn: about 3.3 MB each) sits in its own offline cache named
by the folder and a hash of its files, outside the core list, so an update that doesn't change a folder doesn't
download it again. To try a build without touching `docs/`, give it another
folder: `node tools/build-web.mjs tools/out/web-test` (and `node tools/greenhouse-offline.cjs` checks the cache).

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

The Greenhouse: `GREENHOUSE` in `content.js` holds the slime's lights in the room (day and night), the ground (stump, rug,
floor), the four camera angles and the camera's limits, how far a drag or a pinch turns it, and where each helper
stands. `node tools/greenhouse-test.mjs` checks it (move a helper spot, then run it).

The Barn ranch: `BARN` in `content.js` holds the burrow swap's timings and shape, the straw counts for High and Low
graphics, the swipe, the name card's dot limit, the Nursery nest's spot, where pearls land and how the stand is framed
above the menu. The barn itself (its camera, stand, lanterns, basket) is the bake in `src/assets/barn/barn.json`.
`node tools/barn-test.mjs` checks both (move the nest, then run it).

The jelly loop (all in `content.js`, checked by `node tools/jelly-loop-test.mjs`):

| What | Where | Now |
| --- | --- | --- |
| Family Bonus | `RANCH.bonusPercent`, `RANCH.bonusJelly` | `5 * cbrt(family lifetime jelly / 1e7)` percent, recomputed at each move-out, never lower |
| Medals | `MEDALS` | jelly steps (1B ... 10Q), ranch pearls x1 ... x3, buyer offers +0 ... +100% |
| Heirlooms | `HEIRLOOMS` | price (10M ... 1Q), effect (`fx`), where it lives; `buyable: false` for ones not for sale yet |
| Heirloom tab | `HEIRLOOM_TAB` | icon, how many unowned ones show their price (3) |
| Moving Day | `MOVING_DAY.levels` | ratio steps 1.5 / 2 / 3 and seconds between signs at each (`every`), travel bundle chance |
| Moving Day signs | `MOVING_DAY.signs` | one per personality lean: length, turn toward the hill, hops, distance |

Ranch life (all in `RANCH_LIFE` in `content.js`, checked by `node tools/ranch-life-test.mjs`; balance with
`node tools/pearl-sim.mjs`, which plays 30 days as an engaged, casual and spamming player with and without it):

| What | Where | Now |
| --- | --- | --- |
| Skills | `RANCH_LIFE.skills` | per star: Bounce +3% pearls, Speed trips 6% shorter, Sturdy fades 5% slower (and opens trips), Smarts lessons 5% shorter and trips +5% pearls, Charm offers +4% |
| Lessons | `RANCH_LIFE.lesson` | 5 / 10 / 20 / 35 / 50 pearls, 20 min / 45 min / 1.5 h / 3 h / 6 h, +10 happiness |
| Lanes, wagons | `RANCH_LIFE.lanes`, `.wagons` | 1 each; more for 60 / 150 and 80 / 200 pearls |
| Trips | `RANCH_LIFE.trip`, `.places` | +10 happiness home; 3-hour places at Sturdy 1, 6-hour at Sturdy 3; six places, 3 souvenirs each, story lines |
| Loves | `RANCH_LIFE.loves` | one per personality lean (the Moving Day sign ids) |
| Treat, Friend of | `RANCH_LIFE.treat`, `.friend` | joy +8, bond +2 for the slime at home; Friend of: offers +10%, 20 pearls once |

To try the Moving Day signs: open with `#debug`, Settings shows each sign's button and where this slime is; or load
`tools/fixtures/moving-day-almost.json` (a slime just under "ready" that gets there after a few minutes of play).

The recipe body (all in `BREEDS` in `content.js`, checked by `node tools/recipe-test.mjs`):

| What | Where | Now |
| --- | --- | --- |
| Curly growth | `BREEDS.curly.grow` | each body number from baby to grown (`[baby, grown]`), the curl's size, bend and length |
| Dollop growth | `BREEDS.dollop.variants` | plain, Cat-ear and Topknot: baby, teen and grown recipes (bumps, ears and knobs) |
| Growth per stage | `BREEDS.stageM`, `growEase`, `mixEase` | shape number 0 / 0.35 / 0.65 / 1 for the four stages; how fast the body eases |
| Plain eggs | `BREEDS.hatch`, `BREEDS.surprise` | Curly / Dollop 50 / 50; a surprise Cat-ear or Topknot in 1 of 20 Dollop hatches (x2 with the Wishing Star) |
| Bred eggs | `BREEDS.mixBetween`, `passSpecial`, `geneWobble` | Curly x Dollop: mix 0.25 ... 0.75; ears or a topknot pass on half the time; genes average plus a small wobble |
| Genes | `BREEDS.geneRange` | how far a slime's own quirks (taller, wider, lumpier, a lean) can go |
| Special eggs | `BREEDS.specialEggs` | name, price (75 pearls), egg colors, the line under it in the Nursery |

To try it: open with `#debug`; Settings → Body sets this slime's breed, variant and mix (and the egg's, while it waits).

## Not in this prototype (from the GDD, deliberately left for later)

More family sparks, rare and lucky eggs, and rewards for special slimes (later breeding slices),
contests and slime battles, world conditions and forecasts, contracts.
