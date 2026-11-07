// Plain cards for when something went wrong: the start-up snag, a game that keeps hitting an error, a picture the
// phone took away (WebGL context lost), a save that could not be read. Built from plain DOM with the page's own
// .modal / .modal-card / .btn styles, so they work even when the game (or its HUD) never started.
import { esc } from './esc.js';
import { fmtDuration } from '../core/format.js';

// { key, title, body (html), buttons: [{ id, label, primary, onClick }], note (plain text, small) } -> { el, close, set }
export function showNotice({ key = 'notice', title, body = '', buttons = [], note = '' }) {
  const id = 'notice-' + key;
  document.getElementById(id)?.remove();
  const el = document.createElement('div');
  el.className = 'modal notice';
  el.id = id;
  const card = document.createElement('div');
  card.className = 'modal-card';
  card.setAttribute('role', 'alertdialog');
  card.setAttribute('aria-modal', 'true');
  el.appendChild(card);
  const set = ({ title: t = title, body: b = body, buttons: bs = buttons, note: n = note } = {}) => {
    card.innerHTML = `<h2>${esc(t)}</h2>${b}${bs.length ? `<div class="actions">${bs.map(x =>
      `<button class="btn${x.primary ? ' primary' : ''}" data-act="${esc(x.id)}">${esc(x.label)}</button>`).join('')}</div>` : ''}${
      n ? `<p class="notice-note">${esc(n)}</p>` : ''}`;
    for (const x of bs) card.querySelector(`[data-act="${x.id}"]`)?.addEventListener('click', () => x.onClick && x.onClick(handle));
    const focus = card.querySelector('button.primary') || card.querySelector('button');
    focus && setTimeout(() => focus.focus({ preventScroll: true }), 50);
  };
  const close = () => el.remove();
  const handle = { el, close, set };
  set();
  document.body.appendChild(el);
  return handle;
}

// Copy text to the clipboard; resolves true when it worked (with a select-and-copy fallback for older browsers).
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}

// "5 min ago", "2h ago", "just now"
export const agoText = at => {
  const s = (Date.now() - (at || 0)) / 1000;
  return !at || s < 0 ? 'a little while ago' : s < 60 ? 'just now' : `${fmtDuration(s)} ago`;
};

// Can this browser draw 3D at all? A real check on a spare canvas (the context is let go right away).
export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch { return false; }
}

// The game could not start (main.js). Honest about why: no WebGL, or something else (the save is untouched).
// store: the SaveStore (for the save code and the previous good save); raw: the save's text on this device.
export function showBootSnag(bootEl, error, { store, raw } = {}) {
  if (!hasWebGL()) {
    bootEl.innerHTML = '<div style="max-width:340px;text-align:center;font-family:var(--body);font-size:15px;line-height:1.5;padding:0 16px">This slime needs 3D graphics (WebGL), and this browser could not start them. Try another browser, or turn on hardware acceleration.</div>';
    return 'webgl';
  }
  bootEl.innerHTML = '';
  const prev = store?.prevSave?.();
  const buttons = [{ id: 'again', label: 'Try again', primary: true, onClick: () => location.reload() }];
  if (raw) buttons.push({ id: 'code', label: 'Copy save code', onClick: async n => {
    const ok = await copyText('SLIMEKIN1:' + btoa(unescape(encodeURIComponent(raw))));
    n.set({ body: `<p>${ok ? 'Save code copied. Keep it somewhere safe (a note or a message to yourself).' : 'Copying did not work here.'}</p>` });
  } });
  if (prev && store.prevSave && JSON.stringify(prev.save) !== raw) buttons.push({ id: 'prev', label: 'Restore last good save', onClick: () => { store.restorePrev(); location.reload(); } });
  showNotice({
    key: 'boot',
    title: 'Slimekin hit a snag',
    body: `<p>Something went wrong while the game was starting. Your save was not changed.</p>${prev ? `<p>There is also a good save from ${esc(agoText(prev.savedAt))} on this device.</p>` : ''}`,
    buttons,
    note: 'Details: ' + String(error && (error.message || error) || 'unknown').slice(0, 160),
  });
  return 'snag';
}
