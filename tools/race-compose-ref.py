#!/usr/bin/env python3
# The race kit's REFERENCE composites, for the game's composer (src/view/race-compose.js) to match pixel for pixel.
# Runs Usopp's own composer (samples/race-kit/src/compose_kit.py, branch usopp/race-kit @ 48c0f45, the code that made
# every sheet Nami checked) on a list of cases and writes, per case, the md5 of the 56 x 56 RGBA composite. The game's
# test (tools/race-compose-test.mjs) composes the same cases from the same kit files (src/assets/race/, copied
# unchanged) and compares. Rivals take their place's RIVAL_COLOR through the kit's own 4.2 ramp rule (pixel_kit.ramp_rule),
# as the kit's composer does for the festival rival (compose.py ramp_override).
#   python3 tools/race-compose-ref.py <kit src dir> <kit dir> <out.json> [--rgba N]   (--rgba: also the full RGBA of every Nth case)
import sys, os, json, hashlib, itertools
KSRC, KDIR, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
RGBA_EVERY = int(sys.argv[sys.argv.index('--rgba') + 1]) if '--rgba' in sys.argv else 0
sys.path.insert(0, KSRC)
import numpy as np
import compose as C
import compose_kit as CK
import pixel_kit as P
from colour import hexrgb, lab, rgbhex

fk = CK.FormKit(KDIR)
kit = fk.kit
FAMS = ['curly', 'dollop', 'mixed']
FRAMES = kit.ids
# each frame's expression in the race (its first sequence in compose.SETS)
EXPR = {}
for _, fids, exprs, _ in C.SETS:
    for f, e in zip(fids, exprs):
        EXPR.setdefault(f, e)
FORMS = list(fk.forms.keys())
GAME_OUTFIT = {'bow': 'ribbon', 'bowtie': 'bowtie', 'glasses': 'glasses', 'shades': 'shades', 'flowers': 'flowers', 'beret': 'beret',
               'party': 'party', 'crown': 'crown', 'scarf': 'scarf'}
RIVAL_COLOR = {'school': '#b6e36a', 'garden': '#8fdcb0', 'cafe': '#9fd8ff', 'bakery': '#ffc9a3', 'springs': '#ffb3c7', 'windmill': '#ffe08a',
               'mine': '#c9b8a8', 'museum': '#c9a7ff', 'observe': '#8fb0ff', 'festival': '#ff9f80'}
# the race's rival recipes (CONTESTS.race.rivals in content.js)
RIVALS = {
    'school': ('curly', 'plain', 'mochi', 'bow'), 'garden': ('dollop', 'plain', 'nature', 'scarf'), 'cafe': ('mixed', 'plain', 'sweet', 'bowtie'),
    'bakery': ('curly', 'plain', 'heat+sweet', 'glasses'), 'springs': ('dollop', 'plain', 'heat+nature', 'bowtie'),
    'windmill': ('mixed', 'plain', 'spark', 'scarf'), 'mine': ('mixed', 'plain', 'mineral', 'glasses'), 'museum': ('dollop', 'ears', 'mineral+prism', 'crown'),
    'observe': ('dollop', 'topknot', 'prism+spark', 'shades'), 'festival': ('curly', 'plain', 'heat+spark', 'shades'),
}

def ramp_of(hx):
    return {s: rgbhex(v) for s, v in P.ramp_rule(lab(hexrgb(hx))).items()}

cases = []
def add(**k):
    k.setdefault('theme', 'day'); k.setdefault('worn', []); k.setdefault('pure', False); k.setdefault('breed', None)
    k.setdefault('rival', None); k.setdefault('spark', None)
    k.setdefault('expr', EXPR[k['frame']]); k.setdefault('prop', FRAMES.index(k['frame']) % 2)
    cases.append(k)

# A. every form on every body, every Sprint frame, in its expression
for form in FORMS:
    for fam in FAMS:
        for f in FRAMES:
            add(form=form, fam=fam, frame=f)
# B. each outfit alone on four forms, five poses
for o in GAME_OUTFIT:
    for form in ['mochi', 'spark', 'heat', 'sweet']:
        for fam in FAMS:
            for f in ['idle_0', 'hop_air1', 'bound_lean', 'surge_long', 'hop_land']:
                add(form=form, fam=fam, frame=f, worn=[o])
# C. head + face + neck together
for worn in [['bow', 'glasses', 'scarf'], ['crown', 'shades', 'bowtie'], ['party', 'scarf'], ['flowers', 'shades'], ['beret', 'glasses', 'bowtie']]:
    for form in ['spark', 'nature', 'mineral+prism', 'heat+sweet', 'prism+spark', 'spark:smore']:
        for fam in FAMS:
            for f in ['idle_1', 'scoot_1', 'bound_flat', 'joy_stretch']:
                add(form=form, fam=fam, frame=f, worn=worn)
# D. Cat-ear and Topknot (Dollop and mixed bodies)
for breed in ['ears', 'topknot']:
    for fam in ['dollop', 'mixed']:
        for form in ['mochi', 'spark', 'prism+spark', 'mineral+prism', 'heat', 'nature+spark', 'spark:storm', 'sweet']:
            for f in FRAMES:
                add(form=form, fam=fam, frame=f, breed=breed)
# E. Pure
for form in FORMS:
    for fam in FAMS:
        for f in ['idle_0', 'bound_lean']:
            add(form=form, fam=fam, frame=f, pure=True)
# F. the rivals, every frame
for place, (fam, var, form, o) in RIVALS.items():
    for f in FRAMES:
        add(form=form, fam=fam, frame=f, breed=None if var == 'plain' else var, worn=[o], rival=place)
# G. the other expressions (think at the hoops, blink at the gate) and the Volt's surge sparks
for form in ['spark', 'mochi', 'prism', 'heat+mineral']:
    for fam in FAMS:
        for f in ['idle_0', 'idle_1', 'idle_2', 'idle_3']:
            add(form=form, fam=fam, frame=f, expr='think')
            add(form=form, fam=fam, frame=f, expr='blink')
for fam in FAMS:
    for f, sp in [('surge_long', 0), ('surge_spark', 2), ('surge_back', 3)]:
        add(form='spark', fam=fam, frame=f, spark=sp)
# H. a few at night (RV3 is night; the composer already takes the theme)
for form in ['spark', 'heat+mineral', 'nature+spark', 'prism+spark', 'mochi']:
    for fam in FAMS:
        for f in ['idle_0', 'bound_lean']:
            add(form=form, fam=fam, frame=f, theme='night')

ramps = {p: ramp_of(c) for p, c in RIVAL_COLOR.items()}
out = []
for i, k in enumerate(cases):
    worn = tuple(GAME_OUTFIT[w] for w in k['worn'])
    saved = None
    if k['rival']:
        rp = {'day': ramps[k['rival']], 'night': ramps[k['rival']]}
        if k['form'] == 'spark':
            saved = ('fam', k['fam'], kit.j['families'][k['fam']]['ramp'])
            kit.j['families'][k['fam']]['ramp'] = rp
        else:
            saved = ('form', k['form'], fk.fc[k['form']]['ramps'][k['fam']])
            fk.fc[k['form']]['ramps'][k['fam']] = rp
    cv, info = CK.compose_form(fk, k['fam'], k['frame'], k['form'], theme=k['theme'], expr=k['expr'], worn=worn, pure=k['pure'],
                               prop_frame=k['prop'], spark=k['spark'], breed=k['breed'])
    if saved:
        if saved[0] == 'fam':
            kit.j['families'][saved[1]]['ramp'] = saved[2]
        else:
            fk.fc[saved[1]]['ramps'][k['fam']] = saved[2]
    rgba = C.to_rgba(cv)
    row = dict(k, md5=hashlib.md5(rgba.tobytes()).hexdigest())
    if RGBA_EVERY and i % RGBA_EVERY == 0:
        row['rgba'] = rgba.tobytes().hex()
    out.append(row)
    if i % 500 == 0:
        print(i, len(cases), file=sys.stderr)
json.dump(dict(source='usopp/race-kit @ 48c0f45, samples/race-kit/src/compose_kit.py compose_form', frames=FRAMES, expr=EXPR,
               rival_ramps=ramps, cases=out), open(OUT, 'w'), separators=(',', ':'))
print('wrote', len(out), 'cases to', OUT)
