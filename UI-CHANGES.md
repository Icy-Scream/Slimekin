# UI changes (for the UI branch)

Every on-screen element the breeding core and the playtest fixes added or changed, so a separate UI pass can
restyle them. Game UI facts only: element ids and classes, where each one shows, and which pieces are placeholders
(emoji or CSS drawings) waiting for real art. All CSS lives in `index.html`; the markup is built in
`src/ui/hud.js` (menu tabs) and `src/game.js` (modals, toasts, the egg hint).

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

- `#medalBadge.medal-badge`: right after `#nameBtn` in the HUD; `hidden` until the slime has a medal.
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

- `#tab-heirlooms.tab.tab-chest` (`data-tab="heirlooms"`, aria-label "Heirlooms", no text label): appended as the
  7th tab, in a fixed 36 px last column (`#panel .tabs { grid-template-columns: repeat(6, minmax(0, 1fr)) 36px }`).
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
