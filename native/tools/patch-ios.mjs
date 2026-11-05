// Applies Slimekin's iPhone project settings to native/ios/. Run it after `npx cap add ios` or `npx cap update ios`
// (both can bring back template files); mac-build.sh runs it every time. A second run changes nothing.
//   node tools/patch-ios.mjs            (from native/)
// Settings, and where each one comes from:
//   bundle id, display name     capacitor.config.json ("appId", "appName"): the one place they are written
//   version, build number       app-version.json (raise "build" for every TestFlight upload)
//   app icon                    assets/AppIcon-1024.png (1024 x 1024, no transparency; Apple rounds the corners)
//   iPhone only, portrait only, iOS 17.0, no encryption export paperwork (ITSAppUsesNonExemptEncryption = false),
//   UIRequiredDeviceCapabilities arm64, a launch screen in the game's boot colors (light #f3e6ee, dark #17132e),
//   the privacy manifest (PrivacyInfo.xcprivacy: Preferences uses UserDefaults, reason CA92.1), no signing team.
// Only text edits of Info.plist, the Xcode project file, the launch screen, the asset catalog and the privacy
// manifest; no Swift or Objective-C. Every edit checks it found what it expected and stops loudly otherwise.
// tools/check-ios.mjs reads everything back.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const native = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const app = path.join(native, 'ios', 'App');
const P = {
  config: path.join(native, 'capacitor.config.json'),
  version: path.join(native, 'app-version.json'),
  icon: path.join(native, 'assets', 'AppIcon-1024.png'),
  plist: path.join(app, 'App', 'Info.plist'),
  pbxproj: path.join(app, 'App.xcodeproj', 'project.pbxproj'),
  launch: path.join(app, 'App', 'Base.lproj', 'LaunchScreen.storyboard'),
  assets: path.join(app, 'App', 'Assets.xcassets'),
  privacy: path.join(app, 'App', 'PrivacyInfo.xcprivacy'),
};
const fail = msg => { console.error(`patch-ios: ${msg}`); process.exit(1); };
if (!fs.existsSync(P.pbxproj)) fail('no ios/App/App.xcodeproj here. Run "npx cap add ios" first (in native/).');

const config = JSON.parse(fs.readFileSync(P.config, 'utf8'));
const { version, build } = JSON.parse(fs.readFileSync(P.version, 'utf8'));
const appId = config.appId, appName = config.appName;
if (!/^[A-Za-z][A-Za-z0-9-]*(\.[A-Za-z0-9-]+)+$/.test(appId || '')) fail(`capacitor.config.json appId "${appId}" is not a bundle id`);
if (!appName) fail('capacitor.config.json has no appName');
if (!/^\d+\.\d+\.\d+$/.test(version || '')) fail(`app-version.json version "${version}" should look like 1.0.0`);
if (!Number.isInteger(build) || build < 1) fail(`app-version.json build "${build}" should be a whole number, 1 or more`);
const xmlText = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const changed = [];
function write(file, text) {
  const before = fs.existsSync(file) ? fs.readFileSync(file) : null;
  const next = Buffer.isBuffer(text) ? text : Buffer.from(text);
  if (before && before.equals(next)) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next);
  changed.push(path.relative(native, file));
}
function remove(p) {
  if (!fs.existsSync(p)) return;
  fs.rmSync(p, { recursive: true, force: true });
  changed.push(path.relative(native, p) + ' (removed)');
}

// ---------- Info.plist (top-level keys; each edit asserts the key's shape) ----------
let plist = fs.readFileSync(P.plist, 'utf8');
const topKey = key => new RegExp(`(\\n[ \\t]*)<key>${key.replace(/[~.]/g, '\\$&')}</key>\\s*(<array>[\\s\\S]*?</array>|<array/>|<string>[^<]*</string>|<true/>|<false/>)`);
function setKey(key, valueXml) {
  const re = topKey(key);
  if (re.test(plist)) plist = plist.replace(re, (m, indent) => `${indent}<key>${key}</key>${indent}${valueXml}`);
  else {
    if (!/\n<\/dict>\n<\/plist>\s*$/.test(plist)) fail('Info.plist does not end with </dict></plist> as expected');
    plist = plist.replace(/\n<\/dict>\n<\/plist>\s*$/, `\n\t<key>${key}</key>\n\t${valueXml}\n</dict>\n</plist>\n`);
  }
}
function dropKey(key) { plist = plist.replace(new RegExp(`\\n[ \\t]*<key>${key.replace(/[~.]/g, '\\$&')}</key>\\s*(<array>[\\s\\S]*?</array>|<array/>|<string>[^<]*</string>|<true/>|<false/>)`), ''); }
const arr = items => `<array>\n${items.map(s => `\t\t<string>${s}</string>`).join('\n')}\n\t</array>`;
if (!/<key>CFBundleIdentifier<\/key>\s*<string>\$\(PRODUCT_BUNDLE_IDENTIFIER\)<\/string>/.test(plist)) fail('Info.plist CFBundleIdentifier is not $(PRODUCT_BUNDLE_IDENTIFIER)');
setKey('CFBundleDisplayName', `<string>${xmlText(appName)}</string>`);
setKey('CFBundleShortVersionString', '<string>$(MARKETING_VERSION)</string>');
setKey('CFBundleVersion', '<string>$(CURRENT_PROJECT_VERSION)</string>');
setKey('UISupportedInterfaceOrientations', arr(['UIInterfaceOrientationPortrait']));
dropKey('UISupportedInterfaceOrientations~ipad');   // iPhone only
setKey('UIRequiredDeviceCapabilities', arr(['arm64']));   // Apple: "Include this key for all 64-bit apps"
setKey('ITSAppUsesNonExemptEncryption', '<false/>');
setKey('UILaunchStoryboardName', '<string>LaunchScreen</string>');
write(P.plist, plist);

// ---------- Xcode project: build settings ----------
let pbx = fs.readFileSync(P.pbxproj, 'utf8');
function setting(name, value, { min = 1 } = {}) {
  const re = new RegExp(`(\\n\\t+${name} = )("[^"]*"|[^;\\n]*);`, 'g');
  const n = (pbx.match(re) || []).length;
  if (n < min) fail(`project.pbxproj: expected at least ${min} "${name}" setting(s), found ${n}`);
  pbx = pbx.replace(re, `$1${value};`);
}
setting('IPHONEOS_DEPLOYMENT_TARGET', '17.0', { min: 2 });
setting('TARGETED_DEVICE_FAMILY', '1', { min: 2 });   // 1 = iPhone
setting('MARKETING_VERSION', version, { min: 2 });
setting('CURRENT_PROJECT_VERSION', String(build), { min: 2 });
setting('PRODUCT_BUNDLE_IDENTIFIER', appId, { min: 2 });
pbx = pbx.replace(/\n\t+DEVELOPMENT_TEAM = [^;\n]*;/g, '');   // the captain picks his team in Xcode; never in git

// ---------- Xcode project: the privacy manifest as a resource of the App target ----------
const FREF = '5D1A1EC0FFEE00000000A001', BREF = '5D1A1EC0FFEE00000000A002';
const privacyFile = `\t\t${FREF} /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };\n`;
const privacyBuild = `\t\t${BREF} /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = ${FREF} /* PrivacyInfo.xcprivacy */; };\n`;
function insertOnce(what, has, anchorRe, text) {
  if (pbx.includes(has)) return;
  const m = pbx.match(anchorRe);
  if (!m) fail(`project.pbxproj: could not find where to add ${what}`);
  pbx = pbx.replace(anchorRe, m[0] + text);
}
insertOnce('the PrivacyInfo.xcprivacy build file', `${BREF} /* PrivacyInfo.xcprivacy in Resources */ = {`, /\/\* Begin PBXBuildFile section \*\/\n/, privacyBuild);
insertOnce('the PrivacyInfo.xcprivacy file reference', `${FREF} /* PrivacyInfo.xcprivacy */ = {`, /\/\* Begin PBXFileReference section \*\/\n/, privacyFile);
insertOnce('PrivacyInfo.xcprivacy in the App group', `\t\t\t\t${FREF} /* PrivacyInfo.xcprivacy */,\n`,
  /\/\* App \*\/ = \{\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = \(\n/, `\t\t\t\t${FREF} /* PrivacyInfo.xcprivacy */,\n`);
insertOnce('PrivacyInfo.xcprivacy in the Resources phase', `\t\t\t\t${BREF} /* PrivacyInfo.xcprivacy in Resources */,\n`,
  /\/\* Resources \*\/ = \{\n\t\t\tisa = PBXResourcesBuildPhase;\n\t\t\tbuildActionMask = \d+;\n\t\t\tfiles = \(\n/, `\t\t\t\t${BREF} /* PrivacyInfo.xcprivacy in Resources */,\n`);
write(P.pbxproj, pbx);

write(P.privacy, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>NSPrivacyTracking</key>
	<false/>
	<key>NSPrivacyTrackingDomains</key>
	<array/>
	<key>NSPrivacyCollectedDataTypes</key>
	<array/>
	<key>NSPrivacyAccessedAPITypes</key>
	<array>
		<dict>
			<key>NSPrivacyAccessedAPIType</key>
			<string>NSPrivacyAccessedAPICategoryUserDefaults</string>
			<key>NSPrivacyAccessedAPITypeReasons</key>
			<array>
				<string>CA92.1</string>
			</array>
		</dict>
	</array>
</dict>
</plist>
`);

// ---------- launch screen: one plain color, the game's boot screen ("Warming the nest") ----------
// The color is a named color from the asset catalog with a dark appearance, so it follows the phone's dark mode
// like the game does (prefers-color-scheme). The template's splash image is not used any more.
write(path.join(P.assets, 'LaunchBackground.colorset', 'Contents.json'), JSON.stringify({
  colors: [
    { color: { 'color-space': 'srgb', components: { alpha: '1.000', red: '0xF3', green: '0xE6', blue: '0xEE' } }, idiom: 'universal' },
    { appearances: [{ appearance: 'luminosity', value: 'dark' }], color: { 'color-space': 'srgb', components: { alpha: '1.000', red: '0x17', green: '0x13', blue: '0x2E' } }, idiom: 'universal' },
  ],
  info: { author: 'xcode', version: 1 },
}, null, 2) + '\n');
remove(path.join(P.assets, 'Splash.imageset'));
write(P.launch, `<?xml version="1.0" encoding="UTF-8"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="17132" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES" initialViewController="01J-lp-oVM">
    <device id="retina4_7" orientation="portrait" appearance="light"/>
    <dependencies>
        <deployment identifier="iOS"/>
        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="17105"/>
        <capability name="Named colors" minToolsVersion="9.0"/>
        <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
    </dependencies>
    <scenes>
        <!--View Controller-->
        <scene sceneID="EHf-IW-A2E">
            <objects>
                <viewController id="01J-lp-oVM" sceneMemberID="viewController">
                    <view key="view" contentMode="scaleToFill" id="snD-IY-ifK">
                        <rect key="frame" x="0.0" y="0.0" width="375" height="667"/>
                        <autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"/>
                        <color key="backgroundColor" name="LaunchBackground"/>
                    </view>
                </viewController>
                <placeholder placeholderIdentifier="IBFirstResponder" id="iYj-Kq-Ea1" userLabel="First Responder" sceneMemberID="firstResponder"/>
            </objects>
            <point key="canvasLocation" x="53" y="375"/>
        </scene>
    </scenes>
    <resources>
        <namedColor name="LaunchBackground">
            <color red="0.95294117647058818" green="0.90196078431372551" blue="0.93333333333333335" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>
        </namedColor>
    </resources>
</document>
`);

// ---------- app icon: one 1024 x 1024 image (Xcode 14+ makes every size from it) ----------
const iconSet = path.join(P.assets, 'AppIcon.appiconset');
if (!fs.existsSync(P.icon)) fail('assets/AppIcon-1024.png is missing');
const png = fs.readFileSync(P.icon);
if (png.toString('ascii', 12, 16) !== 'IHDR' || png.readUInt32BE(16) !== 1024 || png.readUInt32BE(20) !== 1024) fail('assets/AppIcon-1024.png must be a 1024 x 1024 PNG');
if (![0, 2].includes(png[25])) fail('assets/AppIcon-1024.png must have no transparency (PNG color type RGB); the App Store rejects icons with alpha');
for (const f of fs.existsSync(iconSet) ? fs.readdirSync(iconSet) : []) if (f !== 'Contents.json' && f !== 'AppIcon-1024.png') remove(path.join(iconSet, f));
write(path.join(iconSet, 'AppIcon-1024.png'), png);
write(path.join(iconSet, 'Contents.json'), JSON.stringify({
  images: [{ filename: 'AppIcon-1024.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }],
  info: { author: 'xcode', version: 1 },
}, null, 2) + '\n');

console.log(changed.length ? `patch-ios: updated ${changed.length} file(s):\n  ${changed.join('\n  ')}` : 'patch-ios: no change (everything was already set)');
