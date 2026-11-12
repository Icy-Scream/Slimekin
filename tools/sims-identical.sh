#!/bin/bash
# Sims byte-identical check (the race view's RV1 gate): economy-sim, pearl-sim and contest-sim run on this tree and on
# a reference tree (default: main @ 76602fd, extracted to the scratch dir), and the full outputs are compared with cmp.
# contest-sim's title line holds its run time in seconds; that one number is masked on both sides before cmp.
#   tools/sims-identical.sh [REF_DIR]
set -u
HERE=$(cd "$(dirname "$0")/.." && pwd)
REF=${1:-/root/.hermes/profiles/franky/cache/scratch/main-76602fd}
OUT=${SIMS_OUT:-/root/.hermes/profiles/franky/cache/scratch/sims-cmp}
mkdir -p "$OUT"
RUNS=(
  "economy-sim.mjs 12 quiet"
  "economy-sim.mjs 12 casual quiet"
  "economy-sim.mjs 2 quiet spam"
  "economy-sim.mjs 4 casual quiet gen2=1e9"
  "pearl-sim.mjs"
  "pearl-sim.mjs allc"
  "pearl-sim.mjs quiet"
  "pearl-sim.mjs engaged quiet"
  "pearl-sim.mjs casual quiet"
  "pearl-sim.mjs spam quiet"
  "pearl-sim.mjs engaged nolife quiet"
  "contest-sim.mjs"
  "contest-sim.mjs quiet"
)
mask() { sed -E 's/[0-9]+(\.[0-9]+)? ?s(econds)?\)/<t>)/; s/in [0-9]+(\.[0-9]+)? ?s\b/in <t>/' "$1"; }
fails=0; i=0
for spec in "${RUNS[@]}"; do
  i=$((i+1)); a="$OUT/$i.here.txt"; b="$OUT/$i.ref.txt"
  ( cd "$HERE" && env -i HOME="$HOME" PATH="$PATH" node tools/$spec > "$a" 2>&1; echo $? > "$a.rc" ) &
  ( cd "$REF" && env -i HOME="$HOME" PATH="$PATH" node tools/$spec > "$b" 2>&1; echo $? > "$b.rc" ) &
  wait
  if [[ "$spec" == contest-sim* ]]; then mask "$a" > "$a.m"; mask "$b" > "$b.m"; ca="$a.m"; cb="$b.m"; else ca="$a"; cb="$b"; fi
  if cmp -s "$ca" "$cb"; then r="IDENTICAL"; else r="DIFFERENT"; fails=$((fails+1)); fi
  printf '%-44s %s (cmp; exit %s/%s; %s lines, md5 %s)\n' "$spec" "$r" "$(cat "$a.rc")" "$(cat "$b.rc")" "$(wc -l < "$a")" "$(md5sum < "$ca" | cut -c1-12)"
done
echo "$((i - fails)) identical, $fails different (reference: $REF)"
exit $fails
