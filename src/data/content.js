// All authored game content lives here, so balancing never requires touching game logic.
// Numbers are first-pass prototype values, meant to be tuned through play.

export const TUNING = {
  tummyDecayPerSec: 1 / 3.2,   // fullness lost per second while awake
  energyRegenPerSec: 1.1,       // while awake and not being booped
  sleepRegenPerSec: 7,          // while napping
  boopEnergyCost: 0.32,
  giggleAdd: 10,                // giggle meter per boop
  giggleDecay: 0.8,             // fraction of the meter lost per second
  feverAt: 55,                  // Giggle Fever starts here
  dizzyAt: 100,                 // too much booping, slime gets dizzy
  dizzySeconds: 2.6,
  comboWindow: 8,               // seconds between two foods to count as a combo
  glimmerEvery: [80, 210],      // seconds between Lucky Glimmers
  requestEvery: [45, 100],      // seconds between slime requests
  autoSleepIdle: 75,            // seconds without interaction before a tired slime dozes off
  bondGain: 0.3,                // scales every bond gain: bond is a slow, long-term relationship (weeks, not hours)
  bondCurve: [1, 1, 1, 0.6, 0.42, 0.3, 0.22, 0.17, 0.13, 0.1], // deeper bonds grow slower (by current level)
  feverBondEvery: 120,          // Giggle Fever only adds bond once every 2 minutes (so spamming can't farm it)
  tiredBoop: 0.3,               // boops on an exhausted slime (energy under 8) give only 30%
  wakeEnergy: 35,               // a napping slime can't be poked awake before it has this much energy
};

export const STAGES = [
  { id: 'hatchling', name: 'Hatchling', minGrowth: 0,    boop: 1,  size: 0.6,  foodCost: 1,   nutrition: 1,   traitSens: 1.4, voice: 1.32,
    blurb: 'Tiny, wobbly and curious about everything.' },
  { id: 'sprout',    name: 'Sprout',    minGrowth: 80,   boop: 2,  size: 0.76, foodCost: 7,   nutrition: 1.2, traitSens: 1.15, voice: 1.16,
    blurb: 'Favorites and habits start to show.' },
  { id: 'rascal',    name: 'Rascal',    minGrowth: 420,  boop: 4, size: 0.9,  foodCost: 45,  nutrition: 1.5, traitSens: 1.0, voice: 1.04,
    blurb: 'Bold, bouncy, and figuring out who they are.' },
  { id: 'settled',   name: 'Settled',   minGrowth: 1600, boop: 8, size: 1.04, foodCost: 260, nutrition: 2,   traitSens: 0.7, voice: 0.94,
    blurb: 'All grown up, with a form shaped by everything you shared.' },
];

// Trait channels. Each food pushes one or more of these.
export const TRAITS = {
  sweet:   { name: 'Sweet',     color: '#ff9fd0', badge: 'Sweet-Natured', look: 'rosy sprinkles' },
  heat:    { name: 'Warm',      color: '#ff7a3d', badge: 'Warm-Hearted',  look: 'a little flame on top' },
  mineral: { name: 'Sturdy',    color: '#8b9fc4', badge: 'Iron-Bellied',  look: 'shiny iron studs' },
  nature:  { name: 'Leafy',     color: '#7fd66a', badge: 'Green Thumb',   look: 'a leaf sprout' },
  spark:   { name: 'Zippy',     color: '#ffe15a', badge: 'Static Spark',  look: 'a crackling antenna' },
  prism:   { name: 'Prismatic', color: '#a7dcff', badge: 'Prismatic',     look: 'sparkling crystals' },
};
export const TRAIT_IDS = Object.keys(TRAITS);

export const FOODS = [
  { id: 'cookie',  name: 'Cookie',        price: 5,  nutrition: 8,  fullness: 12, energy: 0,   joy: 6, traits: { sweet: 3 },
    unlock: 'hatchling', sound: 'crunch', reaction: 'hearts', blurb: 'Soft and sweet. Crumbs float inside for a while.' },
  { id: 'chili',   name: 'Chili',         price: 12, nutrition: 10, fullness: 10, energy: 14,  joy: 2, traits: { heat: 3, spark: 0.4 },
    unlock: 'hatchling', sound: 'sizzle', reaction: 'steam',  blurb: 'A spicy kick. Warms the body and might cause a sneeze.' },
  { id: 'iron',    name: 'Iron Scrap',    price: 20, nutrition: 16, fullness: 18, energy: -4,  joy: 0, traits: { mineral: 3 },
    unlock: 'hatchling', sound: 'clink',  reaction: 'clank',  blurb: 'Heavy and crunchy. Builds a dense, sturdy body.' },
  { id: 'moss',    name: 'Moss Cube',     price: 15, nutrition: 12, fullness: 15, energy: 10,  joy: 3, traits: { nature: 3, sweet: 0.4 },
    unlock: 'sprout',    sound: 'squelch', reaction: 'leaves', blurb: 'Cool and calming. Something might sprout.' },
  { id: 'berry',   name: 'Static Berry',  price: 30, nutrition: 12, fullness: 10, energy: 8,   joy: 5, traits: { spark: 3, sweet: 0.8 },
    unlock: 'sprout',    sound: 'zap',    reaction: 'sparks', blurb: 'Fizzes with static. Makes everything zippy.' },
  { id: 'crystal', name: 'Crystal Shard', price: 80, nutrition: 24, fullness: 8,  energy: 0,   joy: 4, traits: { prism: 3, mineral: 0.8 },
    unlock: 'rascal',    sound: 'chime',  reaction: 'prism',  blurb: 'Rare and refractive. Light bends right through it.' },
];
export const FOOD_BY_ID = Object.fromEntries(FOODS.map(f => [f.id, f]));

// Idle producers. Cost grows 15% per copy owned.
export const HELPERS = [
  { id: 'feather',     name: 'Tickle Feather',  plural: 'Tickle Feathers',  cost: 15,     jps: 0.1,    blurb: 'Drifts around and tickles now and then.' },
  { id: 'bubbles',     name: 'Bubble Wand',     plural: 'Bubble Wands',     cost: 100,    jps: 1,      blurb: 'Blows bubbles to chase. You can pop them too.' },
  { id: 'garden',      name: 'Snack Garden',    plural: 'Snack Gardens',    cost: 1100,   jps: 8,      blurb: 'Little planters that grow slime snacks.' },
  { id: 'slimeling',   name: 'Slimeling Pal',   plural: 'Slimeling Pals',   cost: 12000,  jps: 47,     blurb: 'A tiny friend who hops around and adores your slime.' },
  { id: 'musicbox',    name: 'Music Box',       plural: 'Music Boxes',      cost: 130000, jps: 260,    blurb: 'Plays a lullaby. Your slime sways along.' },
  { id: 'lamp',        name: 'Moon Lamp',       plural: 'Moon Lamps',       cost: 1.4e6,  jps: 1400,   blurb: 'Moon lamps on garden posts, with a soft, cozy glow.' },
  { id: 'fountain',    name: 'Goo Fountain',    plural: 'Goo Fountains',    cost: 2e7,    jps: 7800,   blurb: 'Burbles pure jelly all day long.' },
  { id: 'observatory', name: 'Dream Telescope', plural: 'Dream Telescopes', cost: 3.3e8,  jps: 44000,  blurb: 'Catches falling dream-stars for your slime.' },
  { id: 'spa',         name: 'Slime Spa',       plural: 'Slime Spas',       cost: 2.4e10, jps: 260000, blurb: 'A warm, bubbly bath. Pure bliss for any slime.' },
  { id: 'rainbow',     name: 'Rainbow Arch',    plural: 'Rainbow Arches',   cost: 1.2e12, jps: 4.2e6,  blurb: 'A rainbow over the nursery that drizzles jelly.' },
];
export const HELPER_BY_ID = Object.fromEntries(HELPERS.map(h => [h.id, h]));
export const HELPER_GROWTH = 1.15;

// Upgrades unlock when `req` passes. Effects are merged by the simulation.
// Every helper gets five "works twice as well" tiers, unlocked at 1, 10, 25, 50 and 100 owned.
const TIER_AT = [1, 10, 25, 50, 100];
const TIER_COST = [10, 50, 500, 5000, 50000];
const TIER_NAMES = {
  feather:     ['Fluffier Feathers', 'Silk Feathers', 'Rainbow Plumes', 'Phoenix Quills', 'Featherstorm'],
  bubbles:     ['Big Bubbles', 'Rainbow Soap', 'Bubble Choir', 'Everlasting Bubbles', 'Bubble Galaxy'],
  garden:      ['Magic Compost', 'Sunny Windowsill', 'Candy Seeds', 'Greenhouse Glass', 'Endless Orchard'],
  slimeling:   ['Sibling Love', 'Playdates', 'Slimeling Choir', 'Family Reunion', 'Big Happy Family'],
  musicbox:    ['Lullaby Book', 'Golden Gears', 'Second Melody', 'Harmony Comb', 'Symphony Box'],
  lamp:        ['Moonbeam Wicks', 'Starlight Glass', 'Lunar Tides', 'Full Moon Festival', 'Moonlit Garden'],
  fountain:    ['Deep Springs', 'Sparkling Spout', 'Twin Basins', 'Jelly Geyser', 'Ocean of Goo'],
  observatory: ['Star Charts', 'Bigger Lens', 'Comet Catcher', 'Constellation Atlas', 'Dream Nebula'],
  spa:         ['Bath Salts', 'Bubble Jets', 'Warm Stones', 'Moonlight Soak', 'Infinity Pool'],
  rainbow:     ['Brighter Bands', 'Double Rainbow', 'Pot of Goo', 'Rainbow Road', 'Endless Spectrum'],
};
const HELPER_TIERS = HELPERS.flatMap(h => TIER_AT.map((n, i) => ({
  id: `${h.id}${i + 1}`, name: TIER_NAMES[h.id][i], cost: h.cost * TIER_COST[i], kind: 'helper', helper: h.id,
  blurb: `${h.plural} work twice as well.`, req: g => g.helpers[h.id] >= n, fx: { helper: { [h.id]: 2 } },
})));

export const UPGRADES = [
  { id: 'softTouch',      name: 'Soft Touch',        cost: 100,    blurb: 'Boops give twice as much jelly.',                          req: g => g.stats.boops >= 15, fx: { boopMult: 2 } },
  { id: 'autoFeeder',     name: 'Cookie Jar Feeder', cost: 300,    blurb: 'Buys and feeds a Cookie whenever the tummy runs low.',      req: g => g.stageIndex >= 1, fx: { autoFeed: true } },
  { id: 'giggleTraining', name: 'Giggle Training',   cost: 500,    blurb: 'Giggle Fever triples boops and is easier to keep going.',    req: g => g.stats.fevers >= 1, fx: { feverMult: 3, feverWindow: 10 } },
  { id: 'warmHands',      name: 'Warm Hands',        cost: 800,    blurb: 'Petting gives three times the jelly and bond.',            req: g => g.stats.petTime >= 15, fx: { petMult: 3 } },
  { id: 'cozyBlanket',    name: 'Cozy Blanket',      cost: 1500,   blurb: 'Naps restore energy twice as fast. Dream jelly doubled.',   req: g => g.stats.naps >= 1, fx: { napMult: 2 } },
  { id: 'squishy',        name: 'Squishy Fingers',   cost: 2500,   blurb: 'Boops give twice as much jelly.',                          req: g => g.stats.boops >= 300, fx: { boopMult: 2 } },
  { id: 'metabolism',     name: 'Speedy Tummy',      cost: 3000,   blurb: 'Digests 50% faster, so your slime can eat more often.',    req: g => g.stageIndex >= 1 && g.stats.feeds >= 20, fx: { digestMult: 1.5 } },
  { id: 'heartToHeart',   name: 'Heart to Heart',    cost: 5000,   blurb: '+5% jelly per second for every bond level.',               req: g => g.bondLevel >= 3, fx: { bondBonus: 0.05 } },
  { id: 'luckyCharm',     name: 'Lucky Charm',       cost: 7777,   blurb: 'Lucky Glimmers show up twice as often.',                   req: g => g.stats.glimmers >= 1, fx: { glimmerRate: 2 } },
  { id: 'recipeBook',     name: 'Recipe Book',       cost: 20000,  blurb: 'Combo effects last twice as long.',                        req: g => g.combos >= 2, fx: { comboDur: 2 } },
  { id: 'showOff',        name: 'Show-Off',          cost: 50000,  blurb: '+3% jelly per second for every trick your slime knows.',   req: g => g.tricks >= 1, fx: { trickBonus: 0.03 } },
  { id: 'resonance',      name: 'Gooey Resonance',   cost: 50000,  blurb: 'Every boop also gives 2% of your jelly per second.',       req: g => g.stats.boops >= 800 && g.jps >= 50, fx: { boopJps: 0.02 } },
  { id: 'secretKeeper',   name: 'Secret Keeper',     cost: 150000, blurb: '+2% jelly per second for every secret you have found.',    req: g => g.secrets >= 3, fx: { secretBonus: 0.02 } },
  { id: 'jellyFingers',   name: 'Jelly Fingers',     cost: 750000, blurb: 'Boops give twice as much jelly.',                          req: g => g.stats.boops >= 2500, fx: { boopMult: 2 } },
  { id: 'grownUpGlow',    name: 'Grown-Up Glow',     cost: 2e7,    blurb: 'All jelly +25%. Being grown up suits your slime.',         req: g => g.stageIndex >= 3, fx: { globalMult: 1.25 } },
  { id: 'goldenTouch',    name: 'Golden Touch',      cost: 7.7e7,  blurb: 'Lucky Glimmer rewards are doubled.',                       req: g => g.stats.glimmers >= 7, fx: { glimmerMult: 2 } },
  { id: 'deepResonance',  name: 'Deep Resonance',    cost: 1e8,    blurb: 'Every boop also gives 3% more of your jelly per second.',  req: g => g.stats.boops >= 6000, fx: { boopJps: 0.03 } },
  { id: 'soulSync',       name: 'Soul Sync',         cost: 2e8,    blurb: 'Another +5% jelly per second for every bond level.',       req: g => g.bondLevel >= 6, fx: { bondBonus: 0.05 } },
  { id: 'wiseOldSlime',   name: 'Wise Old Slime',    cost: 2e10,    blurb: 'All jelly +25%.',                                          req: g => g.stageIndex >= 3 && g.bondLevel >= 5, fx: { globalMult: 1.25 } },
  { id: 'totalResonance', name: 'Total Resonance',   cost: 5e11,   blurb: 'Every boop also gives 5% more of your jelly per second.',  req: g => g.stats.boops >= 15000, fx: { boopJps: 0.05 } },
  { id: 'foreverBond',    name: 'Forever Bond',      cost: 5e13,   blurb: 'Another +10% jelly per second for every bond level.',      req: g => g.bondLevel >= 9, fx: { bondBonus: 0.1 } },
  ...HELPER_TIERS,
];
// Older saves used these ids for the first helper upgrades.
export const UPGRADE_RENAMES = {
  featherFluff: 'feather1', silkFeathers: 'feather2', bigBubbles: 'bubbles1', rainbowSoap: 'bubbles2', compost: 'garden1',
  siblingLove: 'slimeling1', lullabyBook: 'musicbox1', moonbeams: 'lamp1', deepSprings: 'fountain1', starCharts: 'observatory1',
};
export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map(u => [u.id, u]));

// Feeding two foods in order within the combo window creates a named combination.
export const COMBOS = [
  { id: 'hearth',   name: 'Hearth Biscuit', seq: ['cookie', 'chili'],  hint: 'Something sweet, then a little spice...',
    effect: 'Warm & Cozy: +50% jelly per second for 45s', buff: { id: 'cozy', name: 'Warm & Cozy', dur: 45, jpsMult: 1.5 } },
  { id: 'tempered', name: 'Tempered Treat', seq: ['cookie', 'iron'],   hint: 'Something sweet, then something sturdy...',
    effect: 'Sturdy Belly: no dizziness for 45s', buff: { id: 'sturdy', name: 'Sturdy Belly', dur: 45, noDizzy: true } },
  { id: 'ember',    name: 'Rooted Ember',   seq: ['moss', 'chili'],    hint: 'Something calm, then something fiery...',
    effect: 'Steady Glow: boops cost no energy for 60s', buff: { id: 'steady', name: 'Steady Glow', dur: 60, noEnergyDrain: true } },
  { id: 'fizzy',    name: 'Fizzy Pop',      seq: ['berry', 'cookie'],  hint: 'A fizzy berry, then a treat...',
    effect: 'Fizzy Fingers: boops x3 for 20s', buff: { id: 'fizzy', name: 'Fizzy Fingers', dur: 20, boopMult: 3 } },
  { id: 'geode',    name: 'Geode Snack',    seq: ['iron', 'moss'],     hint: 'Metal, then moss...',
    effect: 'A big growth spurt', growth: 30 },
  { id: 'prismpop', name: 'Prism Pop',      seq: ['crystal', 'berry'], hint: 'A crystal, then a spark...',
    effect: 'Rainbow Shine: jelly x2 for 30s, and a Lucky Glimmer appears', buff: { id: 'shine', name: 'Rainbow Shine', dur: 30, jpsMult: 2 }, glimmer: true },
];

export const BOND = [
  { xp: 0,    title: 'Curious Stranger' },
  { xp: 15,   title: 'New Friend',     unlock: 'Watches you wherever you go' },
  { xp: 50,   title: 'Buddy',          unlock: 'Leans toward you when you come close' },
  { xp: 120,  title: 'Pal',            unlock: 'Does a happy dance when you come back' },
  { xp: 250,  title: 'Close Friend',   unlock: 'Floats little hearts when you hover nearby' },
  { xp: 450,  title: 'Best Friend',    unlock: 'Blows you kisses' },
  { xp: 750,  title: 'Inseparable',    unlock: 'Hums a little tune when happy' },
  { xp: 1150, title: 'Kindred Spirit', unlock: 'Glows softly when you pet them' },
  { xp: 1700, title: 'Soulbound',      unlock: 'Shakes off dizziness twice as fast' },
  { xp: 2500, title: 'Forever Family', unlock: 'Remembers everything' },
];

export const PERSONALITY = {
  curious: { low: 'Likes the familiar', high: 'Endlessly curious', grow: 'more curious', shrink: 'more cautious' },
  patient: { low: 'Impulsive',          high: 'Patient',           grow: 'more patient', shrink: 'more impulsive' },
  playful: { low: 'Mellow',             high: 'Playful',           grow: 'more playful', shrink: 'more mellow' },
  cuddly:  { low: 'Independent',        high: 'Cuddly',            grow: 'more cuddly',  shrink: 'more independent' },
  bold:    { low: 'Shy',                high: 'Bold',              grow: 'bolder',       shrink: 'shyer' },
};
export const PERSONALITY_IDS = Object.keys(PERSONALITY);

// Mature forms. Read from the two strongest traits; a pure diet gives a pure form;
// a balanced or light diet gives a healthy generalist.
export const PURE_FORMS = {
  sweet:   { name: 'Candy Slime',   blurb: 'Pure sugar and sunshine. Makes friends instantly.' },
  heat:    { name: 'Blaze Slime',   blurb: 'Runs hot and loves a challenge.' },
  mineral: { name: 'Iron Slime',    blurb: 'Dense as a boulder and just as dependable.' },
  nature:  { name: 'Moss Slime',    blurb: 'Calm and green. Little things grow wherever it rests.' },
  spark:   { name: 'Volt Slime',    blurb: 'Crackles with static and never sits still.' },
  prism:   { name: 'Crystal Slime', blurb: 'Clear as glass, bending light into rainbows.' },
};
export const PAIR_FORMS = {
  'heat+sweet':     { name: 'Hearth Slime',     blurb: 'Gives off a cozy warmth. Everyone wants to sit nearby.' },
  'heat+mineral':   { name: 'Furnace Slime',    blurb: 'Hot, heavy and tireless, with a glowing core.' },
  'nature+sweet':   { name: 'Nectar Slime',     blurb: 'Sweet-smelling. Flowers lean toward it.' },
  'mineral+nature': { name: 'Root Slime',       blurb: 'Patient and grounded, with roots that hold the soil.' },
  'prism+spark':    { name: 'Aurora Slime',     blurb: 'Shimmers in waves of colored light.' },
  'mineral+prism':  { name: 'Geode Slime',      blurb: 'Hard outside, sparkling inside. Sings when tapped.' },
  'heat+spark':     { name: 'Firework Slime',   blurb: 'Pops and crackles whenever it gets excited.' },
  'spark+sweet':    { name: 'Fizzy Slime',      blurb: 'Bubbly and giggly, like a soda that never goes flat.' },
  'nature+spark':   { name: 'Firefly Slime',    blurb: 'Blinks softly in the dark among the leaves.' },
  'heat+nature':    { name: 'Sunbloom Slime',   blurb: 'Warm as a summer garden.' },
  'mineral+spark':  { name: 'Dynamo Slime',     blurb: 'Hums with stored energy. Great at keeping lights on.' },
  'prism+sweet':    { name: 'Sugarglass Slime', blurb: 'Glossy and glittering, like candy glass.' },
  'heat+prism':     { name: 'Sunstone Slime',   blurb: 'Glows like a gem held up to the sun.' },
  'nature+prism':   { name: 'Dewdrop Slime',    blurb: 'Fresh as morning, sparkling with tiny droplets.' },
  'mineral+sweet':  { name: 'Toffee Guardian',  blurb: 'Sturdy and loyal, with a soft center.' },
};
export const GENERALIST_FORM = { name: 'Marshmallow Slime', blurb: 'Soft, round and balanced. A little bit of everything.' };
// Every grown-up form by id (the 22 the diet can give).
export const FORM_BY_ID = { ...PURE_FORMS, ...PAIR_FORMS, mochi: GENERALIST_FORM };
export const FORM_IDS = Object.keys(FORM_BY_ID);

export const NAME_IDEAS = ['Mochi', 'Puddle', 'Gloop', 'Bean', 'Jellybean', 'Pudding', 'Wobbles', 'Boba', 'Dumpling',
  'Squish', 'Gumdrop', 'Tofu', 'Marble', 'Noodle', 'Pip', 'Dewdrop', 'Blip', 'Muffin', 'Plum', 'Biscuit'];

// Emotes you can do at your slime. It copies you, clumsily at first; after three tries it learns
// the trick for good and starts doing it on its own.
export const EMOTES = [
  { id: 'wave',     name: 'Wave',     icon: '👋' },
  { id: 'dance',    name: 'Dance',    icon: '💃' },
  { id: 'kiss',     name: 'Kiss',     icon: '😘' },
  { id: 'spin',     name: 'Spin',     icon: '🌀', stage: 1, lock: 'Unlocks at Sprout' },
  { id: 'peekaboo', name: 'Peekaboo', icon: '🙈', bond: 2,  lock: 'Unlocks at bond: Buddy' },
  { id: 'sing',     name: 'Sing',     icon: '🎵', bond: 4,  lock: 'Unlocks at bond: Close Friend' },
];
export const TRICK_LEARNED = 3;

// Hidden interactions. The Journal shows a vague clue for each one.
export const SECRETS = [
  { id: 'taffy',    name: 'Taffy Pull',     clue: 'Slimes are stretchier than they look.',       text: 'You stretched it like taffy and let it snap back.' },
  { id: 'hug',      name: 'Big Hug',        clue: 'Some boops should last a little longer.',     text: 'Press and hold for a squishy hug.' },
  { id: 'melt',     name: 'Melted',         clue: 'Round and round and round...',                text: 'Rubbing in circles melts it into a happy puddle.' },
  { id: 'shake',    name: 'Shake It Up',    clue: 'What happens if you give it a good shake?',   text: 'Shake it back and forth. Not too long!' },
  { id: 'spin',     name: 'Spin Cycle',     clue: 'Give it a flick.',                            text: 'A quick sideways swipe sends it spinning.' },
  { id: 'tickle',   name: 'Tickle Attack',  clue: 'Everyone has a ticklish side.',               text: 'Boop its sides quickly for a laughing fit.' },
  { id: 'highfive', name: 'High Five',      clue: 'Pat-pat on the head, then...',                text: 'Double-tap its head, then tap the hand it offers.' },
  { id: 'nom',      name: 'Nom Nom',        clue: 'What happens near its mouth?',                text: 'Boop its mouth and it nibbles your finger.' },
  { id: 'pokewar',  name: 'Boop War',       clue: 'Eyes are for looking, not poking...',         text: 'Poke its eyes enough and it boops you back.' },
  { id: 'hiccup',   name: 'Hiccup Cure',    clue: 'Eating too fast has side effects.',           text: 'A surprise boop scares the hiccups away.' },
  { id: 'burp',     name: 'Excuse Me',      clue: 'A really, really full tummy...',              text: 'Fill its tummy to the top.' },
  { id: 'name',     name: 'Name Call',      clue: 'It knows its own name. Call it.',             text: 'Tap its name (or type it on a keyboard) and it answers.' },
  { id: 'midnight', name: 'Midnight Snack', clue: 'Hungry after midnight?',                      text: 'Feed it between midnight and 4 AM.' },
  { id: 'rainbow',  name: 'Rainbow Mode',   clue: 'An old cheat code still works here. Phones can swipe it.', text: '↑ ↑ ↓ ↓ ← → ← → B A. On a phone: swipe those directions on the background, then tap twice.' },
];

// The Jelly Jar catches what helpers make while you're away. Upgrade it to hold more.
// Upgrade cost is a number of minutes of your current helper output (with a floor).
export const JAR_LEVELS = [
  { hours: 2,  rate: 0.15 },
  { hours: 4,  rate: 0.15, minutes: 15,  floor: 2500 },
  { hours: 8,  rate: 0.20, minutes: 45,  floor: 50000 },
  { hours: 12, rate: 0.25, minutes: 120, floor: 2e6 },
  { hours: 24, rate: 0.30, minutes: 360, floor: 1e8 },
];

// Outfits: pure dress-up. Each slime secretly has one favorite, which makes it extra happy.
export const OUTFITS = [
  { id: 'bow',     slot: 'head', name: 'Ribbon Bow',    cost: 1000,  blurb: 'A big floppy bow.' },
  { id: 'bowtie',  slot: 'neck', name: 'Bow Tie',       cost: 6000,  blurb: 'Very dapper.' },
  { id: 'glasses', slot: 'face', name: 'Round Glasses', cost: 5e4, blurb: 'For reading the Journal.' },
  { id: 'flowers', slot: 'head', name: 'Flower Crown',  cost: 5e5, blurb: 'Fresh from the Snack Garden.' },
  { id: 'scarf',   slot: 'neck', name: 'Cozy Scarf',    cost: 5e6,   blurb: 'Knitted by the slimeling pals.' },
  { id: 'beret',   slot: 'head', name: 'Artist Beret',  cost: 5e7,   blurb: 'Instantly sophisticated.' },
  { id: 'shades',  slot: 'face', name: 'Star Shades',   cost: 5e8,   blurb: 'Too cool to blink.' },
  { id: 'party',   slot: 'head', name: 'Party Hat',     cost: 5e9,   blurb: 'Every day is a celebration.' },
  { id: 'crown',   slot: 'head', name: 'Tiny Crown',    cost: 1e11,   blurb: 'Ruler of the nursery.' },
];
export const OUTFIT_BY_ID = Object.fromEntries(OUTFITS.map(o => [o.id, o]));

// ---------- The ranch (grown-up slimes) and pearls ----------
// Moving a grown slime to the ranch starts a new generation: everything bought with jelly resets
// (jelly, helpers, upgrades, Jelly Jar), outfits and discoveries stay, and the family grows stronger.
export const RANCH = {
  startSlots: 3,
  maxSlots: 10,
  slotCosts: [20, 45, 90, 160, 260, 400, 600],      // pearls for slots 4..10
  basket: [                                          // the Pearl Basket catches pearls you haven't picked up
    { cap: 12 },
    { cap: 30, cost: 15 },
    { cap: 80, cost: 40 },
    { cap: 200, cost: 100 },
    { cap: 500, cost: 250 },
  ],
  pearlMinutes: 15,          // each resident makes a pearl about every 15 minutes when happy
  happyDecayPerHour: 4,      // happiness slowly fades (never below 0); pets and visits bring it back
  petHappy: 15,
  petCooldown: 40,           // seconds before the same slime's pet counts again
  visitHappy: 6,
  visitCooldown: 1800,
  welcomeGift: 10,           // pearls for the very first move-in
  grassLife: 120,            // seconds a dropped pearl waits in the grass before rolling into the basket
  postcardDays: 7,           // placed slimes send postcards for a week
  // Family Bonus (percent) = bonusPercent * cbrt(family lifetime jelly / bonusJelly): all the jelly every slime in the
  // family ever made (plus an old save's hidden head start, family.legacy), recomputed at each move-out.
  bonusPercent: 5,
  bonusJelly: 1e7,
};

// Buyers for placement and auctions. "want" lists traits that make a slime a good fit;
// an empty list prefers well-rounded slimes.
export const BUYERS = [
  { id: 'bakery',    name: 'Sugarvale Bakery',       want: ['sweet', 'heat'],    line: 'needs a warm helper to keep the ovens cozy.', card: 'They let me nap next to the oven. Everything smells like cookies!', babyCard: 'I helped stir the cookie dough! Mostly I sat in the flour.' },
  { id: 'garden',    name: 'Willowbend Gardens',     want: ['nature'],           line: 'is looking for a friend for the greenhouse.', card: 'I sat in the tomato patch all day. The bees say hi.', babyCard: 'The snails and I had a slow race. We both won.' },
  { id: 'mine',      name: 'Pebblepeak Mine',        want: ['mineral'],          line: 'wants a sturdy partner who loves rocks.',     card: 'I found a shiny rock! I am keeping it forever.', babyCard: 'I found a tiny pebble. It is my pet now.' },
  { id: 'observe',   name: 'Starlight Observatory',  want: ['prism', 'spark'],   line: 'needs someone to light up the telescope dome.', card: 'We counted 300 stars last night. I counted 4, then fell asleep.', babyCard: 'I saw a shooting star and made a wish for you.' },
  { id: 'windmill',  name: 'Breezy Windmill',        want: ['spark'],            line: 'needs a zippy friend to keep the lights on.',  card: 'I spin with the windmill blades sometimes. Wheee!', babyCard: 'I can spin around three times without falling over!' },
  { id: 'cafe',      name: 'Puddle Café',            want: ['sweet'],            line: 'wants a greeter that makes guests smile.',     card: 'A little kid gave me a sprinkle today. Best day.', babyCard: 'I wiggle hello at the door. Everyone waves back!' },
  { id: 'school',    name: 'Little Sprouts School',  want: [],                   line: 'would love a gentle class pet.',               card: 'The kids drew me! I look like a potato. I love it.', babyCard: 'I learned to hop on one side! The kids clap every time.' },
  { id: 'springs',   name: 'Mistwater Hot Springs',  want: ['heat', 'nature'],   line: 'wants a cozy companion for the warm pools.',  card: 'I soaked so long I got extra squishy.', babyCard: 'I had my first warm bath and fell asleep in it.' },
  { id: 'museum',    name: 'Glimmer Museum',         want: ['prism', 'mineral'], line: 'wants a sparkly star for the gem hall.',       card: 'People stare at me like I am a famous painting.', babyCard: 'I sat very still on a velvet pillow. People think I am art.' },
  { id: 'festival',  name: 'Summer Festival Crew',   want: ['heat', 'spark'],    line: 'needs help with the fireworks show.',          card: 'BOOM! Pop! Sparkle! (I was very brave.)', babyCard: 'I watched the fireworks from a cozy blanket. So sparkly!' },
];
export const BUYER_BY_ID = Object.fromEntries(BUYERS.map(b => [b.id, b]));

// ---------- Breeding: the Nursery on the ranch ----------
// Two ranch slimes make an egg together. The baby takes after its parents a little (a capped head start
// in the snacks they were raised on, a small nudge to its temperament, maybe the same favorite snack);
// how you raise it still decides who it becomes. Not inherited: form, bond, tricks, outfits, value.
export const BREEDING = {
  cost: 25,             // pearls for one egg
  readyHours: 1,        // an egg is ready after this long (real time, so it counts while the game is closed)
  maxEggs: 2,           // eggs waiting in the Nursery at once
  // each resident can be a parent once per (local) calendar day
  // Inheritance per trait channel (per the design doc): 35% from each parent (its share of that channel,
  // 0..1), 20% from how much both parents share it, 10% seeded wobble (-0.5..0.5), minus a concentration
  // penalty; the result is clamped to the cap and turned into trait points with the range below.
  range: 140,           // the typical mature channel range: trait points of the top channel at Settled (measured, see tools/breeding-test.mjs)
  cap: 0.22,            // per-channel cap as a share of that range: at most about 31 points of head start in one channel
  totalCap: 0.4,        // all channels together: at most 56 points, so care always decides the form
  weights: { parent: 0.35, compat: 0.2, variation: 0.1 },
  regress: 0.5,         // concentration: a family line that keeps leaning the same way has its cap shrink (up to half)
  personalityPull: 0.2, // temperament starts this share of the way toward the parents' average...
  personalityCap: 5,    // ...but at most 5 points
  favoriteChance: 0.5,  // chance the baby's favorite snack is one of its parents' favorites
};

// Family sparks: some pairs of parent forms (order does not matter) always lay a spark egg. A spark baby
// whose two strongest traits come out as the recipe (about evenly, the way a normal slime gets a two-trait
// form) grows into the spark form; otherwise it settles into its normal form and the Journal keeps a clue.
// Adding one later = one entry here plus one look in view/forms.js (FORM_LOOKS[look]).
export const SPARK_FORMS = [
  { id: 'smore', name: "S'more Slime", parents: ['heat+sweet', 'mochi'], recipe: ['sweet', 'heat'], look: 'spark:smore', icon: '🍫', color: '#e9a35a',
    blurb: 'Toasty outside, gooey inside. Happiest by a campfire.',
    hint: 'Something cozy and warm, with something soft and round...', clue: 'Raise the baby on sweet and warm snacks, about evenly.' },
  { id: 'honeycomb', name: 'Honeycomb Slime', parents: ['nature+sweet', 'sweet'], recipe: ['sweet', 'nature'], look: 'spark:honeycomb', icon: '🍯', color: '#ffbf2e',
    blurb: 'Sweet as honey and busy as a bee. Shares with everyone.',
    hint: 'Where the flower garden meets the candy jar...', clue: 'Raise the baby on sweet and leafy snacks, about evenly.' },
  { id: 'campfire', name: 'Campfire Slime', parents: ['heat+sweet', 'mineral+nature'], recipe: ['heat', 'nature'], look: 'spark:campfire', icon: '🔥', color: '#ff9a3c',
    blurb: 'A warm little fire that everyone gathers around for stories.',
    hint: 'Something cozy and warm, with something rooted in the ground...', clue: 'Raise the baby on warm and leafy snacks, about evenly.' },
  { id: 'storm', name: 'Storm Slime', parents: ['prism+spark', 'spark'], recipe: ['spark', 'prism'], look: 'spark:storm', icon: '🌈', color: '#9fc8ff',
    blurb: 'A happy little raincloud. After every sprinkle comes a rainbow.',
    hint: 'Colored lights and crackles in the same sky...', clue: 'Raise the baby on zippy and prismatic snacks, about evenly.' },
];
export const SPARK_BY_ID = Object.fromEntries(SPARK_FORMS.map(s => [s.id, s]));

// Pure: both parents had the same form, and the baby grows into that form too.
export const PURE_LINE = {
  name: formName => `Pure ${formName}`,
  note: 'Same form as both parents: a pure family line.',
};

// ---------- Breeds: the recipe body ----------
// Every slime is the same soft body (view/slime.js) plus a recipe: a short list of numbers (core/recipe.js blends
// them). Two breeds share the body: Curly (the drop with the curl on top) and Dollop (a soft gummy dome). Growing up,
// and mixing the two breeds, only blend numbers, so nothing pops: a feature (the curl, ears, a knob) grows or melts
// away by its size. Eggs hatch pure (Curly or Dollop); in-betweens come only from breeding a Curly with a Dollop.
//
// Body numbers (all on the unit body; the ring axis of the curl leans back and to the right):
//   tall, wide         height of the top half, width              side       cheeks (fuller around the middle)
//   peak               a pointed top (the baby drop)               flat       a flatter top
//   lip, lipc, lipw    the goo lip around the bottom: size, height, width;   sag  how far the lip sags to the floor
//   flowA, flow2       how uneven the lip flows around (3+5 lobes, and a 2-lobe lean); skirtWave  a slow wave above it
//   crease             a soft crease at the waist                  lump       living lumps drifting over the body
//   baseFlow           the young body's lower half flowing (the grown has its lip instead)
//   theta, L, bend     the curl: how wide its base is (radians), length, how much it curls
//   ra, rt             the curl's thickness at its base and before the tip;   armK  how much curl there is (0 = none)
//   feet               the baby's two little feet (0 = tucked in)  faceEl     how high the face sits (radians)
// bumps: [direction, size, softness] soft lumps;  knobs: [direction, size, width, shape] (shape 0 = round knob,
// 1 = pointed cat ear). Directions are normalized by core/recipe.js.
export const BREEDS = {
  ids: ['curly', 'dollop'],
  names: { curly: 'Curly', dollop: 'Dollop', mixed: 'Curly × Dollop' },
  // growth: the shape number m for each stage (0 = baby drop .. 1 = grown), blended along a stage's progress;
  // the body eases toward it (per second), so growing up is a slow morph, never a jump
  stageM: [0, 0.35, 0.65, 1],   // Hatchling, Sprout, Rascal, Settled
  growEase: 2.5,
  mixEase: 3,
  // Curly: every number goes from the baby value (m = 0) to the grown value (m = 1): evenly, or only between
  // m = a and m = b (`lin: [a, b]` evenly, `sm: [a, b]` smoothly)
  curly: {
    grow: {
      tall: [1.16, 1.1], wide: [0.9, 1.0], peak: [0.8, 0, { lin: [0, 0.8] }],
      lip: [0, 0.16, { sm: [0.15, 1] }], crease: [0, 0.045, { sm: [0.3, 1] }], lump: [0.036, 0.045],
      theta: [0.5, 0.3], L: [0.5, 0.8], bend: [2.4, 2.6], ra: [0.15, 0.17], rt: [0.11, 0.12],
      feet: [1, 0, { sm: [0.15, 0.7] }], faceEl: [0.06, 0.3], baseFlow: [0.045, 0, { sm: [0.5, 1] }],
    },
    fixed: { side: 0, flat: 0, skirtWave: 0, lipc: -0.3, lipw: 0.3, sag: 0.8, flowA: 1, flow2: 0, armK: 1 },
  },
  // Dollop: a baby (m = 0), a teen (m = teenAt) and a grown body per variant, each blended to the next. Numbers not
  // given come from `base`. plain = the mini mochi baby; ears and topknot are the special types (pearl eggs, or a
  // small surprise from a plain egg) and keep a smaller ear or knob when grown (`keep`), so they still look special.
  dollop: {
    teenAt: 0.5,
    base: { tall: 1, wide: 1, peak: 0, side: 0, flat: 0, lip: 0.1, crease: 0, lump: 0.034, skirtWave: 0, lipc: -0.36, lipw: 0.24,
      sag: 1.0, flowA: 1.2, flow2: 0.4, baseFlow: 0.03, theta: 0.3, L: 0.5, bend: 2.4, ra: 0.15, rt: 0.11, armK: 0, feet: 0, faceEl: 0.12 },
    grown: {
      body: { tall: 0.98, wide: 1.04, side: 0.09, flat: 0.12, lip: 0.2, crease: 0.035, lump: 0.042, skirtWave: 0.05, lipc: -0.46, lipw: 0.22,
        sag: 0.85, flowA: 1.8, flow2: 0.7, baseFlow: 0, faceEl: 0.2 },
      bumps: [[[0.45, 0.85, -0.25], 0.085, 0.07], [[-0.42, 0.86, 0.05], 0.05, 0.09], [[0.95, 0.12, 0.25], 0.065, 0.06], [[-0.96, 0.05, 0.28], 0.04, 0.07], [[0.15, -0.05, 1.0], 0.03, 0.1]],
    },
    variants: {
      plain: {
        baby: { body: { tall: 0.86, wide: 1.0, side: 0.1, flat: 0.1, lip: 0.14, lipc: -0.44, lipw: 0.22, flowA: 1.4, flow2: 0.5, faceEl: 0.14 }, bumps: [[[0.3, 0.9, -0.2], 0.035, 0.08]] },
        teen: { body: { tall: 0.93, wide: 1.02, side: 0.1, flat: 0.11, lip: 0.17, lipc: -0.45, lipw: 0.22, sag: 0.95, flowA: 1.6, flow2: 0.6, faceEl: 0.18 },
          bumps: [[[0.42, 0.87, -0.24], 0.06, 0.07], [[-0.4, 0.88, 0.05], 0.04, 0.09], [[0.92, 0.15, 0.25], 0.04, 0.06]] },
        keep: null,
      },
      ears: {
        baby: { body: { tall: 1.0, wide: 0.9, side: 0.05, lip: 0.12, lipc: -0.42, lipw: 0.2, faceEl: 0.08 }, bumps: [[[0.5, 0.86, -0.12], 0.05, 0.05], [[-0.46, 0.88, -0.05], 0.05, 0.05]],
          knobs: [[[0.52, 0.84, -0.1], 0.26, 0.3, 1], [[-0.48, 0.86, -0.03], 0.25, 0.3, 1]] },
        teen: { body: { tall: 1.0, wide: 0.96, side: 0.06, flat: 0.05, lip: 0.15, lipc: -0.44, flowA: 1.5, flow2: 0.6, faceEl: 0.15 },
          bumps: [[[0.5, 0.84, -0.2], 0.05, 0.05], [[-0.44, 0.88, 0.0], 0.04, 0.05], [[0.9, 0.2, 0.25], 0.04, 0.06]],
          knobs: [[[0.54, 0.82, -0.16], 0.21, 0.27, 1], [[-0.48, 0.85, 0.0], 0.2, 0.27, 1]] },
        keep: { knobs: [[[0.55, 0.81, -0.2], 0.17, 0.24, 1], [[-0.5, 0.84, -0.02], 0.16, 0.24, 1]] },
      },
      topknot: {
        baby: { body: { tall: 0.9, wide: 0.95, side: 0.08, lip: 0.2, lipc: -0.64, lipw: 0.12, sag: 2.2, flowA: 1.4, flow2: 0.4, faceEl: 0.05 }, knobs: [[[0.05, 1.0, -0.12], 0.2, 0.34]] },
        teen: { body: { tall: 0.96, wide: 0.98, side: 0.07, flat: 0.04, lip: 0.19, lipc: -0.56, lipw: 0.17, sag: 1.6, flowA: 1.5, flow2: 0.5, faceEl: 0.13 },
          knobs: [[[0.26, 0.96, -0.14], 0.12, 0.36], [[-0.22, 0.97, 0.02], 0.09, 0.34]] },
        keep: { body: { flat: 0.08 }, knobs: [[[0.08, 1.0, -0.1], 0.15, 0.3]] },
      },
    },
  },
  // genes: small personal quirks, fixed when the egg is made (seeded): tall, wide and lump multiply, side adds
  geneRange: { tall: 0.08, wide: 0.07, lump: 0.35, side: 0.04 },
  geneWobble: { tall: 0.015, wide: 0.015, lump: 0.08, side: 0.015 },   // a bred egg: the parents' average, plus this much
  // a plain egg: which breed hatches (weights), and the small surprise chance of a special Dollop (of Dollop hatches;
  // the Wishing Star heirloom multiplies it), then which special type (weights)
  hatch: { curly: 50, dollop: 50 },
  surprise: 1 / 20,
  surpriseVariants: { ears: 1, topknot: 1 },
  // a Curly × Dollop egg: the baby's mix (0 = Curly .. 1 = Dollop) lands this share of the way between its parents'
  // (Curly × Dollop: 0.25 .. 0.75). Two parents of the same breed (and mix) make a baby of that breed.
  mixBetween: [0.25, 0.75],
  passSpecial: 0.5,   // a parent with ears or a topknot: the chance its baby gets it too (else plain)
  // special eggs, bought with pearls in the Nursery: the type is guaranteed (a Dollop of that variant). They wait in
  // the Nursery like a bred egg (same warm time, same nest limit). 75 pearls = 3 Nursery eggs.
  specialEggs: {
    ears:    { name: 'Cat-ear egg', price: 75, blurb: 'A Dollop with little cat ears, every time.', colors: ['#c9b6ff', '#ffd1ea', '#fff1c9'] },
    topknot: { name: 'Topknot egg', price: 75, blurb: 'A Dollop with a round topknot, every time.', colors: ['#9ed8ff', '#ffe3a8', '#fff1c9'] },
  },
  variantNames: { plain: 'Dollop', ears: 'Cat-ear Dollop', topknot: 'Topknot Dollop' },
};

// ---------- The jelly loop: medals, heirlooms, Moving Day ----------
// Slime medals: a step every x10 of a slime's own jelly (s.totalJelly while you raise it, runTotal for a ranch
// resident), earned live while you raise it. Every grown (Settled) slime has at least the Ribbon; the jelly steps
// start once it is grown (jelly it made before still counts). Never inherited. Ranch perks: `pearls` multiplies the
// pearls it makes, `offers` adds to what buyers pay (new homes and auctions). Icons are placeholders (emoji).
export const MEDALS = [
  { id: 'ribbon',   name: 'Grown-Up Ribbon', title: 'the Grown-Up Ribbon', icon: '🎀', jelly: 0,    pearls: 1,    offers: 0 },
  { id: 'bronze',   name: 'Bronze',          title: 'BRONZE',              icon: '🥉', jelly: 1e9,  pearls: 1.1,  offers: 0.05 },
  { id: 'silver',   name: 'Silver',          title: 'SILVER',              icon: '🥈', jelly: 1e10, pearls: 1.2,  offers: 0.10 },
  { id: 'gold',     name: 'Gold',            title: 'GOLD',                icon: '🥇', jelly: 1e11, pearls: 1.35, offers: 0.20 },
  { id: 'platinum', name: 'Platinum',        title: 'PLATINUM',            icon: '💠', jelly: 1e12, pearls: 1.5,  offers: 0.30 },
  { id: 'emerald',  name: 'Emerald',         title: 'EMERALD',             icon: '💚', jelly: 1e13, pearls: 1.75, offers: 0.45 },
  { id: 'diamond',  name: 'Diamond',         title: 'DIAMOND',             icon: '💎', jelly: 1e14, pearls: 2,    offers: 0.60 },
  { id: 'obsidian', name: 'Obsidian',        title: 'OBSIDIAN',            icon: '🌑', jelly: 1e15, pearls: 2.5,  offers: 0.80 },
  { id: 'nova',     name: 'Nova',            title: 'NOVA',                icon: '🌟', jelly: 1e16, pearls: 3,    offers: 1.00 },
];
export const MEDAL_BY_ID = Object.fromEntries(MEDALS.map(m => [m.id, m]));

// Heirlooms: family treasures bought with jelly (spending never changes the jelly a slime made, the family lifetime
// or the Family Bonus). Owned ones stay through every move-out and baby new home, and help every slime after.
// fx keys (multipliers multiply with each other and with medal perks):
//   startHelpers  helpers every new egg's slime starts with        foodPrice  x snack prices
//   glimmerMult   x Lucky Glimmer rewards (sim fx.glimmerMult)       keepJar    the Jelly Jar keeps its level
//   ranchPearls   x pearls ranch slimes make                         eggTime    x how long a new Nursery egg warms
//   happyDecay    x how fast ranch happiness fades (live and away)   buyerPay   x what buyers pay (homes, auctions)
//   rareEggs      x the surprise chance of a special Dollop from a plain egg (BREEDS.surprise)
// `where`: where it will live in the world (the in-world objects are not built yet: placeholder icons only).
// buyable: false = shown, not for sale yet (`soon` says why).
export const HEIRLOOMS = [
  { id: 'toybox',   name: 'Toy Box',              icon: '🧸', price: 1e7,  where: 'in the nursery corner',
    effect: 'Every new egg starts with 10 Tickle Feathers and 5 Bubble Wands.', fx: { startHelpers: { feather: 10, bubbles: 5 } } },
  { id: 'cookietin', name: "Grandma's Cookie Tin", icon: '🍪', price: 1e8,  where: 'on the nursery shelf',
    effect: 'Snacks cost 20% less.', fx: { foodPrice: 0.8 } },
  { id: 'clover',   name: 'Pressed Clover',       icon: '🍀', price: 1e9,  where: 'in a frame on the wall',
    effect: 'Lucky Glimmers give twice as much.', fx: { glimmerMult: 2 } },
  { id: 'jarlid',   name: 'Golden Jar Lid',       icon: '🫙', price: 1e10, where: 'on the Jelly Jar',
    effect: 'The Jelly Jar keeps its size when a slime moves out (what is inside still starts over).', fx: { keepJar: true } },
  { id: 'lanterns', name: 'Ranch Lanterns',       icon: '🏮', price: 1e11, where: 'along the ranch fence',
    effect: 'Ranch slimes make 25% more pearls.', fx: { ranchPearls: 1.25 } },
  { id: 'quilt',    name: 'Patchwork Quilt',      icon: '🧵', price: 1e12, where: 'in the Nursery',
    effect: 'New Nursery eggs are ready twice as fast.', fx: { eggTime: 0.5 } },
  { id: 'portrait', name: 'Family Portrait',      icon: '🖼️', price: 1e13, where: 'on the nursery wall',
    effect: "Ranch slimes' happiness fades half as fast.", fx: { happyDecay: 0.5 } },
  { id: 'statue',   name: 'Family Statue',        icon: '🗿', price: 1e14, where: 'on the ranch hill',
    effect: 'Buyers pay 25% more pearls (new homes and auctions).', fx: { buyerPay: 1.25 } },
  { id: 'wishstar', name: 'Wishing Star',         icon: '⭐', price: 1e15, where: 'over the ranch at night',
    effect: 'Rare eggs twice as likely: a plain egg hatches a surprise Cat-ear or Topknot Dollop twice as often.', fx: { rareEggs: 2 } },
];
export const HEIRLOOM_BY_ID = Object.fromEntries(HEIRLOOMS.map(h => [h.id, h]));
// The Heirlooms tab: a placeholder icon key (memIcon), no text label; `glow` while a new heirloom is affordable.
export const HEIRLOOM_TAB = { icon: '🧰', label: 'Heirlooms', showNext: 3 };

// Moving Day signs: a grown slime shows, in its own way, that it is ready to leave the nest. No text, no numbers:
// the player learns to read their slime. Underneath: R = (1 + Family Bonus after moving out / 100) /
// (1 + Family Bonus now / 100), i.e. how much faster the next baby's jelly would grow. Only while Settled.
//   levels: from `at` (R) up; `every` = [min, max] seconds of play at home between two signs (rare -> frequent);
//           `bundle` = chance a sign also brings the tiny travel bundle by the cushion (very ready only).
//   signs:  one per personality lean (the slider farthest from the middle, and which end). `dur` seconds; the
//           other numbers are each sign's own tuning (turn: how far it turns toward the ranch hill, in radians;
//           go: how far it moves, in world units; hops...). The ranch hill is straight behind the cushion.
export const MOVING_DAY = {
  levels: [
    { id: 'restless',  at: 1.5, every: [300, 480] },
    { id: 'ready',     at: 2,   every: [110, 190] },
    { id: 'veryReady', at: 3,   every: [50, 100], bundle: 0.4 },
  ],
  firstDelay: [25, 50],        // seconds after loading (or after getting restless) before the first sign
  bundleSeconds: 45,           // how long the travel bundle stays by the cushion
  signs: {
    curious:     { lean: ['curious', 'high'], dur: 4.2, turn: 2.0, wiggles: 2 },                 // gazes at the hill, wiggles toward it
    familiar:    { lean: ['curious', 'low'],  dur: 4.4, pats: 3, turn: 1.5 },                    // tidies its cushion, then glances at the hill
    bold:        { lean: ['bold', 'high'],    dur: 4.6, hops: 3, go: 0.55, turn: 1.2 },          // practice hops toward the edge, puffs up
    shy:         { lean: ['bold', 'low'],     dur: 4.2, turn: 1.7, go: 0.4 },                    // peeks at the hill, hides toward you
    playful:     { lean: ['playful', 'high'], dur: 4.2, hops: 2, hop: 8, turn: 1.9 },            // bounces high, stretches toward the hill
    mellow:      { lean: ['playful', 'low'],  dur: 6.0, turn: 2.6 },                             // sits facing the hill, swaying slowly
    cuddly:      { lean: ['cuddly', 'high'],  dur: 4.4, go: 0.45 },                              // brings you its favorite snack to share
    independent: { lean: ['cuddly', 'low'],   dur: 5.6, go: 0.75 },                              // wanders a little farther, exploring
    patient:     { lean: ['patient', 'high'], dur: 5.0, turn: 1.8 },                             // hums a slow, different tune at the hill
    impulsive:   { lean: ['patient', 'low'],  dur: 3.6, go: 0.85, turn: 2.8 },                   // a zoomie toward the hill, then back
  },
  clue: 'Grown slimes sometimes dream of the ranch. Watch where they look.',
};

// ---------- Ranch life: the Training Center and trips (rules in core/ranch-life.js) ----------
// Grown slimes on the ranch learn five skills (0..5 stars each, one lesson = one star) and go on trips to the places
// the buyers live. Everything runs on the wall clock (like Nursery eggs), so it counts while the game is closed and
// tapping never speeds it up. Nothing fails, nothing is lost: a lesson always finishes, a trip always comes home.
// Icons are emoji placeholders until the UI pass draws them.
export const RANCH_LIFE = {
  maxStars: 5,
  // What one star does now (contests use the skills later). Every effect is per star; 5 stars = 5x.
  //   pearls      +x ranch pearls                  tripTime    trips x shorter
  //   fade        happiness fades x slower          lessonTime  lessons x shorter
  //   tripPearls  trips bring x more pearls          offers      buyer offers and auction prices +x
  skills: [
    { id: 'bounce', name: 'Bounce', icon: '🏐', fx: { pearls: 0.03 },                   does: 'more ranch pearls' },
    { id: 'speed',  name: 'Speed',  icon: '💨', fx: { tripTime: 0.06 },                 does: 'shorter trips' },
    { id: 'sturdy', name: 'Sturdy', icon: '🛡️', fx: { fade: 0.05 },                     does: 'farther trips, happiness fades slower' },
    { id: 'smarts', name: 'Smarts', icon: '📚', fx: { lessonTime: 0.05, tripPearls: 0.05 }, does: 'shorter lessons, more pearls from trips' },
    { id: 'charm',  name: 'Charm',  icon: '🌸', fx: { offers: 0.04 },                   does: 'better offers from buyers' },
  ],
  // One lesson per star: the price and time of the Nth star (the same for every skill). 120 pearls and about 11.5 hours
  // for a whole skill, 600 pearls and about 58 hours for a fully trained slime.
  lesson: {
    pearls:  [5, 10, 20, 35, 50],
    minutes: [20, 45, 90, 180, 360],
    happy: 10,                   // happiness when a lesson ends
  },
  // How many slimes learn at once (lanes) and travel at once (wagons): the first is free, then these pearl prices.
  lanes:  { start: 1, costs: [60, 150] },
  wagons: { start: 1, costs: [80, 200] },
  trip: {
    // happiness when a full trip comes home (an early return brings its share). Design: 20; tuned to 10 by the pearl
    // simulator (tools/pearl-sim.mjs): on a ranch checked twice a day the +20 cheered slimes up so much that ranch life
    // added +68% pearls for a casual player (target: at most +40%); +10 gives +47%, the most -50% can do.
    happy: 10,
    middleAt: 1,                 // Sturdy stars that open the 3-hour trips
    farAt: 3,                    // Sturdy stars that open the 6-hour trips (`loves.bold.farAt` lowers it)
  },
  // A treat from a full trip, for your slime at home: a little joy and bond, never traits. While an egg is on the
  // cushion the traveler eats it itself (+happy).
  treat: { joy: 8, bond: 2, happy: 10 },
  // Friend of a place: all three of its souvenirs found. Its buyer offers more for any of your slimes, and a thank-you
  // postcard brings pearls once.
  friend: { offers: 0.10, gift: 20 },
  // Personality "loves": from the strongest lean (the slider farthest from the middle, and which end), the same rule the
  // Moving Day signs use (core/movingday.js movingDaySign: the keys are its sign ids).
  //   skill + lessonTime: that skill's lessons x shorter; lessonTime alone: all lessons; tripPearls, tripTime: trips;
  //   farAt: the Sturdy stars that open the far trips; fade: happiness fades x slower
  loves: {
    curious:     { label: 'trips',         fx: { tripPearls: 0.10 },                 does: 'trips bring 10% more pearls' },
    familiar:    { label: 'lessons',       fx: { lessonTime: 0.10 },                 does: 'all lessons 10% shorter' },
    patient:     { label: 'Smarts',        fx: { skill: 'smarts', lessonTime: 0.25 }, does: 'Smarts lessons 25% shorter' },
    impulsive:   { label: 'Speed',         fx: { skill: 'speed', lessonTime: 0.25 },  does: 'Speed lessons 25% shorter' },
    playful:     { label: 'Bounce',        fx: { skill: 'bounce', lessonTime: 0.25 }, does: 'Bounce lessons 25% shorter' },
    mellow:      { label: 'Sturdy',        fx: { skill: 'sturdy', lessonTime: 0.25 }, does: 'Sturdy lessons 25% shorter' },
    cuddly:      { label: 'Charm',         fx: { skill: 'charm', lessonTime: 0.25 },  does: 'Charm lessons 25% shorter' },
    independent: { label: 'the open road', fx: { tripTime: 0.10 },                   does: 'trips 10% shorter' },
    bold:        { label: 'adventure',     fx: { farAt: 2 },                          does: 'the far trips open at Sturdy 2 stars' },
    shy:         { label: 'quiet days',    fx: { fade: 0.10 },                       does: 'happiness fades 10% slower' },
  },
  // The six places (each is a buyer's home: `buyer` in BUYERS). reach: near (always open), middle (Sturdy middleAt),
  // far (Sturdy farAt). Souvenirs are found in this order, one per full trip. Story lines: {name} is the traveler;
  // `lean` lines join the pool for a slime with that lean (picked half the time when there is one).
  places: [
    { id: 'cafe', buyer: 'cafe', name: 'Puddle Café', icon: '☕', hours: 1, reach: 'near', treat: 'a sprinkle drop',
      souvenirs: [{ id: 'cupHat', name: 'Paper Cup Hat', icon: '🥤' }, { id: 'sprinkleJar', name: 'Sprinkle Jar', icon: '🫙' }, { id: 'napkin', name: 'Napkin Doodle', icon: '🖍️' }],
      stories: [
        '{name} helped greet the guests and got a sprinkle on the nose.',
        '{name} watched the rain puddles from the window seat and counted 31 drops.',
        '{name} carried a teacup across the whole café. It wobbled, but not one drop spilled!',
        '{name} curled up by the warm cocoa machine and had a little nap.',
        'A kid drew {name} on a napkin. It looked like a happy potato.',
      ],
      lean: {
        playful: '{name} bounced from table to table saying hello to everyone.',
        shy: '{name} hid behind the cake stand, then waved at one very small kid.',
        cuddly: '{name} sat in every lap in the café, one after another.',
      } },
    { id: 'garden', buyer: 'garden', name: 'Willowbend Gardens', icon: '🌻', hours: 1, reach: 'near', treat: 'a garden berry',
      souvenirs: [{ id: 'seeds', name: 'Seed Packet', icon: '🌱' }, { id: 'snailShell', name: 'Snail Shell', icon: '🐌' }, { id: 'leaf', name: 'Pressed Leaf', icon: '🍂' }],
      stories: [
        '{name} got lost in the tomato patch and made friends with a snail.',
        '{name} helped water the seedlings (mostly by sitting in the watering can).',
        '{name} watched the bees for an hour. The bees watched back.',
        '{name} rolled down the grassy hill four times in a row.',
        '{name} found the biggest pumpkin in the garden and sat right on top.',
      ],
      lean: {
        curious: '{name} peeked under every single leaf to see who lived there.',
        mellow: '{name} lay in the sun by the sunflowers and did not move all afternoon.',
        patient: '{name} waited very quietly, and a butterfly landed right on top.',
      } },
    { id: 'mine', buyer: 'mine', name: 'Pebblepeak Mine', icon: '⛏️', hours: 3, reach: 'middle', treat: 'a rock candy',
      souvenirs: [{ id: 'pebble', name: 'Shiny Pebble', icon: '🪨' }, { id: 'crystalChip', name: 'Crystal Chip', icon: '💎' }, { id: 'pickaxe', name: 'Little Pickaxe', icon: '⛏️' }],
      stories: [
        '{name} rode the little mine cart and squealed the whole way down.',
        '{name} found a rock shaped exactly like a slime.',
        '{name} listened to the miners sing in the echoing tunnel.',
        '{name} polished a pebble until it shone like a star.',
      ],
      lean: {
        bold: '{name} went all the way to the deepest tunnel and came back very proud.',
        impulsive: '{name} zoomed down a tunnel before anyone said go. It was a good tunnel.',
        independent: '{name} explored a side tunnel alone and drew a little map of it.',
      } },
    { id: 'springs', buyer: 'springs', name: 'Mistwater Hot Springs', icon: '♨️', hours: 3, reach: 'middle', treat: 'a warm bun',
      souvenirs: [{ id: 'duck', name: 'Rubber Duck', icon: '🦆' }, { id: 'towel', name: 'Fluffy Towel', icon: '🧺' }, { id: 'bathPebble', name: 'Bath Pebble', icon: '🫧' }],
      stories: [
        '{name} soaked in the warm pool until extra squishy.',
        '{name} floated on their back and watched the steam make clouds.',
        '{name} shared a bath with a very polite frog.',
        '{name} got wrapped in a fluffy towel like a little dumpling.',
      ],
      lean: {
        mellow: '{name} found the warmest pool and stayed there all day.',
        cuddly: '{name} snuggled into a pile of warm towels with three other slimes.',
        shy: '{name} chose the tiny quiet pool in the corner. It was perfect.',
      } },
    { id: 'observatory', buyer: 'observe', name: 'Starlight Observatory', icon: '🔭', hours: 6, reach: 'far', treat: 'a moon cookie',
      souvenirs: [{ id: 'starMap', name: 'Star Map', icon: '🗺️' }, { id: 'meteor', name: 'Meteor Bit', icon: '☄️' }, { id: 'telescope', name: 'Tiny Telescope', icon: '🔭' }],
      stories: [
        '{name} looked through the big telescope and saw the craters on the moon.',
        '{name} counted 4 stars, then fell asleep under the dome.',
        '{name} made a wish on a shooting star. It is a secret.',
        '{name} helped turn the giant telescope (by sitting on the crank).',
      ],
      lean: {
        curious: '{name} asked the astronomer about every single star.',
        patient: '{name} waited all night for a comet. It came!',
        familiar: '{name} found the North Star and decided it was a friend from home.',
      } },
    { id: 'festival', buyer: 'festival', name: 'Summer Festival', icon: '🎆', hours: 6, reach: 'far', treat: 'a candy floss',
      souvenirs: [{ id: 'mask', name: 'Festival Mask', icon: '🎭' }, { id: 'sparkler', name: 'Sparkler', icon: '🎇' }, { id: 'fan', name: 'Paper Fan', icon: '🪭' }],
      stories: [
        '{name} watched the fireworks go BOOM and was very brave.',
        '{name} won the ring toss, then gave the prize to a little kid.',
        '{name} danced to the drums with a crowd of kids.',
        '{name} tried every snack stall. Every single one.',
      ],
      lean: {
        playful: '{name} jumped in the bouncy castle until the stars came out.',
        bold: '{name} rode the biggest ride twice and wanted a third go.',
        impulsive: '{name} chased a runaway balloon all the way across the festival.',
      } },
  ],
};
export const SKILL_IDS = RANCH_LIFE.skills.map(s => s.id);
export const SKILL_BY_ID = Object.fromEntries(RANCH_LIFE.skills.map(s => [s.id, s]));
export const PLACE_BY_ID = Object.fromEntries(RANCH_LIFE.places.map(p => [p.id, p]));

// The Greenhouse (Settings > Background, the default home): a room baked outside the repo (its files are in
// src/assets/greenhouse/; gh.json has the room's footprints and glow spots), drawn by src/view/greenhouse.js, and a
// camera you can turn inside it. Room coordinates: x right, y up, z toward you; the slime's stump is at the origin.
// Pure math (ground, roof, camera limits, spot check) is in src/view/greenhouse-math.js.
export const GREENHOUSE = {
  blend: 3,                    // day <-> night blend speed (1/s): about 3 s, like the test page
  // The lights on the slime and the helpers (the room's own light is baked into it). Day and night, blended with the room.
  slimeLight: {
    day:   { hemi: ['#fff4e6', '#d9b48a', 0.85], key: ['#fff1de', 1.6],  rim: ['#ffe6c2', 1.1], env: 0.45 },
    night: { hemi: ['#6d64b8', '#2e2140', 0.5],  key: ['#ffcf98', 1.15], rim: ['#ffc27a', 1.5], env: 0.26 },
  },
  // Height of the floor: the stump's flat top (the slime sits on it), its side down to the braided rug, the planks.
  ground: { stumpTop: 0.27, stumpFlat: 0.85, stumpR: 1.14, rugY: 0.06, rugR: 2.3, rugEdge: 0.1, floorY: 0 },
  // The roof over the room: eaves on the side walls, the ridge over the middle (half = half the roof's width).
  roof: { eave: 4.7, ridge: 6.7, half: 3.95 },
  camera: {
    order: ['front', 'wide', 'left', 'right'],   // the camera button steps through these (Front = the home camera)
    // Set angles (Front is computed by the stage, unchanged). Left is the test page's Corner, 0.1 nearer the middle so
    // it is inside the side limit (x 3.4); Right is Left mirrored.
    views: {
      wide:  { pos: [0, 4.7, 9.6],   look: [0, 1.3, -2.2],  fov: 58 },
      left:  { pos: [-3.4, 3.1, 7.6], look: [1.1, 1.3, -3.0], fov: 50 },
      right: { pos: [3.4, 3.1, 7.6],  look: [-1.1, 1.3, -3.0], fov: 50 },
    },
    // Where you can turn it yourself: inside the side walls (|x|), above the floor and under the roof (minus a gap),
    // not past the front (z), at least near[0] + near[1] x slime size from the point it looks at, and at most `around`
    // degrees around the slime from straight on (so never from behind it).
    limits: { x: 3.4, yMin: 0.9, roofGap: 0.3, zMax: 13.5, near: [2.2, 1.2], around: 55, pitch: 80 },
    turn: 0.0048,              // radians around the slime per pixel dragged sideways (a full phone width is about 105 degrees)
    tilt: 0.0036,              // radians up or down per pixel dragged up or down
    glide: 3,                  // how fast the camera glides to a set angle (like the Front camera's own follow)
    follow: 16,                // how fast it follows your finger while you turn it
    pinch: [0.5, 2],           // one pinch gesture zooms at most this much (each move is clamped to it)
  },
  // Where the helpers you buy stand in the room ([x, z], on the floor; y comes from the ground). Checked by
  // tools/greenhouse-test.mjs against the room's footprints and walls (gh.json) with each helper's radius below
  // (measured from its model at the size it is shown at; tools/greenhouse-smoke.cjs measures them again).
  spots: {
    planters: [[-0.62, -2.72], [0.42, -2.7], [-0.2, -3.42], [-0.98, -3.95], [0.62, -4.05], [-0.25, -4.65]],
    lamps: [[-1.85, -0.7], [1.85, -0.7], [-3.2, -2.0], [3.25, -2.35], [-2.9, 4.5], [2.9, 4.6]],
    bubbles: [2.35, 1.3], musicbox: [-2.5, 1.15], fountain: [-2.2, 2.65], spa: [2.4, 3.0],
    observatory: [2.05, -3.75],   // the room's telescope spot (gh.json spots.telescope), nudged 0.1 off the stool
    turn: { bubbles: -0.6, musicbox: 0.5, fountain: 0, observatory: 2.2, spa: -0.5 },   // which way each one faces (radians)
    pals: { ring: [1.85, 2.6], step: 0.5, spacing: 0.55 },   // pals hop on the rug and the floor around the stump
    rainbow: { pos: [0, -0.6, -9.5], radius: 4.6, tube: 0.2 },   // over the garden behind the back glass
  },
  radius: { planter: 0.3, lamp: 0.42, bubbles: 0.42, musicbox: 0.5, fountain: 0.63, spa: 0.96, observatory: 0.53, slimeling: 0.28 },
  // model origin above the floor (the planters and the wand would sink into the planks; a pal sits a bit higher than
  // on the meadow's grass so its round bottom doesn't dip into the floor)
  lift: { planter: 0.27, bubbles: 0.58, musicbox: 0.2, slimeling: 0.05 },
};

// ---------- The Barn ranch (the ranch screen) ----------
// The ranch is the baked barn (src/assets/barn/, lit and baked in Blender outside this repo, the same format as the
// Greenhouse room): one resident at a time on the show stand, swiped through with the burrow swap. The camera, the
// stand, the lanterns, the bulbs and the Pearl Basket come from barn.json; what you can tune is here. Timings and
// counts copy the barn test page the captain played (and the Blender clip its swap copies).
export const BARN = {
  blend: 3,                  // day <-> night blend speed (1/s): about 3 s, like the test page and the Greenhouse
  size: 0.86,                // the resident on the stand (the size a resident has on the meadow ranch)
  // The burrow swap, in seconds (Slow motion = the test page's x3 is not in the game). It wiggles, sinks into the straw
  // nest, the straw poofs while it is hidden (the next resident is put on then), it pops up and lands with a spring.
  swap: {
    wiggle: 0.14, sink: 0.33, under: 0.4, rise: 0.55, land: 0.68,   // where each part ends
    wiggleDeg: 9, wiggleEvery: 0.07, wiggleSquash: 0.08,              // the wiggle: lean (degrees), its period, a little squash
    depth: 1.6, hide: 1.5, over: 0.35,                                // how deep it sinks, where it waits, how high it pops
    stretch: { sink: 0.18, under: 1.36, rise: 0.1, land: 0.26 },      // taller while it sinks, under the straw, rising, landing
    burst1: 0.28, wear: 0.36, burst2: 0.42,                          // the big straw poof, the new resident put on, the small poof
    clip: [0.12, 0.6],                                               // the clip plane is on in between (it sinks INTO the nest)
    spring: { squash: 0.24, decay: 0.085, period: 0.24, length: 1.2 },  // the landing spring
    queueGap: 0.12,                                                  // a swap asked for during a swap starts this long after it
    fade: 0.36,                                                      // Reduced motion: a fade out and in instead (no straw)
  },
  // Straw strips (one instanced mesh) and how many fly in each poof; Low graphics draws half.
  straw: { high: { strips: 760, burst1: 520, burst2: 110 }, low: { strips: 380, burst1: 260, burst2: 55 } },
  dust: 0.36,                // the hay dust puffs' life (s)
  sparkle: { life: 0.45, stagger: 0.04 },   // the landing sparkles: each one's life (s), one after another
  // A quick sideways swipe anywhere on the barn (swipe left = next, like turning a page). Petting needs the finger to
  // stay on the slime: a press only pets once it can no longer be a swipe (it turned back, went mostly up or down, or
  // lasted longer than a swipe can), or when it ends without being one (a tap).
  swipe: { minPx: 60, ratio: 1.5, maxMs: 700, turnPx: 14, upPx: 30 },
  strokeEvery: 0.35,         // stroking keeps petting this often (today's ranch)
  dots: 8,                   // the name card shows a dot per resident up to this many, then "3 of 12"
  justBack: 1800,            // "just back from Puddle Café" for this long after a trip (seconds; not saved)
  // The Nursery's straw nest: the Pearl Basket's spot mirrored to the front left of the stand (barn.json pearls:
  // x 1.29, z 0.95), inside the aisle and clear of the stand; drawn only while the Nursery has eggs.
  nest: { x: -1.29, z: 0.95, r: 0.38 },
  basket: { r: 0.42, shown: 12 },   // the basket's tap target around its pearls; live pearls on top show how full it is
  // Pearls made while you watch land in the stand's straw ring in front of the slime (the floor in front of the stand is
  // under the name card, and its sides are at the screen's edges): this far from the stand's middle, within this many
  // degrees either side of the front. Left there, they roll off to the basket as on the meadow ranch.
  pearlRing: { r: [1.0, 1.1], arc: 62 },
  // Framing: the stand, the nest, the basket and the slime (up to `top`) stay between the top bar and the name card.
  frame: { top: 2.35, bottom: 0, front: 1.25, side: 1.3, gap: 8 },
};
