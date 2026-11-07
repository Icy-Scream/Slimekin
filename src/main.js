import { Game } from './game.js';
import { SaveStore, KEY } from './core/save.js';
import { checkSave } from './core/save-check.js';
import { showBootSnag } from './ui/notice.js';
import * as platform from './platform/index.js';

let game = null;

async function boot(hotData) {
  // iPhone app only: bring back a save iOS cleared, or one that can't be read, from the phone's backup (no-op on the web)
  const restored = await platform.restoreSave();
  const store = platform.mirrorSaves(new SaveStore());   // iPhone app only: back up each local save (no-op on the web)
  // the save, or (missing or unreadable) the previous good save; an unreadable save's text is kept (core/save.js)
  let start = hotData && hotData.save && checkSave(hotData.save).ok ? { save: hotData.save, from: 'hot' } : store.loadBoot();
  if (restored && start.from === 'local') start = { ...start, from: 'backup', broken: !!platform.lastRestore?.broken, savedAt: start.save.savedAt };
  let save = start.save;
  let lateCloud = null;
  const connected = await store.connect(2500);
  if (connected) {
    const cloudPromise = store.loadCloud(8000);
    const quick = await Promise.race([cloudPromise, new Promise(r => setTimeout(() => r('late'), 2500))]);
    if (quick === 'late') lateCloud = cloudPromise;
    else if (quick && (!save || (quick.savedAt || 0) > (save.savedAt || 0))) save = quick;
  }

  if (save !== start.save) start = { save, from: 'cloud' };

  const bootEl = document.getElementById('boot');
  try {
    game = new Game({ canvas: document.getElementById('scene'), save, store, start });
  } catch (e) {
    console.error(e);
    // honest: "needs WebGL" only when this browser really has none; anything else says the save was not changed
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch { /* blocked */ }
    showBootSnag(bootEl, e, { store, raw });
    return;
  }
  window.claude?.hot?.snapshot?.(() => ({ save: game.serialize() }));
  performance.mark('slimekin-built');
  // The loading screen stays until home shows what it should: with the Greenhouse as home, until its room is in and drawn
  // (at most GREENHOUSE.arrive.wait s, then the room cross-fades in when it comes). The Meadow and Classic don't wait.
  await game.firstLook();
  performance.mark('slimekin-shown');
  bootEl.style.opacity = '0';
  setTimeout(() => { bootEl.hidden = true; }, 500);
  game.shown();

  // A cloud save that arrives late only replaces a brand-new egg.
  if (lateCloud) {
    lateCloud.then(cloud => {
      // An egg can also mean a slime just moved to the ranch: then only a newer cloud save wins.
      const st = game.state;
      const brandNew = st.ranch.family.generation === 1 && !st.stats.boops;
      if (cloud && cloud.phase !== 'egg' && st.phase === 'egg' && (brandNew || (cloud.savedAt || 0) > (st.savedAt || 0))) {
        store.saveLocal(cloud);
        location.reload();
      }
    });
  }
  if (location.hash === '#debug' && !platform.isNative) window.slimekin = game;
}

// Stop iPhone pinch-zoom on the game (it fights with petting and pulling).
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });

const hot = window.claude?.hot;
if (hot?.ready) hot.ready(boot);
else boot(hot?.data ?? {});
