// Reads the iPhone project back and checks every setting Slimekin needs (run after tools/patch-ios.mjs; mac-build.sh
// runs both). Fails (exit 1) and lists what is wrong.
//   node tools/check-ios.mjs            (from native/)
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const native = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const app = path.join(native, 'ios', 'App');
const rel = p => path.relative(native, p);
const problems = [], passed = [];
const check = (ok, what, detail = '') => (ok ? passed : problems).push(what + (detail ? ` (${detail})` : ''));
const read = p => { try { return fs.readFileSync(p, 'utf8'); } catch { problems.push(`missing: ${rel(p)}`); return ''; } };

// A small XML property list reader (dict, array, string, integer, real, true, false, date, data).
function parsePlist(xml) {
  const body = xml.replace(/<\?xml[^>]*\?>/, '').replace(/<!DOCTYPE[^>]*>/, '').replace(/<!--[\s\S]*?-->/g, '');
  const tokens = [...body.matchAll(/<(\/?)([A-Za-z]+)(?:\s+[^>]*?)?\s*(\/?)>|([^<]+)/g)].map(m => m[4] !== undefined ? { text: m[4] } : { close: !!m[1], name: m[2], empty: !!m[3] }).filter(t => !(t.text !== undefined && !t.text.trim()));
  let i = 0;
  const unxml = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const textUntil = name => { let s = ''; while (!(tokens[i].close && tokens[i].name === name)) s += tokens[i++].text ?? ''; i++; return unxml(s); };
  function value() {
    const t = tokens[i++];
    if (!t || t.close || t.text !== undefined) throw new Error(`unexpected token at ${i}`);
    if (t.empty) return t.name === 'true' ? true : t.name === 'false' ? false : t.name === 'array' ? [] : t.name === 'dict' ? {} : t.name === 'string' ? '' : null;
    if (t.name === 'dict') {
      const o = {};
      while (!(tokens[i].close && tokens[i].name === 'dict')) {
        if (tokens[i].name !== 'key') throw new Error('dict without key');
        i++;
        const k = textUntil('key');
        if (k in o) throw new Error(`duplicate key ${k}`);
        o[k] = value();
      }
      i++;
      return o;
    }
    if (t.name === 'array') { const a = []; while (!(tokens[i].close && tokens[i].name === 'array')) a.push(value()); i++; return a; }
    if (t.name === 'string' || t.name === 'date' || t.name === 'data') return textUntil(t.name);
    if (t.name === 'integer' || t.name === 'real') return Number(textUntil(t.name));
    throw new Error(`unknown element <${t.name}>`);
  }
  if (tokens[i].name !== 'plist') throw new Error('no <plist>');
  i++;
  const v = value();
  if (!(tokens[i] && tokens[i].close && tokens[i].name === 'plist')) throw new Error('content after the top value');
  return v;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------- capacitor.config.json: the one place for the bundle id ----------
const config = JSON.parse(read(path.join(native, 'capacitor.config.json')) || '{}');
const ver = JSON.parse(read(path.join(native, 'app-version.json')) || '{}');
check(/^[A-Za-z][A-Za-z0-9-]*(\.[A-Za-z0-9-]+)+$/.test(config.appId || ''), `capacitor.config.json appId is a bundle id: ${config.appId}`);
check(config.appName === 'Slimekin', `capacitor.config.json appName is "Slimekin"`, config.appName);
check(config.webDir === 'www', 'capacitor.config.json webDir is "www"');
check(!('server' in config), 'capacitor.config.json has no "server" block (the app loads its bundled files)');

// ---------- Info.plist ----------
const plistPath = path.join(app, 'App', 'Info.plist');
let info = {};
try { info = parsePlist(read(plistPath)); passed.push('Info.plist parses'); } catch (e) { problems.push(`Info.plist does not parse: ${e.message}`); }
check(same(info.UISupportedInterfaceOrientations, ['UIInterfaceOrientationPortrait']), 'portrait only', JSON.stringify(info.UISupportedInterfaceOrientations));
check(!('UISupportedInterfaceOrientations~ipad' in info), 'no iPad orientation list');
check(info.CFBundleDisplayName === config.appName, `display name is "${config.appName}"`, info.CFBundleDisplayName);
check(info.CFBundleIdentifier === '$(PRODUCT_BUNDLE_IDENTIFIER)', 'bundle id comes from the build setting');
check(info.CFBundleShortVersionString === '$(MARKETING_VERSION)' && info.CFBundleVersion === '$(CURRENT_PROJECT_VERSION)', 'version and build come from the build settings');
check(info.ITSAppUsesNonExemptEncryption === false, 'ITSAppUsesNonExemptEncryption = false');
check(same(info.UIRequiredDeviceCapabilities, ['arm64']), 'UIRequiredDeviceCapabilities = [arm64]', JSON.stringify(info.UIRequiredDeviceCapabilities));
const usage = Object.keys(info).filter(k => /^NS.*UsageDescription$/.test(k));
check(usage.length === 0, 'no NS...UsageDescription keys (no permissions asked)', usage.join(', '));
check(!('UIBackgroundModes' in info), 'no background modes');
check(!('WKAppBoundDomains' in info), 'no app-bound domains list');
check(!('NSAppTransportSecurity' in info), 'no App Transport Security exceptions');
check(info.UILaunchStoryboardName === 'LaunchScreen', 'launch screen is LaunchScreen.storyboard');
check(!('CFBundleURLTypes' in info) && !('LSApplicationQueriesSchemes' in info), 'no URL schemes');

// ---------- the Xcode project ----------
const pbx = read(path.join(app, 'App.xcodeproj', 'project.pbxproj'));
const settings = name => [...pbx.matchAll(new RegExp(`\\n\\t+${name} = ("[^"]*"|[^;\\n]*);`, 'g'))].map(m => m[1].replace(/^"|"$/g, ''));
const all = (name, want, min = 2) => { const v = settings(name); check(v.length >= min && v.every(x => x === want), `${name} = ${want} in every configuration`, JSON.stringify(v)); };
all('IPHONEOS_DEPLOYMENT_TARGET', '17.0', 4);
all('TARGETED_DEVICE_FAMILY', '1');
all('MARKETING_VERSION', ver.version);
all('CURRENT_PROJECT_VERSION', String(ver.build));
all('PRODUCT_BUNDLE_IDENTIFIER', config.appId);
check(settings('DEVELOPMENT_TEAM').every(v => v === ''), 'DEVELOPMENT_TEAM empty (the captain sets his team in Xcode)', JSON.stringify(settings('DEVELOPMENT_TEAM')));
check(settings('CODE_SIGN_STYLE').every(v => v === 'Automatic'), 'signing is automatic');
for (const k of ['SUPPORTS_MACCATALYST', 'SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD', 'SUPPORTS_XR_DESIGNED_FOR_IPHONE_IPAD']) check(settings(k).every(v => v === 'NO'), `${k} not turned on`, JSON.stringify(settings(k)));
const ids = [...pbx.matchAll(/\n\t\t([0-9A-F]{24}) (?:\/\*[^*]*\*\/ )?= \{/g)].map(m => m[1]);
check(ids.length > 20 && new Set(ids).size === ids.length, 'project object ids are unique', `${ids.length} objects`);
const resources = (pbx.match(/isa = PBXResourcesBuildPhase;[\s\S]*?files = \(([\s\S]*?)\);/) || [])[1] || '';
check(/PrivacyInfo\.xcprivacy in Resources/.test(resources), 'PrivacyInfo.xcprivacy is in the App target\'s resources');
check((pbx.match(/\{/g) || []).length === (pbx.match(/\}/g) || []).length && (pbx.match(/\(/g) || []).length === (pbx.match(/\)/g) || []).length, 'project file braces balance');

// ---------- privacy manifest ----------
let priv = {};
try { priv = parsePlist(read(path.join(app, 'App', 'PrivacyInfo.xcprivacy'))); passed.push('PrivacyInfo.xcprivacy parses'); } catch (e) { problems.push(`PrivacyInfo.xcprivacy does not parse: ${e.message}`); }
check(priv.NSPrivacyTracking === false && same(priv.NSPrivacyTrackingDomains, []) && same(priv.NSPrivacyCollectedDataTypes, []), 'privacy manifest: no tracking, no tracking domains, no data collected');
check(same(priv.NSPrivacyAccessedAPITypes, [{ NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] }]), 'privacy manifest: UserDefaults (the save backup), reason CA92.1, nothing else');

// ---------- launch screen and icon ----------
const launch = read(path.join(app, 'App', 'Base.lproj', 'LaunchScreen.storyboard'));
check(/<color key="backgroundColor" name="LaunchBackground"\/>/.test(launch) && !/<image /.test(launch) && !/<imageView /.test(launch), 'launch screen: a plain view in the LaunchBackground color, no image');
const colors = JSON.parse(read(path.join(app, 'App', 'Assets.xcassets', 'LaunchBackground.colorset', 'Contents.json')) || '{"colors":[]}').colors;
const hex = c => ['red', 'green', 'blue'].map(k => Number(c.color.components[k]).toString(16).padStart(2, '0')).join('');
const light = colors.find(c => !c.appearances), dark = colors.find(c => (c.appearances || []).some(a => a.value === 'dark'));
check(light && hex(light) === 'f3e6ee' && dark && hex(dark) === '17132e', 'launch color: #f3e6ee, dark mode #17132e (the boot screen colors)', light && dark ? `${hex(light)} / ${hex(dark)}` : 'missing');
check(!fs.existsSync(path.join(app, 'App', 'Assets.xcassets', 'Splash.imageset')), 'the template splash image is gone');
const iconDir = path.join(app, 'App', 'Assets.xcassets', 'AppIcon.appiconset');
const iconSet = JSON.parse(read(path.join(iconDir, 'Contents.json')) || '{"images":[]}').images;
check(iconSet.length === 1 && iconSet[0].size === '1024x1024' && iconSet[0].idiom === 'universal' && iconSet[0].platform === 'ios', 'app icon: one single-size 1024 image');
const png = iconSet[0] ? fs.readFileSync(path.join(iconDir, iconSet[0].filename)) : Buffer.alloc(0);
check(png.length > 33 && png.readUInt32BE(16) === 1024 && png.readUInt32BE(20) === 1024 && [0, 2].includes(png[25]), 'app icon: 1024 x 1024 PNG without an alpha channel', png.length > 33 ? `color type ${png[25]}` : 'unreadable');
check(fs.existsSync(path.join(native, 'assets', 'AppIcon-1024.png')) && png.equals(fs.readFileSync(path.join(native, 'assets', 'AppIcon-1024.png'))), 'app icon matches assets/AppIcon-1024.png');

// ---------- nothing secret ----------
const secrets = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'www' || e.name === 'public') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (/\.(mobileprovision|p12|p8|cer|certSigningRequest|keychain)$/i.test(e.name)) secrets.push(rel(p));
  }
})(native);
check(secrets.length === 0, 'no signing files (certificates, profiles, keys) in native/', secrets.join(', '));

console.log(`check-ios: ${passed.length} passed, ${problems.length} failed`);
for (const p of passed) console.log('  ok   ' + p);
for (const p of problems) console.log('  FAIL ' + p);
process.exit(problems.length ? 1 : 0);
