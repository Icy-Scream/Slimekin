#!/bin/bash
# Slimekin for iPhone: the Terminal part on the Mac (see MAC-GUIDE.md).
#   cd into the native folder, then:   bash mac-build.sh          (add --open to open Xcode at the end)
# Safe to run as often as you like: it installs the pinned packages, builds the game files for the app, applies the
# iPhone settings, copies everything into the Xcode project and checks it. When something is missing it stops and
# says what to do, in plain words.
set -euo pipefail
cd "$(dirname "$0")"

step() { printf '\n== %s\n' "$*"; }
stop() { printf '\n*** STOP: %s\n\n' "$*" >&2; exit 1; }

step "Checking this Mac"
[ "$(uname)" = "Darwin" ] || stop "This script is for a Mac (macOS)."
[ -f ../tools/build-ios.mjs ] && [ -f ../index.html ] && [ -d ../src ] || stop "Run this from the 'native' folder inside the Slimekin folder (the one with index.html, src and tools next to it)."

if ! command -v node >/dev/null 2>&1; then
  stop "Node.js is not installed. Go to nodejs.org, download the LTS version for macOS (the .pkg installer), install it, then close Terminal, open it again and run this script again."
fi
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$NODE_MAJOR" -lt 22 ]; then
  stop "Node.js $(node -v) is too old: Slimekin needs version 22 or newer. Install the LTS version from nodejs.org, then close Terminal, open it again and run this script again."
fi
echo "Node.js $(node -v): ok"

if ! xcode-select -p >/dev/null 2>&1; then
  stop "Xcode's command line tools are missing. Open Xcode once from Applications (it offers to install what it needs), or run:  xcode-select --install"
fi
if ! XCODE_VERSION=$(xcodebuild -version 2>/dev/null); then
  stop "Terminal can't find Xcode itself. Install Xcode from the App Store and open it once (accept the license), then run:  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer   (it asks for your Mac password) and run this script again."
fi
XCODE_VERSION=$(printf '%s\n' "$XCODE_VERSION" | sed -n 1p)
XCODE_MAJOR=$(echo "$XCODE_VERSION" | sed -E 's/^Xcode ([0-9]+).*/\1/')
case "$XCODE_MAJOR" in ''|*[!0-9]*) stop "Could not read the Xcode version (\"$XCODE_VERSION\"). Send this line back to whoever set up this build." ;; esac
if [ "$XCODE_MAJOR" -lt 26 ]; then
  stop "$XCODE_VERSION is too old: Capacitor 8 and Apple's uploads need Xcode 26 or newer. Update Xcode from the App Store."
fi
echo "$XCODE_VERSION: ok"

step "Installing the pinned packages (npm ci)"
npm ci --no-audit --no-fund

step "Building the game files for the app (and checking they need no internet)"
node ../tools/build-ios.mjs

step "Applying Slimekin's iPhone settings"
node tools/patch-ios.mjs

step "Copying the game into the Xcode project (npx cap sync ios)"
# CI=1: Capacitor's command line tool sends usage statistics from an interactive Terminal unless told not to
# (opt-out); in CI mode it sends nothing and changes no setting on this Mac.
CI=1 npx cap sync ios

step "Checking the Xcode project"
node tools/check-ios.mjs --mac

step "Done"
echo "Next: open the project in Xcode with   open ios/App/App.xcodeproj"
if [ "${1:-}" = "--open" ]; then open ios/App/App.xcodeproj; fi
