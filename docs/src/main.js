import { Game } from './game.js';
import { SaveStore } from './core/save.js';

let game = null;

async function boot(hotData) {
  const store = new SaveStore();
  let save = hotData && hotData.save ? hotData.save : store.loadLocal();
  let lateCloud = null;
  const connected = await store.connect(2500);
  if (connected) {
    const cloudPromise = store.loadCloud(8000);
    const quick = await Promise.race([cloudPromise, new Promise(r => setTimeout(() => r('late'), 2500))]);
    if (quick === 'late') lateCloud = cloudPromise;
    else if (quick && (!save || (quick.savedAt || 0) > (save.savedAt || 0))) save = quick;
  }

  const bootEl = document.getElementById('boot');
  try {
    game = new Game({ canvas: document.getElementById('scene'), save, store });
  } catch (e) {
    console.error(e);
    bootEl.innerHTML = '<div style="max-width:340px;text-align:center;font-family:var(--body);font-size:15px;line-height:1.5;padding:0 16px">This slime needs 3D graphics (WebGL), and this browser could not start them. Try another browser, or turn on hardware acceleration.</div>';
    return;
  }
  window.claude?.hot?.snapshot?.(() => ({ save: game.serialize() }));
  bootEl.style.opacity = '0';
  setTimeout(() => { bootEl.hidden = true; }, 500);

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
  if (location.hash === '#debug') window.slimekin = game;
}

// Stop iPhone pinch-zoom on the game (it fights with petting and pulling).
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });

const hot = window.claude?.hot;
if (hot?.ready) hot.ready(boot);
else boot(hot?.data ?? {});
