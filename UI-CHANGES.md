# UI changes (for the UI branch)

Every on-screen element the breeding core and the playtest fixes added or changed, so a separate UI pass can
restyle them. Game UI facts only: element ids and classes, where each one shows, and which pieces are placeholders
(emoji or CSS drawings) waiting for real art. All CSS lives in `index.html`; the markup is built in
`src/ui/hud.js` (menu tabs) and `src/game.js` (modals, toasts, the egg hint).
Since the S1 split, the menu pages are in `src/ui/panels/` (one file per page) and game.js's cards, toasts and the
egg hint are in `src/game/` (one file per subject); the names below (renderRanch, askMoveOut, ...) are unchanged,
and the lists at the top of hud.js and game.js say which file holds which.

Already on `main` too: on a 393 px wide phone the tab label "Upgrades" is cut off ("Upgra...": 58 px of room for
61 px of text).

## Breeding core

### Ranch tab (`#body-ranch`)
- Nursery card on the ranch page: `.card.nursery-card` with "Open the Nursery" (`button[data-act="nursery"]`).
- The Nursery page (same tab, when `game.ranchPage === 'nursery'`):
  - back link `#nurseryBack` ("← Back to the ranch"), a header card (pearls, cost, timer).
  - "Waiting eggs": one `.card.egg-card` per egg (`.egg-card.spark` for a spark egg) with `.egg-row`, the egg icon
    `.egg-ic` (a CSS-drawn egg; spot colors from `--a` / `--b`; `.egg-ic.spark` adds a twinkling ✦ text star:
    **placeholder**), a progress `.meter` while warming, `.spark-line` text (✦ glyph, gold), a Pure line, and
    "Give to a neighbor" (`button[data-act="giveEgg"]`).
  - "Pick two parents": `.parent-grid` of `.parent-pick` buttons (`aria-pressed`; the picked mark is a ♥ glyph via
    `::after`: **placeholder**; "Resting today" when disabled), the message `#breedMsg`, and
    `#breedBtn` "Make an egg · (pearl) 25".
- Residents' cards: "Child of X and Y" on a resident's page.
- 3D (ranch scene, `src/view/ranch.js`): the Nursery cottage with a straw nest in front, eggs waiting in the nest
  (spot colors from the parents, a twinkle on spark eggs); tapping the cottage opens the Nursery.

### Move-out modal
- "Which egg comes next?": `.egg-choice` (`role="radiogroup"`) of `.card.choice` buttons (`role="radio"`,
  `aria-checked`): "A new egg" and one per Nursery egg (egg icon `.egg-ic`, parents' names, a note).

### Egg on the cushion (3D)
- A bred egg has its parents' spot colors; a spark egg has a twinkling star with a trail and a warm night glow
  (`src/view/egg-spark.js`).

### Slime tab (`#body-slime`)
- "Family" card: "Child of X and Y", the form pair, the head start in words.
- `.spark-line` lines: "✦ A family spark glows in ...", "✦ Something sparkly is stirring inside ...", a Journal clue
  line; a Pure line.

### Journal tab (`#body-journal`)
- Page switch `.seg.journal-seg` with `button[data-jp="notes"]` (Notes) and `button[data-jp="family"]`
  (Family tree), 44 px tall.
- Family tree page: `.card.tree` with `.tree-parents`, `.tree-node` (`.me`, `.parent`, `.unknown`, `.pure`,
  `.spark`), the slime blob `.blob` (CSS-drawn, color from `--c`; `.blob.silhouette` with "?"), `.tree-heart`
  (♥ glyph: **placeholder**), `.tree-line`, `.tree-note`.
- "Spark forms" list: `.combo.spark-entry` rows; the found ones show their icon in a `.blob`: 🍫 S'more,
  🍯 Honeycomb, 🔥 Campfire, 🌈 Storm (emoji: **placeholders**); unknown and seen ones show a silhouette.
- "Pure forms": `.badge.pure-badge` chips ("✦ Pure Candy Slime", ✦ glyph: **placeholder**).
- "Families on the ranch" card.
- Journal memory icons used by breeding: 🥚 ✦ 💌 🏡 (emoji: **placeholders**).

### Grown-up looks (3D)
- Four spark forms (`spark:smore`, `spark:honeycomb`, `spark:campfire`, `spark:storm`) and a Pure version of all
  22 forms (richer colors, a drifting shimmer, a golden sheen, twinkling gold stars).

### Toasts
- "A new egg in the Nursery", "A twinkly egg!", "Off to a loving home".

### Debug only (`#debug`)
- Settings → Debug: "+1T jelly", "+100 pearls", "Instant eggs: On/Off".

## Playtest fixes 1

### Phone menu sheet (`#panel`, phones <= 860 px)
- New size state: `.panel.open.tall`, height from the CSS variable `--sheet-tall` (set by `hud.js`
  `measureTall()`: from just under the top HUD bar `.top` to the bottom of the screen). `.panel.open` alone is the
  normal size, as before. `.panel.instant` turns the snap animation off (reduced motion).
- The grip `#sheetGrip` now says "Drag up to see more, down to close" (`aria-label`). Gestures: drag up from the
  grip, the tab bar or the list (at normal) to stretch it; drag down to go tall → normal → closed; a tap on the grip
  closes it. It always opens at normal.
- Room for the UI pass: there is no visible hint yet that the sheet can be stretched (only the grip).

### While an egg waits on the cushion
- The menu shows only the Ranch tab when the family has ranch slimes or Nursery eggs: `#ui.egg.has-ranch`
  (`#ui.egg .tab:not([data-tab="ranch"])` hidden; the tab bar is one wide column). The ranch works as usual there,
  with the `#ranchBar` ("Back home"); `body.at-ranch` hides the egg hint.
- Egg hint `#eggHint`: the title has an id now, `#eggTitle` ("Something's wiggling" / "Still warming"); `#eggText`
  shows the countdown ("Ready in 38 min. It can finish warming right here."); `.egg-hint.warming` paints the bar in
  calm blue-pink while it shows the time. New link button `#eggAlt` (`.link-btn.egg-alt`, 44 px tall): "Want a
  Nursery egg instead? Open the Nursery", shown while the Nursery has eggs. On phones the hint sits a little higher
  when the Ranch tab is there (`#ui.egg.has-ranch ~ .egg-hint`).
- 3D: a small "not yet" shake when a warming egg is tapped, and a sparkle when it becomes ready.

### Move-out modal
- Every Nursery egg can be chosen now. A warming one: `.card.choice.warming` (no style of its own yet), note
  "Still warming: ready in 38 min, it can finish on the cushion".

### Nursery egg cards
- Action row `.egg-acts`: "Put on the cushion" (`button[data-act="cushion"]`, primary; only while an egg waits on
  the cushion) and "Give to a neighbor".
- Confirm modal: "Put X and Y's egg on the cushion?" with "Not now" `#cuNo` and "Put it on the cushion" `#cuYes`.

### Slime tab: a baby's new home
- While Hatchling, Sprout or Rascal: `.card.rehome-card` "Raising a different egg?" with the button
  `#slimeRehome` "Find {name} a new home" (not primary).
- Confirm modal "A new home for {name}?": the family's name, the egg choice (`.egg-choice`, as at move-out), a
  "No pearls for a baby" card, what you keep and what starts over; "Keep {name}" `#rhNo`, "Find a new home"
  `#rhYes`.
- The goodbye (3D): the menu closes, hearts, a wave and "Bye-bye! I'll write to you! ♥", hops off to the right.
- After the reload: the card "{name} has a new home!" (shared `showSimple` modal).
- Ranch tab, "Living elsewhere": a baby's row says "{family} · growing up there".

### Ranch resident page
- The "Pearls" stat reads "+3.7/hour" (was "~3.7/hour": in the rounded font the "~" read as a minus sign). The rate
  is never below zero.

### Toasts
- "Not yet! This egg is still warming. Ready in 12 min.", "The egg is ready! Tap it to keep it warm.",
  "{X and Y}'s egg is on the cushion" (after a swap), a baby's postcard (no "pearls tucked inside" line).

## UI pass 1 (done, on `main`)

What the UI pass restyled from the lists above, and what it added. Keep using these when adding UI.

- **Drawn icons** (`src/ui/icons.js`, inline SVG, class `.gi`): `ICON.sparkle`, `ICON.heart`, `ICON.hourglass`,
  `memIcon(emoji, fallback)` for Journal memories (all 19 memory emoji used by the game have a drawing; an
  unknown emoji falls back to itself, so old saves keep working), `slimeArt(color | [a, b], motif)` (a small
  slime; two colors split diagonally for a pair form; motifs `smore`, `honeycomb`, `campfire`, `storm`) and
  `slimeUnknown()` (dashed silhouette with "?").
- Replaced placeholders: every `✦` in `.spark-line` text and Pure badges → `ICON.sparkle`; `.tree-heart` ♥ →
  `ICON.heart` (gently beating); family tree `.blob` and the spark-form list's emoji (🍫 🍯 🔥 🌈, still in
  `content.js`, now unused by the screen) → `slimeArt`; unknown/seen spark forms and unknown parents →
  `slimeUnknown`; the secrets list ✦ → `ICON.sparkle`; resident story lines use `memIcon` too.
- CSS-only art (data-URI SVG backgrounds in `index.html`): `.egg-ic.spark` sparkle, `.parent-pick` picked heart,
  the checked badge on `.card.choice[aria-checked="true"]`, the hourglass on `.card.choice.warming` (now dashed,
  blue-pink, the egg wobbles), the letter on `.rehome-card` (soft pink), and the grip arrow.
- `.egg-ic` has a glossy highlight; `.egg-card.spark` gets a gold glow.
- Phone menu: the grip shows a small arrow (up at normal size, down when tall) that nudges twice when the sheet
  opens: the visible hint that the sheet stretches.
- Tabs have icons (`.tab .ti` + label `.tab .tl`; the Slime tab's label is the slime's name: update `.tl`, not the
  button text). Phone tab text is 11 px so "Upgrades" fits at 393 px.
- Need bars show their icons on small phones again.
- Background setting (Settings → Background: Meadow / Classic, `settings.scene`): `src/view/scenery.js` draws the
  meadow (grass, hills, clouds, flowers, trees, moon); Classic turns it off and brings back the original plain
  floor and sky (`stage.setClassic`), and the ranch hill only shows while visiting it.
- Phones: when the menu is open at normal size the camera zooms out so the slime stays visible above it
  (`stage.fitZoom`, set in `game.computeViewGoal`; a tall sheet leaves the scene alone).

## UI pass 2 (status pill, four tabs)

- **Top-left status** is one slim pill (`.slime-card`): the name (`#nameBtn`, tapping it still calls the slime), the
  stage pill (wider screens only), the bond heart `#bondBtn` (fills toward the next level via `#bondFill`, the clip
  rect's `y`; the level number is `#bondLv`, the title stays in `#bondTitle` for screen readers), three need rings
  `#needTummy` / `#needJoy` / `#needEnergy` (`.need` buttons; the colored arc is `#tummyFill` etc. with
  `pathLength="100"`, so `stroke-dasharray: <value> 100`; `.low` pulses), then the emote (wider screens) and settings
  buttons. Tapping the heart or a ring opens your slime's page.
- **Need bubble**: while a need is low (tummy < 20, energy < 15, joy < 30; the most urgent one) a bubble with its icon
  says "Hungry!", "Sleepy..." or "Lonely..." by the slime (`.say.need-say`, `hud.updateNeedBubble`). Hidden while
  asleep, at the ranch, while something else is being said, and while the phone menu is open. The old
  "{name} is hungry" hint is gone (the bubble replaces it).
- **Menu tabs**: four tabs, `#tab-shop` (Helpers + Upgrades), `#tab-outfits`, `#tab-slime` (your slime's page +
  the Journal; its label is the slime's name) and `#tab-ranch`. Each tab has `data-group` (`shop`, `outfits`, `me`,
  `ranch`). Tabs with two pages show a toggle at the top of the sheet (`#subtabs`, `.subseg[data-group]`, buttons
  `#tab-helpers`, `#tab-upgrades`, `#sub-slime`, `#tab-journal` with `aria-pressed`). Pages keep their names:
  `hud.tab` / `selectTab()` / `openTab()` / `dot()` still take `helpers`, `upgrades`, `outfits`, `slime`,
  `journal`, `ranch`. A page's red dot shows on its toggle button and on its group's tab. Each group remembers the
  last page it showed.
- Tests: to reach the Journal, open your slime's tab first (`#tab-slime`), then `#tab-journal`
  (`tools/breeding-smoke.cjs` does this now).

## Jelly loop

Everything below is new on the `jelly-loop` branch. New elements are made in JS (`src/ui/hud.js`
`mountJellyLoop()`, `src/game.js`), so the HUD and tab-bar markup in `index.html` is unchanged; the CSS is one
"jelly loop" block in `index.html` plus the Heirlooms tab's own `<style id="heirloomTabCss">`. Every new icon is a
placeholder emoji in `content.js`, drawn through `memIcon(icon, esc(icon))`: give `memIcon` a drawing for that emoji
and it shows everywhere without touching this code.

### Placeholder emoji (in `content.js`)

- Medals (`MEDALS[].icon`): 🎀 Grown-Up Ribbon, 🥉 Bronze, 🥈 Silver, 🥇 Gold, 💠 Platinum, 💚 Emerald, 💎 Diamond,
  🌑 Obsidian, 🌟 Nova.
- Heirlooms (`HEIRLOOMS[].icon`): 🧸 Toy Box, 🍪 Grandma's Cookie Tin, 🍀 Pressed Clover, 🫙 Golden Jar Lid,
  🏮 Ranch Lanterns, 🧵 Patchwork Quilt, 🖼️ Family Portrait, 🗿 Family Statue, ⭐ Wishing Star.
- The Heirlooms tab (`HEIRLOOM_TAB.icon`): 🧰. Until `memIcon` draws it, the tab shows the gold chest SVG from the
  approved layout check (`CHEST` in `hud.js`).

### Medal badges

- `#medalBadge.medal-badge`: right after `#nameBtn` in the HUD; `hidden` until the slime has a medal. On phones
  (<= 860 px) it was hidden at first (it squeezed the name in UI pass 2's compact pill); UI pass 3 shows it at 17 px
  and shortens the jelly rate line to make room.
- `.medal-badge` (a `role="img"` span with an aria-label; `.big` on cards) also shows: on the Slime tab's
  `.card.medal-card` (`.medal-row` badge + name, rank "N of 9", a `.meter` toward the next medal and the ranch perk;
  before the slime is grown a preview card), the ranch resident page (next to the name, plus `.sub.medal-line`),
  the ranch resident list (`.card.res .nm`), the family tree nodes (parents still on the ranch) and the Families list.
- Ceremony: a toast `.toast.medal-toast` (`.medal-ic` icon, "{name} earned GOLD!", the ranch perk), with confetti,
  a hop and a Journal memory (`medal-<id>`). The Ribbon waits for the grown-up card.
- 3D pin (`src/view/medal-pin.js`, `setMedalPin(avatar, medal)`): a small canvas-texture disc on the chest, to the
  viewer's right of the face (cream circle, orange ring, the emoji), at home and on ranch residents. Placeholder:
  the drawing is in one function, `texture()`.

### The Heirlooms tab and page

- `#tab-heirlooms.tab.tab-chest` (`data-tab="heirlooms"`, `data-group="heirlooms"`, aria-label "Heirlooms", no text
  label): its own tab after the four from UI pass 2, in a fixed 44 px last column
  (`#panel .tabs { grid-template-columns: repeat(4, minmax(0, 1fr)) 44px }`); no `#subtabs` toggle (one page).
  The icon is `.chest-ic`; `.glow` (a soft gold pulse, `@keyframes chest-glow`) while an heirloom you don't own has
  just become affordable; it stops when the page is opened. The whole tab is one commented block in
  `mountJellyLoop()`; the page does not care how it is reached: `hud.selectTab('heirlooms')` /
  `hud.openTab('heirlooms')`, rendered by `hud.renderHeirlooms()`.
- `#body-heirlooms.tab-body`: `.card.heirloom-intro`, then one `.card.heirloom` per heirloom: `.owned` ("Lives
  {where}"), `.next` (the next three unowned: effect, "Will live {where}", `button.hl-buy[data-buy=<id>]` with the
  price, `.can` when affordable; the Wishing Star shows `.hl-soon` "Arrives with rare eggs." instead of a button) or
  `.unknown` (dashed card, `.hl-ic.sil` silhouette, "???"). Parts: `.hl-ic`, `.hl-txt`, `.hl-where`.
- Buying: a toast `.toast.medal-toast.heirloom-toast`, sparkles and a happy hop, a Journal memory (`heirloom-<id>`).

### In-world heirloom objects (not built; for the UI project)

Each heirloom's card says where it will live (`HEIRLOOMS[].where`); the effects already work without the objects:

- Toy Box: in the nursery corner (by the cushion).
- Grandma's Cookie Tin: on the nursery shelf.
- Pressed Clover: in a frame on the wall.
- Golden Jar Lid: on the Jelly Jar (the jar button under the jelly count).
- Ranch Lanterns: along the ranch fence.
- Patchwork Quilt: in the Nursery (the cottage on the ranch).
- Family Portrait: on the nursery wall (the slimes of the family).
- Family Statue: on the ranch hill (a gold statue of a slime you pick).
- Wishing Star: over the ranch at night (when rare eggs exist).

### Move-out modal

- `.card.mv-medal` (first): the medal it takes (`.medal-badge.big`) and its ranch perk.
- `.card.mv-bonus`: "Family Bonus +X% → +Y%" (now → after).
- `.card.mv-leftover` (only with jelly left): "You still have 12.4B jelly. It stays behind when {name} moves out.
  Visit the Heirlooms first?" and `#mvHeirlooms.btn` (closes the modal, opens the Heirlooms page; the move-out can
  be started again).
- "You keep" now lists heirlooms; with the Golden Jar Lid, "Starts over" says the jar keeps its size (also in the
  baby's new home modal).

### Moving Day signs (3D, no text)

- The signs are slime behaviors only (turning toward the ranch hill, gaze, hops, little hands, hums, hearts, a
  shared snack): `src/moving-day.js`. The slime may move up to about 0.85 units on the cushion and turn its body
  (`SlimeAvatar.turnYaw`).
- Travel bundle (`src/view/travel-bundle.js`, PLACEHOLDER): a pink polka-dot cloth sack on a stick, on the cushion's
  back right edge, popping in and out; only at "very ready", now and then.
- Journal (Notes page): a `.combo.unknown.moving-day-clue` row under "Something to watch for" once a slime is grown
  up: "Grown slimes sometimes dream of the ranch. Watch where they look."

### Debug only (`#debug`)

- Settings: "Moving Day signs" with `#mdStatus` (the ratio, level and this slime's sign) and
  `.actions.md-debug`: one `.btn.small[data-dbg="sign:<id>"]` per sign (labeled with the personality lean) and
  `[data-dbg="bundle"]`.

## UI pass 3 (medals and heirlooms drawn)

The jelly loop's placeholder emoji now have drawings. Nothing in `content.js` changed: the emoji stay as keys, and
`memIcon()` in `src/ui/icons.js` turns them into art everywhere they show.

- Medals (`MEDAL_ART` in `icons.js`): a ribbon V and a shaded disc with an emblem, one look per tier: 🎀 a pink
  rosette, 🥉 bronze, 🥈 silver, 🥇 gold (star), 💠 platinum, 💚 emerald (gem), 💎 diamond (gem), 🌑 obsidian
  (crescent), 🌟 nova (rays). Each is a function so every copy gets its own gradient ids; `memIcon` calls it.
- Heirlooms (`HEIRLOOM_ART`): 🧸 toy box, 🍪 cookie tin, 🍀 framed clover, 🏮 lantern, 🧵 quilt, 🖼️ portrait,
  🗿 gold statue. 🫙 Golden Jar Lid and ⭐ Wishing Star use the jar and star already in `MEM`.
- `iconSvgDoc(emoji)`: the same drawing as a standalone 128 px SVG document, for canvas textures.
- 3D pin (`src/view/medal-pin.js`): `texture()` now draws the medal SVG (with a soft shadow) instead of the cream
  disc with an emoji; the old disc is the fallback until the image loads. The sprite is a bit bigger (0.34).
- Phone pill: `#medalBadge` shows again at 17 px next to the name (it was hidden on phones). To make room, the jelly
  rate under the count is shorter on phones: "2.08M /sec" (and "· zzz" while asleep) instead of "jelly per second".

## Recipe body

Every slime is a Curly or a Dollop (or a bred in-between) on one living body (`src/view/slime.js` + `src/view/body.js`,
recipes in `BREEDS` in `content.js`). New menus live in `src/ui/eggs.js`, called from a few places in `hud.js` marked
"recipe body".

### The slime itself (3D)

- The body: a Curly is a jelly drop with a curl on top (it sways behind the lean, droops when squashed); a Dollop is a
  soft gummy dome (Cat-ear and Topknot Dollops keep a smaller ear or knob when grown). Babies have little feet that tuck
  in as they grow. Growing up and the breed mix only blend numbers, so features grow in or melt away.
- Touch: the real body counts (the curl, ears and knobs too). Pulling near the curl's tip grabs the tip: it follows the
  finger, the curl straightens, and it boings back when let go. On a Dollop the same pull stretches the top of the dome.
- The face is one parametric face: the Curly face (big glossy blue eyes, open smile) slides to the Dollop face (dark
  oval eyes, a tiny smile that goes away when grown; it still opens to eat, sing and gasp). Cheeks are always a
  little rosy.
- The jelly skin: small crisp highlights, a lighter glow low in the body and a rim light in the body's own color, a
  slow wet ripple (not on Low graphics), bubbles inside; a Dollop is a little deeper in color and gummier.
- Ranch residents use a lighter body (same look, fewer points); the one you visit reshapes every frame, the others
  every other frame while you watch.

### Ranch tab: the Nursery (`#body-ranch`, `ranchPage === 'nursery'`)

- New section "Special eggs" (`.sec-title`) above "Pick two parents", with a `.sub` line (bought with pearls, ready time).
- One `.card.egg-card.special-egg` per special egg (Cat-ear egg, Topknot egg): `.egg-row` with an `.egg-ic` in the egg's
  own colors (`--a`/`--b`), the name and a `.sub` line ("A Dollop with little cat ears, every time."), a `.special-why`
  line when it can't be bought (nest full, or "Cat-ear egg costs 75 pearls. You have 40."), and a
  `.btn.small.primary[data-act="buySpecial"][data-variant]` "Buy · (pearl) 75", disabled when it can't be bought.
- A special egg waiting in the nest: its card is titled "Cat-ear egg" / "Topknot egg" (instead of "A and B's egg") with
  the same line under it (`.sub.egg-note`, a block line: one new CSS rule `.egg-row .egg-note` in `index.html`); the
  rest of the card (warming time, Put on the cushion, Give to a neighbor) as before.

### Move-out modal and the cushion

- The egg choice lists a special egg as "The Cat-ear egg" with its line under it, in its own colors.
- Texts that named an egg by its parents now say "the Cat-ear egg" for a special egg (put on the cushion, given to a
  neighbor, the welcome screen after moving out). The egg on the cushion has the special egg's colors.

### Slime tab (`#body-slime`)

- "Body" card: a first `.row-between.breed-line` "Breed: Curly / Dollop / Cat-ear Dollop / Topknot Dollop /
  Curly × Dollop" with a `.sub` line describing it ("A jelly drop with a curl on top.", "Part Curly, part Dollop (about 64%
  Dollop). Only the Nursery makes these.").
- Family tree: a slime from a special egg shows "Cat-ear egg" / "Topknot egg" as its egg instead of "A plain egg".

### Heirlooms tab

- The Wishing Star is for sale (it was "Arrives with rare eggs."): "Rare eggs twice as likely: a plain egg hatches a
  surprise Cat-ear or Topknot Dollop twice as often."

### Toasts and Journal

- Buying a special egg: toast "A Cat-ear egg in the Nursery" (ready time, and where it can go next); a refusal toast
  "Not right now" with the reason. Journal line on the first special egg ("You brought home a Cat-ear egg for 75
  pearls. A Cat-ear Dollop will hatch from it.").
- The hatch line in the Journal ends with the breed: "... A little Curly!".

### Debug only (`#debug`)

- Settings: "Body" with `#bodyStatus` (breed, variant, mix) and two `.actions.body-debug` rows of `.btn.small` buttons
  (`data-dbg="body:mix:<0|0.25|0.5|0.75|1>"`, `data-dbg="body:variant:<plain|ears|topknot>"`): they set this slime's
  body (and the egg's while it waits), and the body morphs over.

## Ranch life

Everything below is new on the `ranch-life` branch (the Training Center and trips). Rules and plain menus only: no
new 3D, no new art. All markup is built in `src/ui/ranch-life.js` (`RanchLifeUI`), which `src/ui/hud.js` calls from
four marked lines (the resident page, the ranch tab row, the resident rows, the Nursery) and `src/game.js` from a few
more (load, back from hidden, the live tick, refusals, `#debug`). Existing card, button and row styles are used; the
few new rules are one `<style id="ranchLifeCss">` block made by `ranch-life.js` (listed below). Icons are placeholder
emoji in `content.js` (`RANCH_LIFE`), shown as text; stars are the ★/☆ glyphs.

### Placeholder emoji (in `content.js`, `RANCH_LIFE`)

- Skills (`skills[].icon`): 🏐 Bounce, 💨 Speed, 🛡️ Sturdy, 📚 Smarts, 🌸 Charm.
- Places (`places[].icon`): ☕ Puddle Café, 🌻 Willowbend Gardens, ⛏️ Pebblepeak Mine, ♨️ Mistwater Hot Springs,
  🔭 Starlight Observatory, 🎆 Summer Festival.
- Souvenirs (`places[].souvenirs[].icon`): 🥤 Paper Cup Hat, 🫙 Sprinkle Jar, 🖍️ Napkin Doodle, 🌱 Seed Packet,
  🐌 Snail Shell, 🍂 Pressed Leaf, 🪨 Shiny Pebble, 💎 Crystal Chip, ⛏️ Little Pickaxe, 🦆 Rubber Duck, 🧺 Fluffy Towel,
  🫧 Bath Pebble, 🗺️ Star Map, ☄️ Meteor Bit, 🔭 Tiny Telescope, 🎭 Festival Mask, 🎇 Sparkler, 🪭 Paper Fan.
- In `ranch-life.js`: 🎓 lessons and 🧳 trips (the Ranch life row, a resident row's status line, Journal lines).

### Ranch tab (`#body-ranch`)

- **Ranch life row**: `.card.rl-card` right after the Nursery card (only with residents): "Ranch life", two
  `.row-between` lines "🎓 Lessons x / N lanes" and "🧳 Travelers x / N wagons", a hint line, an `.upgrades` grid with
  `button.upgrade[data-rl="lane"]` "Another lane" and `button.upgrade[data-rl="wagon"]` "Another wagon" (pearl
  `.cost`; `.poor` when short; gone at three), and `button.btn[data-rl="shelf"]` "Souvenirs x / 18".
- **Resident rows** (`.card.res`): a busy slime gets `.sub.rl-status` across the row ("🧳 On a trip to Willowbend
  Gardens, home at 5:10 pm" / "🎓 In a Bounce lesson (star 2), done at 3:40 pm").
- **A resident's page** (focused): after the personality line, `.sec-title` "Skills · x of 25 stars" and
  `.card.rl-skills`: five `.row-between` lines (icon + name, stars in `.rl-stars`), "Loves: ... (what it does)." and
  either `button[data-rl="train"]` Train + `button[data-rl="trip"]` Send on a trip (in `.res .acts`), or while busy
  `.sub.rl-busy` (the status line) and, for travelers, `button[data-rl="callHome"]` Call home early.
  A traveler's page has no "Tap or stroke ... to pet them" line, and `#ranchHint` says "... is on a trip".
  Talents (T1): a skill whose first lesson showed a talent graded A or S gets 6 or 7 star places (☆) instead of 5, and
  the count says "x of 27 stars" etc.; before that (and for C and B) it is 5, as before. A skill's line in the Train picker says
  "All six stars!" / "All seven stars!" at those caps; stars 6 and 7 cost 80 and 120 pearls and take 8 h and 24 h.
- The click handler: any `button[data-rl]` in `#body-ranch` goes to `RanchLifeUI.click()`.

### Modals

- **Train picker** ("Train Pip"): intro + loves line, pearls on hand (or "The Training Center is full"), a list
  `.egg-choice` of `button.card.choice.rl-pick[data-skill]` (icon `.rl-ic`, name + `.rl-stars`, "Star N: time ·
  pearls", why it can't start now in `.sub.rl-why` (see "Outfits and stars fixes"), what each star does; `disabled`
  when it can't start), "Not now" `#rlNo`. Tapping a skill starts it.
- **Trip picker** ("Send Pip on a trip"): the six places as `button.card.choice.rl-pick[data-place]` ("1h · about
  (pearl) 5 · souvenirs 0/3", or "Opens at Sturdy ★★ (Pip has 0)" and `disabled`; "You are a Friend of this place."),
  "Every wagon is out" when none is free, "Not now".
- **Call home early?**: `#rlNo` "Let Pip finish", `#rlYes` "Call home" (says how many pearls come now).
- **Souvenir shelf** ("Souvenirs x / 18"): one `.card` per place (icon, name, x / 3), its souvenirs as an
  `.owned-list` of chips (found: icon + name; not found: "? ? ?"), the Friend of line; `#rlOk` Done.
- **Return card** ("Pip is home!", "Lesson done!", or "While you were away" for several): one `.card.rl-return` per
  trip (place icon, name · place, a `.cost` "+N" pearl chip, the story in `.sub.story` (italic), "Found a souvenir:
  ...", "Pip brought Clover a garden berry!" or "Pip ate ... on the way home", "Home early: ...", the Friend of line)
  and one `.card` per lesson that ended while the game was closed (name · skill, stars); `#rlOk` "Yay!". Its title
  carries `data-rl-card`. It waits until no other card is open (and 3 s after loading, so the welcome-back card goes
  first); if another card replaces it before it was closed, it comes back when that one closes.

### Toasts and Journal

- Toasts: "Pip started a Bounce lesson", "Pip earned 2 stars in Bounce!" (`.love`), "Pip is off to Willowbend
  Gardens!" (`.love`), "Pip is home from ...!" (`.love`), "Pip is on a trip / is in a lesson" (refusing a new home or
  an auction), "Another lane", "Another wagon".
- Journal (`g.remember`): 🎓 first lesson, each star earned; 🧳 first trip, each return (with the story and the
  souvenir); 💌 Friend of a place.

### Nursery

- A busy slime's `.parent-pick` is `disabled` with "On a trip" / "In a lesson" (instead of "Resting today");
  `#breedMsg` explains `canBreed`'s new reasons `away` and `lesson`.

### Ranch scene (3D)

- Travelers are simply not there (`ranch.sync` gets the slimes who are home); one leaving walks out through the gate
  (`RanchView.leave`) while its page stays open. Slimes in a lesson look as usual. Parked for the new art: a Training
  Center building, a "gone on a trip" sign in the empty spot, a 3D souvenir shelf.

### `<style id="ranchLifeCss">` (made by `ranch-life.js`)

- `.rl-pick:disabled` (dimmed), `.rl-ic` (24 px emoji column), `.rl-stars` (gold, no wrap), `.res .rl-status`
  (spans the row), `.rl-card .upgrades` (lane and wagon side by side, also on phones), `.rl-card .upgrades .upgrade`
  (44 px tall), `.rl-return .story` (italic).

### Debug only (`#debug`)

- Settings → Debug: "Finish lessons" (`data-dbg="rlLessons"`), "Bring travelers home" (`data-dbg="rlTrips"`).

## Greenhouse

The baked Greenhouse room is home's default background (`src/view/greenhouse.js`, coordinated by
`src/greenhouse-home.js`), with a camera you can turn in it.

- Camera button `#camBtn.cam-btn.glass` (`src/ui/camera-button.js`, CSS `.cam-btn` in `index.html`): a 44 x 44 round
  button fixed at the left, 10 px under the top bar (`top` set from `.top`'s bottom; with no top bar, while the egg
  waits, `env(safe-area-inset-top) + 14px`). `z-index: 4`, under the HUD layer (`#ui` is 5), so a stretched menu sheet
  covers it; it is also hidden while the sheet is tall. Shows only in the Greenhouse, at home, in play or while the egg
  waits, with no modal open (hidden in the Meadow and Classic, at the ranch, while hatching or moving out).
  - Icon: the drawn `ICON.camera` (`src/ui/icons.js`); after you turn the camera by hand it shows `ICON.cameraBack`
    (a camera with an orange curved arrow), the button gets the class `.free` (an orange ring), and its next tap goes
    to Front.
  - `data-view`: `front | wide | left | right | free`; `aria-label` / `title`: "Camera: Wide view. Tap for Left" or
    "Camera: turned by hand. Tap for the front view".
  - `.tip`: a small pill to the right of the button with the new angle's name ("Wide view") for 1.3 s after a tap
    (class `.tipping` on the button).
- Settings, Background row: three choices `Greenhouse / Meadow / Classic` (`.seg` buttons `data-k="scene"`) and a new
  sub line: "In the Greenhouse, the camera button and a drag on the background turn the view. Classic is just your
  slime." If the room could not load on this device: "The Greenhouse could not load here, so the meadow shows for now."
- No other new elements. Gestures on empty background in the Greenhouse: one finger turns the camera, two fingers
  pinch to zoom, a mouse wheel zooms on a computer (the swipe code still counts).
- 3D: helpers stand on the Greenhouse's spots (`GREENHOUSE.spots` in `content.js`).

### The game's start waits for the room (R3b)

- The loading screen `#boot.boot` ("Warming the nest", unchanged) now stays up until the Greenhouse room is in and
  drawn, when the Background is Greenhouse, so no other scene shows first. At most `GREENHOUSE.arrive.wait` (8 s) after
  the game is built; then it fades as before into the plain Classic look, and the room arrives with a cross-fade. The
  Meadow and Classic don't wait (the screen goes as soon as the game is built, as before).
- Cross-fade `canvas#homeFade.home-fade` (made by `src/greenhouse-home.js` only when the room arrives after the loading
  screen has gone, CSS in `index.html`): a picture of the last frame before the room, right over the scene canvas and
  under everything else (no `z-index`, next after `#scene`), takes no touches, fades out over `GREENHOUSE.arrive.fade`
  (0.8 s; also with Reduced motion), then hidden and emptied. The HUD stays live above it.
- Offline on the very first run (the room can't load): the loading screen goes straight into the Meadow (before, the
  Classic look showed for a moment first).
- The page's `<html>` carries `data-home-world` (`greenhouse | loading | meadow | classic`): what home drew last, for
  the browser tests.

## Barn ranch

The ranch screen is the baked barn (`src/view/barn.js`, coordinated by `src/barn-ranch.js`): one resident at a time on
the show stand, a fixed camera, the burrow swap between residents. Home is unchanged (the Meadow keeps its ranch hill).
The meadow ranch is never the ranch screen (R3): the barn's files load ahead of time, and until they are in Ranch shows
the loading moment below at home.

- Name card `#barnCard.barn-card.glass` (`src/ui/barn-card.js`, CSS in `<style id="barnCss">` made by that file),
  `role="button"`, `tabindex="0"`: centered over the picture, `width: min(340px, 100vw - 32px)`, `z-index: 7`, placed
  every frame just above the menu sheet (or above the ranch bar when the sheet is closed). Hidden at home.
  - `<b>` the resident's name (the display font, 22 px); `.bc-line` its body's name and one line from real data,
    "Curly · Bounce ★★★", "Topknot Dollop · in a lesson: Bounce, 2h left", "Dollop · just back from Puddle Café",
    "Curly · 4.2 pearls an hour" (no stars yet); the stars in honey.
  - `.bc-line.bc-talent` (Talents T1, only once a lesson has shown one): a second line in the same style with the best
    talent its lessons have revealed, "a natural at Bounce!" (S), "takes to Speed quickly" (A), "getting the hang of
    Charm" (B); nothing for C or before its first lesson in a skill. Also in the `aria-label`.
  - `.bc-dots` one dot per resident on the stand's list (up to `BARN.dots` = 8; the one on the stand is a wider purple
    pill), else `.bc-count` "3 of 12".
  - Empty stand (`.empty`): "Everyone is on a trip" / "Juniper is on a trip" + "Juniper is home at 7:05 pm."; or
    "Nobody lives here yet" + today's empty-ranch line ("When Pebble is all grown up (Settled), they can move to the
    ranch.").
  - Tap: opens the menu sheet on that resident's page (the page tapping a resident opened before). A quick sideways
    swipe on the card swaps like a swipe on the barn. `aria-label` "Juniper, Curly, 4.2 pearls an hour. Open Juniper's
    page".
- Previous / next buttons `#barnPrev` / `#barnNext` (`.barn-arrow.glass`, `<button>`): 44 x 44 round, 10 px from the
  screen's left / right edge, at the slime's middle height; `aria-label` "Previous slime" / "Next slime". Shown only
  with two or more residents on the stand's list.
  - Icons: two new drawn icons, `ICON.chevronLeft` / `ICON.chevronRight` (`src/ui/icons.js`, a soft purple chevron).
- `#ranchHint` in the barn: "Swipe for the next slime. Tap or stroke to pet." (one resident: "Tap or stroke to pet.";
  none: "Your ranch slimes live here."; the Nursery: "The Nursery. Pick two parents below."). (R3: the meadow ranch's
  own lines, "Tap a slime to visit it. Drag to look around." and "... Tap the grass to step back.", are gone with it;
  `index.html` still has the first as the element's starting text, never shown.)
- `body.in-barn` while the barn shows (no CSS uses it yet).
- Gestures in the barn: a quick sideways swipe anywhere (more than 60 px, mostly sideways, under 0.7 s; left = next)
  swaps and does not pet; a tap on the slime pets; a press on it pets once it cannot be a swipe any more (it turned
  back, went mostly up or down, or lasted 0.7 s), then stroking keeps petting. No camera drag. Arrow keys ← → swap on a
  computer.
- 3D (tappable): the slime on the stand, the loose pearls (they land in the stand's straw in front of the slime), the
  baked Pearl Basket at the front right (collects; live pearls on its heap show how full it is), the Nursery's straw
  nest at the front left (only while the Nursery has eggs; opens the Nursery). Nothing else in the barn is tappable.

### The barn ahead of time (R3)

- The barn's files load in the background soon after home shows (no element). Ranch (the tab, the pearl counter, a
  resident's Visit, the Nursery link under the egg) tapped before they are in:
  - Loading moment `#barnWait.barn-wait.glass` (`src/ui/barn-card.js`, CSS in `<style id="barnCss">`),
    `role="status"`: a pill under the top bar, in the middle, `z-index: 8`, takes no touches. The Ranch tab's own
    barn-house icon in purple (`#6b4bd6`, the card's dot colour), "Off to the barn" (the display font, 17 px) and three
    small purple dots that bounce one after another (still with Reduced motion). Home stays (the menu shows the Ranch
    page); the barn opens the moment its files are in. Another tab, "← Back home" on the Ranch page, or a goodbye
    calls it off.
  - The barn can't load (offline on the very first run, files missing): the pill goes, the menu goes back to the page
    it was on, and one toast: **"The barn needs the internet the first time."** / "Try again in a moment." The next tap
    on Ranch tries again.

## The send-off: a travel bubble (R3)

The goodbye when a grown slime moves to the ranch, and when a baby goes to a new home (`src/send-off.js`, the bubble
`src/view/travel-bubble.js`, its rule `src/view/bubble-math.js`, numbers in `SENDOFF` in `content.js`). It replaces the
old hop toward the hill (a grown slime) and the hops off to the side (a baby).

- The start is as before: hearts, the say line, the happy face; the menu sheet closes.
- 0.2 s: it waves (the nub a baby always waved with; now a grown slime waves too); a baby looks toward where its new
  family waits (as before).
- 1.0 s: a see-through soap bubble grows around it (no art files: a thin-film rainbow rim that drifts, a thin bright
  outline, a soft window glint upper left and a small one lower right, a gentle wobble) with a ring of rainbow sparkles
  and the `wobble` sound. Its bottom stays just over the cushion; the slime is lifted onto the bubble's floor.
- 1.6 s: it lifts off (`whee`), sparkly eyes, and floats up with a gentle sway, a little toward the camera, a trail of
  small pastel glints behind it (a baby drifts a little toward its family's side), and leaves the top of the picture.
- Where the room would be seen meeting it first (the Greenhouse roof in the Wide, Left and Right angles, or turned by
  hand), it pops instead: it swells a little and fades, the slime shrinks into a burst of rainbow and gold sparkles
  (`pop` + `sparkle`); near the room the sparkles spread less and drift down. By 3.95 s it pops anyway.
- 4.2 s the white fade and 5.3 s the move and the reload, as before.
- Reduced motion: no float; the bubble forms, glows and fades out in place with the slime (from 2.4 s over 1.2 s).
- Low graphics: the bubble draws only its near side (one pass); High also draws its far side faintly first.

### Copy changed (the hill is now the barn)

| Where | Before | Now |
|---|---|---|
| "Move Pebble to the ranch?" (`askMoveOut`) | Pebble will live on the hill behind the cushion, making jelly and pearls, ... | Pebble will live at the ranch barn, making jelly and pearls, ... |
| The say line as it leaves (`moveOut`) | I'll be on the hill! ♥ | See you at the barn! ♥ |
| "Pebble moved to the ranch!" (`showMovedIn`) | Pebble is settling in on the hill behind the cushion, with 7 other slimes. | Pebble is settling in at the barn, with 7 other slimes. |

(Still saying "hill", not in this slice's list: the Family Statue heirloom's "on the ranch hill" in `HEIRLOOMS`.)

## Save safety (H1)

New on-screen elements, all plain DOM in `src/ui/notice.js` (`showNotice`), using the page's own `.modal`, `.modal-card`
and `.btn` styles in a separate layer (`.modal.notice`, z-index 60, above the loading screen), so they work even when the
game or its HUD did not start. Screenshots at 375 px: `tools/health-smoke.cjs` (tools/out/health/).

| Card / toast | When | Buttons |
|---|---|---|
| "A fresh egg, for now" | the save on this device could not be read and no copy could (the text stays in `slimekin.save.broken`) | OK, Copy the old save |
| Toast "Welcome back, Pebble!" | the save could not be read, so the game used the phone's backup or `slimekin.save.prev` | (toast) |
| "Oops, a hiccup!" | a few frames in a row hit an error (`TROUBLE_FAILS`): saving stops | Reload, Restore last good save (when there is one); a small "Details" line |
| "The picture fell asleep" / "The picture is back" | the phone took the 3D picture away (`webglcontextlost`) / gave it back | Reload / Carry on, Reload |
| Toast "Saving didn't work" | a save was refused by storage (once per visit) | (toast) |
| "Slimekin hit a snag" | the game could not start for a reason other than missing WebGL (that one keeps its old message) | Try again, Copy save code, Restore last good save (when there is one) |

Changed:

| Where | Before | Now |
|---|---|---|
| Load a save code | any JSON replaced the slime at once | a message under the box for an empty, cut, changed or slime-less code (`.code-msg.bad`); a good code opens "Replace Pebble?" (Keep Pebble / Replace Pebble) naming the incoming slime |
| The top bar pill (`.slime-card`) | a name was cut with an ellipsis (at 375 px about 50 px: "Pe...") | a name that does not fit gets the first line to itself (`.long-name`, 63 px tall); a name that fits keeps the one-line pill |
| Ranch life row, Ranch life card, return card | raw 🧳 and 🎓 | drawn icons (`memIcon`; a new suitcase drawing in `icons.js`) |
| The Ranch page heading | Slime Ranch | The Barn |
| The Meadow hill's gate sign | Slime Ranch | The Barn |
| Heirloom "It will live ..." | along the ranch fence / on the ranch hill | by the barn door / in the barn |

## Contests (C1b)

The contest screens, built from the approved mock-ups (`slimekin-notes/samples/contests-c1b/`). Cards: `src/ui/contests.js`
(CSS in `<style id="contestsCss">` made by that file); the show: `src/contest-show.js` (`<style id="contestShowCss">`).
Rules: `src/core/contests.js`; words and numbers: `CONTESTS` in `content.js` (contest names and colors, act `short`
names, cup `short` names, rivals, `cheer` and `show` timing). Screenshots: `node tools/contest-shots.cjs [--night]
[--fonts <dir>]` (tools/out/contests/). No emoji: the new drawings are in `src/ui/icons.js`.

- Icons (`src/ui/icons.js`): `cupIcon(color, { tier, champion, ghost })` a cup in a contest's color (`CONTESTS` color:
  Beauty `#ff74b0`, Sprint `#3fa2ff`, Bounce-Off `#ff9b2f`; never a metal, the medals own those), sized by tier with
  `.gi.cup.cup-1..4` (24/29/34/37 px), a star on the Champion Cup, `ghost` = an outline in the text color for a cup not
  won yet; `blobIcon(color)` a rival's little blob; `ICON.whistle` (the coach), `ICON.bow` (Dress up), `ICON.check`; the
  Journal's `'🏆'` memory icon is now drawn (one cup in all three contests' colors).
- Resident page (`#body-ranch`, a resident's page): a second row `.res.cs-row2` under Train / Send on a trip:
  `[data-cs="enter"]` "Enter a contest" (Little cup icon) and `[data-cs="dress"]` "Dress up" (bow icon), the same `.btn`.
  On a trip: no row. In a lesson: "Enter a contest" disabled and `.cs-why` "Contests wait until the lesson ends."; Dress
  up stays. Beside the medal line: `.cs-trophies` its cups (one per trophy, by contest and tier) and "3 trophies: buyers
  pay +4.5% for Pebble" (the TOTAL trophy bonus); one `.cs-perk` line per Champion perk ("Beauty Champion: buyers pay 5%
  more for Pebble."). Nothing with no trophies.
- Ranch tab: the Ranch life card's Souvenirs button is now half of `.cs-halves`: "Souvenirs x / 18" and
  `[data-cs="shelf"].cs-half` (the three-color cup, "Trophies x / 12" + "Champions x / 3", counted from the Trophy Shelf).
- Modals (`#modalCard.cs-modal`, a hidden `[data-cs-card="entry|dress|result|shelf"]` marks which): titles in the body
  font 23 px (`h2.cs-h`), results in the display font 30 px (`h2.cs-big`).
  - Entry card: "Enter a contest", the three contests as tabs `.cs-tab` (a color dot each), the cup ladder `.cs-cup` x 4
    ("✓ Won" green, "Next" purple and outlined, locked: "Not yet", the Champion Cup "Naturals only"; a won cup can be
    picked again as a repeat), "<Cup> rivals" + "To win: beat N", three `.cs-rival` rows (blob, "<Place>'s slime",
    score), `.cs-mine` (name, "before cheers" + the score, its parts "Pose 50 · Natural +6 · Style 0 · Tricks 12 · Mood
    4", the coach's line from the rules' preview), "Dress up · Style x of 20" (Beauty Show only), "Shows are free and
    always open. ...", Start the show (primary) / Not now.
  - Dress up: "Dress up Pebble", the Style meter `.cs-meter` (x of 20, "counts in the Beauty Show"), Head / Face / Neck
    with every outfit `.cs-outfit` (its rendered icon, the name over "+N Style", `.cs-chip` "✓ Wearing" purple / "Wear" /
    green "<price> Buy & wear" / "Needs N jelly": see "Dress up: wear and buy from the card" below), Done. The resident comes up on the stand and its 3D look changes as you tap.
    Opened from the entry card or the loss card, Done goes back to the entry card.
  - Results (`.cs-res`): a loss: "Good try!", "2nd place in the Grand Cup", four `.cs-line` rows (the slime's row
    `.me` highlighted; a tie lists it first), the parts line with Cheers, the coach's tip `.cs-tip` (whistle) and
    Dress up / Train / Try again (by the tip) + Okay. A win: sparkles and the big cup, "<Cup> Cup!", "<Name> won the
    <Contest>", the slime and the top rival, the parts, `.cs-prizes` rows (+N pearls on a first win, "A trophy for
    <Name>" + the total trophy bonus, "First on the Trophy Shelf" when it is, what opens next / the Champion title and
    perk; a repeat: "Won again!"), Yay!. Closing it brings the menu sheet back on the resident's page.
  - Trophy Shelf: "Trophy Shelf x / 12", a line with "Champions x / 3", per contest a dot + name (+ "Champion: <name>")
    and four tiles (cup, ghost when empty; the first winner's name in purple or "Not yet"), Done.
- The show (`#csLayer`, `z-index: 4`: over the barn, under the HUD, so the top bar, the name card and the tab bar stay
  bright): `.cs-dim` the dim with a radial spotlight on the stand (it also takes the cheer taps, anywhere on screen);
  `#csBanner` "<cup> Beauty Show · Grand Cup" under the top bar, `#csBeat` "To beat: 85", `#csSkip` "Skip" at the right;
  `#csPrompt` "Go, Pebble!" (display font, purple outline) + "Tap when the rings meet"; `#csGold` / `#csPink` the
  rings (CSS ellipses; the pink one closes with a Web Animation, `CONTESTS.show.ring` times the gold ring's size at the
  start); `#csPop` "Perfect! +3" / "Good! +2" / "Nice try! +1". The name card's line becomes "Act 1 of 3 · Pose (Charm)"
  (`.bc-line.bc-act`, purple) with three act dots; the act strip `#csActs.cs-acts` (three chips: "Pose ···" now,
  "Style —" to come, "Pose +3" done) takes the ranch bar's place (`#ranchBar.cs-on`). `body.cs-show`: the HUD and the
  tab bar take no touches, the ‹ › buttons hide, the name card does not open the page, no swaps or petting. Keyboard:
  Space / Enter cheer, Escape skips. A tap is graded by its own time (its touch event's timestamp from the ring's start),
  so a tap made in time still counts once when a slow frame hands it over after the ring ran out.
- Name card: a Champion's title `.bc-title` on the card's top edge (a pill in the contest's color with a white cup:
  "Beauty Champion"; two or three contests: "Double Champion" / "Triple Champion" in the Beauty pink).
- Debug only: `g.contestShow.info()` (phase, act, the ring's start, grades, taps; `last` = the last result),
  `g.contestShow.debugCheer(grade)` (the picture tool), `g.contestsUI.openEntry(id, contest, cup)`.

## Outfits and stars fixes (the captain's playtest of the :8822 test copy, 11 Nov)

- Outfits page (`#body-outfits .outfit`): the outfit the slime wears always reads "Wearing" (`.worn`, `.wear.on`,
  `aria-pressed="true"`) and a touch takes it off, also one the family does not own (only a hand-made save has one;
  before, it showed its price and a touch tried to buy it). Not worn and not owned: the price, as before.
- Dress up (`#modalCard .cs-outfit`): what the resident wears is always the "✓ Wearing" button, first in its group, and
  a touch takes it off, owned or not (before, the test ranch's Mochi showed her Artist Beret as a faded "In Outfits" row,
  so the card said she wore nothing on her head while the stand drew the beret). Not owned and not worn: still faded
  with "In Outfits", now `button.cs-outfit.not[data-cs="notOwned"][aria-disabled="true"]`: a touch shakes it (`.shake`)
  with the error sound and changes nothing (before, nothing at all happened). Once off, an outfit the family does not
  own can't go back on.
- Train picker: a greyed card that still has a star to learn says why on the card, in `.sub.rl-why` under "Star N:
  ...": "**Waits for a free lane.** One frees up at 8:41 pm." (every lane busy; the time is the first lesson to end) or
  "**Needs 80 pearls.** You have 50.". The line at the top ("The Training Center is full ...") stays.
- A finished lesson's toast and the "Lesson done!" card: the stars have the places the resident's page shows
  (★☆☆☆☆☆ for a skill graded A once its talent is shown; before, always 5 places).
- HUD jelly counter (`.jelly-count`): the number in M PLUS Rounded 1c 800 (was DynaPuff 700, whose B reads as 6 or 8:
  "1.2B" looked like "1.26"; design/STYLE.md §4). The drop icon and the "per second" line are unchanged.

## Dress up: wear and buy from the card (the captain, 11 Nov: "I should be able to wear items from my outfits and select wear too")

Every outfit is choosable in Dress up, the way it is on the Outfits page. One rule names a row on both pages
(`Sim.outfitChoice(id, worn)` in core/sim.js), so they always say the same thing.
- Dress up (`#modalCard .cs-outfit`): the name over "+N Style" (`.cs-on`, so a price fits on a 390 px phone), then:
  - worn: `.cs-chip.on` "✓ Wearing" (purple, `aria-pressed="true"`): a touch takes it off, as before;
  - owned, not worn: `.cs-chip` "Wear": a touch puts it on, in place of what that spot held;
  - not owned (`button.cs-outfit.cs-shop[data-cs="buy"]`): green `.cs-chip.cs-buy` "(drop) 100B Buy & wear": a touch
    buys it for the family at the Outfits page's price (`Sim.buyOutfit`, through `Sim.buyAndDress` and
    `Game.buyOutfitFor`: the buy sound, a Journal line "Mochi got a new outfit: Tiny Crown.") and puts it on this
    resident; Pebble at home keeps what she wears. No confirm, the same as the Outfits page;
  - not owned and not enough jelly (`.poor`, `aria-disabled="true"`): faded, `.cs-chip.cs-needs` "Needs 100B jelly" in
    grey; a touch does nothing (replaces the faded "In Outfits" row that shook).
  Both labels of a not-owned row are drawn and the jelly picks one: the open card checks every 0.4 s, so a row turns
  into "Buy & wear" once the jelly is there. The intro now says "Outfits belong to the whole family."
- Outfits page (`#body-outfits .outfit`): the same labels: `.wear.on` "✓ Wearing" (the drawn check, was the word only),
  `.wear` "Wear", `.cost.buy` "(drop) 100B Buy & wear" (was the price only), `.needs` "Needs 100B jelly" on a `.poor`
  tile (`aria-disabled="true"`; was a grey price, and a touch beeped with a "Not enough jelly" toast; now it does
  nothing).

## Race view RV2: Slime Sprint, by day (the Pixel Derby)

The Slime Sprint is now a pixel race (design `slimekin-notes/design/contests-race-view.md` v2 + the captain's ruling and
picks). Beauty Show and Bounce-Off keep the stand show above until RV3/RV4. Every piece below is in ONE module,
`src/view/race-skin.js` (CSS in `<style id="raceSkinCss">`), in today's look (glass panels, chips, cup icons, DynaPuff
and M PLUS Rounded), at the design's places (§8, 390 x 844) with the design's words. The scrapbook art (UI art P1,
design §6.1) replaces them there; the missing pieces are listed in `slimekin-notes/reports/race-rv2.md` "Skin gaps".
No rival score shows anywhere in the race (card, race, results).

- Entry card, Slime Sprint tab (`ui/contests.js` `openRaceCard`): the same title, tabs and cup ladder, then the cup's
  name and four runner rows `.rv-rows > .rv-row` (yours first, `.me`): a 32 x 28 pixel face (canvas, white border),
  `.rv-rt` the name over one line: yours "Can win this with good cheers." (the chances: "Ready for this one.", "Can win
  this with good cheers.", "Close: needs great cheers.", "Not yet: <tip>."), a rival "Starlight's slime" over "Speed
  ★★★★★ · finishes strong" (main skill stars + its race style); `.rv-grade` a grade stamp (A / S) where there is one.
  Buttons `.rv-two`: "Not now" / "Race!" (Sprint cup icon).
- The race layer `#raceLayer` (over the barn; the HUD hides, `body.rv-on`):
  - the way in: `#raceBridge` (the barn's frame pixelating, then the course slides in: `.bridge`, `.slide`);
  - `#raceCanvas` the pixel course (1 art px = 2 pt, bottom on the screen's bottom), `#raceRings` the cheer rings
    (white target 78 pt, Sprint blue closing ring);
  - `.rv-skip` "Skip" (top right, 112 x 44);
  - `.rv-tote` the tote strip: `#rvFaces` the running order (four faces, "1st" to "4th", yours outlined) and `#rvTrack`
    the course line with a pin per runner;
  - `.rv-caller` the caller's line ("They're at the gate!", "Juniper, a natural!", "Photo finish!", ...);
  - `.rv-name` the name card: the name over the leg tag ("Slime Sprint · Grand Cup" at the gate, then "The dash · Speed
    ★★★★★", "The hill · Sturdy ★★★", "The hoops · Smarts ★★");
  - `.rv-acts` the act strip: Dash / Hill / Hoops chips (the current one outlined, a cheered one filled);
  - `.rv-go` "Go, Juniper!" by the rings, `.rv-hint` "Tap when the rings meet" and `.rv-pat` "Give Juniper a pat for
    luck" (until the slime's first Sprint cup), `.rv-pop` the cheer word ("Perfect!", "Good!", "Nice try!"),
    `.rv-stamp` the grade stamp as the main leg starts ("A · a natural", S with the sparkle icon);
  - `.rv-photo` the photo finish: `.rv-mount` around the frozen frame, "fig. 1 · photo finish · 12 Nov", the margin
    words ("by a wobble") and "1st · Juniper".
- Results (`.cs-modal`, `[data-cs-card="result"]`): a win: the cup with sparkles, "Sprint Grand Cup!", "Juniper won by a
  wobble", `.rv-how` "How Juniper ran: led from the gate, held on at the line.", the prizes (as before, but the next
  cup's line says "Faster rivals wait there" instead of "Rivals up to <score>"), "Yay!". A loss: "Good try!", "2nd, by a
  wobble" (or "2nd place" when 10 or more behind), `.rv-how` "Starlight caught Juniper in the hoops." (or "The hill was
  the hard part."), the coach's tip ("... Tap right when the blue ring meets the white one."), Try again / Dress up /
  Train, Okay. No score rows.
