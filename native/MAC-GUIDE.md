# Slimekin on your iPhone: the Mac guide

From the Slimekin folder to the game on your iPhone, then to TestFlight. Every step is a click or a command to copy.

Two honest warnings first:

- Nobody could open Xcode while writing this (it was written on a Linux machine). The Xcode click paths below are
  from Xcode 26 and may be worded a little differently in Xcode 27. **When a label or menu looks different, take a
  screenshot and send it back** before guessing.
- Your slime's save lives on the phone, inside the app. **Deleting the app deletes the save.** The app keeps a second
  copy on the phone in case iOS tidies up storage, but that copy goes with the app too. The Save Code (Settings >
  Copy save code) is the backup and the way to move a slime between devices.

## What you need

- Your Mac with macOS 27 and **Xcode 27** (free in the Mac App Store; open it once after installing and let it finish
  installing its parts).
- Your iPhone and its USB-C cable.
- Your Apple ID. Running the app on your own phone works with any Apple ID. **TestFlight and the App Store need the
  paid Apple Developer Program** (as an individual).
- The Slimekin folder you were sent (a folder with `index.html`, `src`, `tools` and `native` in it). If it came as a
  `.zip`, double-click it to unpack it. Put it in your **Documents** folder, so its path is `Documents/Slimekin`.
- An internet connection for the setup (the game itself never goes online).

## 1. Install Node.js (once)

1. In Safari, go to **nodejs.org**.
2. Click the download button for the **LTS** version (it must be 22 or newer) and choose the **macOS Installer (.pkg)**.
3. Open the downloaded file and click **Continue**, **Agree**, **Install** (type your Mac password), **Close**.

## 2. Build the app's files in Terminal

1. Open **Terminal**: press **Cmd + Space**, type `Terminal`, press **Return**.
2. Go into the folder (copy this line, paste it into Terminal with **Cmd + V**, press **Return**):

   ```
   cd ~/Documents/Slimekin/native
   ```

   If it says "No such file or directory", type `cd ` (with a space), drag the `native` folder from Finder into the
   Terminal window, and press **Return**.
3. Run the build script:

   ```
   bash mac-build.sh
   ```

   It checks your Mac first and tells you in plain words if something is missing (Node.js, Xcode). Then it installs
   the exact package versions, builds the game files, applies the iPhone settings and checks them. The first run takes
   a minute or two. It ends with **== Done**. You can run it again any time; it is safe.
4. Open the project in Xcode:

   ```
   open ios/App/App.xcodeproj
   ```

   (Or run the script as `bash mac-build.sh --open` next time: it opens Xcode at the end.)

## 3. First time in Xcode

1. Xcode opens the project **App**. On the first open it downloads Capacitor (the app shell) from the internet: wait
   until the status at the top of the window stops saying something like "Resolving packages".
2. If Xcode shows a yellow notice about **recommended settings**, ignore it for now.
3. In the left sidebar, click the blue **App** icon at the very top. In the middle, under **TARGETS**, click **App**.
4. Click the tab **Signing & Capabilities**.
5. Tick **Automatically manage signing**.
6. **Team**: pick your name. If the list is empty, click **Add an Account...** and sign in with your Apple ID, then
   pick your name.
7. **Bundle Identifier** shows `com.icyscreams.slimekin`. Do not change it here. If Xcode shows a red message that it
   is not available, send a screenshot back (it gets changed in one file, `native/capacitor.config.json`).

Your team choice stays in the project on your Mac. Running `mac-build.sh` again keeps it.

## 4. Get the iPhone ready (once)

1. Plug the iPhone into the Mac with the cable and unlock it.
2. On the iPhone, tap **Trust** and enter your passcode.
3. Turn on Developer Mode: on the iPhone open **Settings > Privacy & Security**, scroll to the bottom, tap
   **Developer Mode**, turn it on and tap **Restart**. After the restart, unlock the phone and tap **Turn On**, then
   enter your passcode. (If you don't see Developer Mode yet, do step 5 below once first; Xcode makes it appear.)

## 5. Run Slimekin on your iPhone

1. At the top of the Xcode window, next to **App**, click the device name and pick **your iPhone** from the list.
2. Press the **Run** button (the triangle) or **Cmd + R**.
3. The first time, Xcode may say it is "preparing" the iPhone; wait. When it is done, Slimekin opens on the phone.
4. If the phone says **Untrusted Developer**: open **Settings > General > VPN & Device Management**, tap your Apple ID,
   tap **Trust**, and press Run again.

Then go through the phone checklist at the end of this guide.

To look inside while it runs (for error messages): on the Mac, Safari > **Settings > Advanced** > tick **Show
features for web developers**; on the iPhone, **Settings > Apps > Safari > Advanced > Web Inspector** on. Then in
Safari on the Mac: **Develop >** your iPhone **> Slimekin**. This only works for builds run from Xcode, not TestFlight.

## 6. Send it to TestFlight

Once, in App Store Connect (appstoreconnect.apple.com, in Safari):

1. **Apps > +** (the plus) **> New App**.
2. Platform **iOS**, Name **Slimekin**, Primary Language **English**, Bundle ID **com.icyscreams.slimekin** (it
   appears in the list after step 5 above has run once with your paid team), SKU `slimekin-ios`, User Access **Full
   Access**. Click **Create**.

Every time you upload a new build:

1. Raise the build number: open `native/app-version.json` in TextEdit and change `"build": 1` to `2` (then 3, 4, ...
   for later uploads). Save. Each upload needs a higher number.
2. In Terminal (in the `native` folder): `bash mac-build.sh`
3. In Xcode, at the top, pick **Any iOS Device (arm64)** instead of your iPhone.
4. Menu **Product > Archive**. Wait; the **Organizer** window opens with the new archive selected.
5. Click **Distribute App**, choose **App Store Connect** (it may be called **TestFlight & App Store**), and keep the
   default choices (**Upload**, automatic signing) until **Upload** / **Distribute**. Wait for "Uploaded".
6. In App Store Connect: **Apps > Slimekin > TestFlight**. The build shows as "Processing" for a while (often 10 to 30
   minutes). Encryption questions are already answered by the app (it uses none).
7. Under **Internal Testing**, make a group, add yourself, and add the build.
8. On the iPhone, install **TestFlight** from the App Store, open it, and install Slimekin from there.

## The phone checklist

Please try each one on the iPhone and send back what you see:

- Airplane mode on: the app opens, the egg appears, the fonts look like the web game (round and bubbly).
- The home screen icon: the happy mint slime close up, corners rounded by the iPhone. Does it read at that size?
- Nothing hides behind the Dynamic Island or the home bar at the bottom.
- Turn the phone sideways: the game stays upright.
- Pet by dragging on the slime; swipe the menu sheet up and down.
- Sound: the first tap starts it. In a new game the Settings option "Sound when phone is on silent" (if it shows)
  starts **Off**: with the silent switch on, the game is quiet. Turn that option **On** and it plays even on silent.
  Try both, and with the silent switch off.
- Haptics: each boop gives a small, soft tap. Does it feel gentle?
- Settings > **Copy save code**, then **Load a save code** and paste it back.
- Force-quit the app (swipe it away) and open it again: the slime is still there.
- Play for ten minutes: is the phone warm? Is it smooth?
- Opening the app in light and in dark mode: the launch color, then the game. Any white or black flash?
- For the store, two sets of the same screens, to be safe (turn off the Speed meter first):
  1. At the top of Xcode, where you pick the device to run on, choose the **Pro** of the newest iPhone family
     (for example **iPhone 18 Pro**; if Xcode has no 18, **iPhone 17 Pro**). Run.
  2. Go to a nice screen and take a screenshot: in Xcode 27, click the **Screenshot** button below the phone in
     **Device Hub** (in older Xcode, the Simulator app: **File > Save Screen**). It lands on your Desktop.
  3. Do the same screens on the **Pro Max** of that family (iPhone 18 Pro Max or iPhone 17 Pro Max).
  4. Check the sizes: click a file in Finder, press Command-I, and look at **Dimensions** under More Info. The Pro
     gives **1206 x 2622** (the size Apple requires), the Pro Max **1320 x 2868** (the larger, optional size). A
     different size: send back the simulator's name and the size.
  5. Open each one in Preview, **File > Export**, Format **JPEG** (Apple refuses pictures with transparency; a JPEG
     has none). In App Store Connect the Pro set goes under the medium display size (Apple's page calls it "iPhone
     with Dynamic Island (medium display)"; the screen may say 6.3-inch) and the Pro Max set under the large display
     size (may say 6.9-inch).

## If something goes wrong: the five likeliest errors

When something fails, send back two things: **a screenshot of the red error** (in Xcode, the red line; click it to
see the whole message, or open the **Report navigator**, the last icon in the left sidebar), and **the last 20 lines of
Terminal** (select them with the mouse, **Cmd + C**, paste into the message).

1. **"Signing for 'App' requires a development team"**: step 3.6 (pick your Team).
2. **"The app identifier ... cannot be registered to your development team"** or **"Failed to register bundle
   identifier"**: the name `com.icyscreams.slimekin` is taken or not allowed. Don't change it in Xcode: send the
   screenshot; it gets changed in one file and you run `bash mac-build.sh` again.
3. **"Missing package product 'Capacitor'"**, **"Package resolution failed"** or a red **CapApp-SPM** error: check the
   internet, run `bash mac-build.sh` again (the packages live in `native/node_modules`), then in Xcode **File >
   Packages > Reset Package Caches**.
4. **The iPhone is not in the list** or **"Developer Mode disabled"** or **"device is not available"**: unlock the phone,
   reconnect the cable, tap Trust, do step 4.3 (Developer Mode), and wait if Xcode says it is preparing the device.
5. **In Terminal: "command not found: npm"**, **"Node.js ... is too old"** or **"STOP: ..."**: do what the STOP line says
   (usually step 1: install Node.js LTS, then close and reopen Terminal). An upload refused with **"build number ...
   already used"** means step 6.1 (raise the build number).
