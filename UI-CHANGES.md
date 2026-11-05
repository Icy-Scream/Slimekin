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
