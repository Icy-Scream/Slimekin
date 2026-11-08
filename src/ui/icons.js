// Small drawn icons for the interface (replacing emoji and text glyphs, which look different on every
// phone). All inline SVG strings, sized by CSS (class "gi"). Colors are fixed so they read the same in
// day and night themes.

const svg = (body, cls = 'gi', vb = '0 0 24 24') => `<svg class="${cls}" viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;

const P = {
  sparkle: 'M12 1.8c.7 4.6 2.2 6.4 6.6 7.4.4.1.4.7 0 .8-4.4 1-5.9 2.8-6.6 7.4-.1.5-.7.5-.8 0-.7-4.6-2.2-6.4-6.6-7.4-.4-.1-.4-.7 0-.8 4.4-1 5.9-2.8 6.6-7.4.1-.5.7-.5.8 0z',
  heart: 'M12 20.6C5.3 16 2.6 12.6 2.6 9.2A4.8 4.8 0 0 1 7.4 4.4c1.9 0 3.5 1 4.6 2.6 1.1-1.6 2.7-2.6 4.6-2.6a4.8 4.8 0 0 1 4.8 4.8c0 3.4-2.7 6.8-9.4 11.4z',
  star: 'M12 2.4l2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 16.6l-5.8 3.3 1.4-6.4L2.7 9.1l6.5-.7z',
};

export const ICON = {
  sparkle: svg(`<path d="${P.sparkle}" fill="#ffc53d"/><path d="${P.sparkle}" fill="#fff6c8" transform="translate(12 12) scale(.42) translate(-12 -12)"/>`, 'gi spark'),
  heart: svg(`<path d="${P.heart}" fill="#f2577f"/><path d="M7.2 6.6c-1.4.2-2.4 1.3-2.5 2.6" stroke="#ffc2d3" stroke-width="1.5" fill="none" stroke-linecap="round"/>`, 'gi heart'),
  hourglass: svg('<path d="M6 2.5h12M6 21.5h12" stroke="#8a6fb2" stroke-width="2" stroke-linecap="round"/><path d="M7.5 3.5h9c0 4-2.8 5.4-4.5 8.5-1.7-3.1-4.5-4.5-4.5-8.5zM7.5 20.5h9c0-3.4-2.8-4.6-4.5-7.4-1.7 2.8-4.5 4-4.5 7.4z" fill="#d9ccf0"/><path d="M9.6 19.6h4.8c-.4-1.6-1.4-2.4-2.4-3.4-1 1-2 1.8-2.4 3.4z" fill="#ffb3cc"/>'),
  // the Greenhouse camera button: a little camera; `cameraBack` adds a curved arrow (you turned it: tap for the front view)
  camera: svg('<path d="M8.2 5.6l1.3-1.9h5l1.3 1.9h3A2.6 2.6 0 0 1 21.4 8.2v9.4a2.6 2.6 0 0 1-2.6 2.6H5.2a2.6 2.6 0 0 1-2.6-2.6V8.2a2.6 2.6 0 0 1 2.6-2.6z" fill="#8a6fd6"/><circle cx="12" cy="12.8" r="4.6" fill="#f3ecff"/><circle cx="12" cy="12.8" r="2.9" fill="#5e4a8c"/><circle cx="10.9" cy="11.7" r="1" fill="#fff"/><circle cx="18.2" cy="8.6" r="1" fill="#ffd36a"/>', 'gi cam'),
  // the Barn ranch's previous / next buttons (a soft chevron)
  chevronLeft: svg('<path d="M14.8 5.2L8 12l6.8 6.8" stroke="#6b4bd6" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>', 'gi chev'),
  chevronRight: svg('<path d="M9.2 5.2L16 12l-6.8 6.8" stroke="#6b4bd6" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>', 'gi chev'),
  cameraBack: svg('<path d="M7.4 6.4l1.1-1.6h4.2l1.1 1.6h2.5a2.2 2.2 0 0 1 2.2 2.2v7.8a2.2 2.2 0 0 1-2.2 2.2H4.8a2.2 2.2 0 0 1-2.2-2.2V8.6a2.2 2.2 0 0 1 2.2-2.2z" fill="#8a6fd6"/><circle cx="10.6" cy="12.6" r="3.8" fill="#f3ecff"/><circle cx="10.6" cy="12.6" r="2.3" fill="#5e4a8c"/><path d="M15.6 20.6a5.2 5.2 0 0 0 5.6-6.4" stroke="#f08a2c" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M18.6 13.4l2.8.4.6-2.7" stroke="#f08a2c" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>', 'gi cam'),
};

// Journal memory icons, keyed by the emoji stored in saves (old saves keep working).
const MEM = {
  '✦': ICON.sparkle,
  '✨': svg(`<path d="${P.sparkle}" fill="#ffc53d" transform="translate(-1 2) scale(.8)"/><path d="${P.sparkle}" fill="#ffe08a" transform="translate(13 -.5) scale(.45)"/><path d="${P.sparkle}" fill="#ffd36a" transform="translate(14.5 13) scale(.38)"/>`),
  '⭐': svg(`<path d="${P.star}" fill="#ffc53d" stroke="#f0a020" stroke-width="1" stroke-linejoin="round"/><path d="M9.2 9.6l1.6-.2" stroke="#fff6c8" stroke-width="1.6" stroke-linecap="round"/>`),
  '❤️': ICON.heart,
  '🥚': svg('<path d="M12 2.6c3.9 0 7 6.1 7 10.8a7 7 0 0 1-14 0C5 8.7 8.1 2.6 12 2.6z" fill="#fff4e4" stroke="#e8cfa8" stroke-width="1"/><circle cx="9.4" cy="12.6" r="1.7" fill="#7fe0bf"/><circle cx="14.6" cy="9" r="1.3" fill="#ffb3cc"/><circle cx="14.2" cy="16" r="1.5" fill="#ffb3cc"/><circle cx="10.4" cy="7.2" r=".9" fill="#7fe0bf"/>'),
  '💌': svg('<rect x="2.6" y="5.6" width="18.8" height="13.4" rx="2.4" fill="#ffd3e1"/><path d="M3.4 7l8.6 6.2L20.6 7" stroke="#f08aa8" stroke-width="1.6" fill="none" stroke-linejoin="round"/><path d="M12 17.6c-2.6-1.7-3.6-3-3.6-4.3a1.8 1.8 0 0 1 3.6-.4 1.8 1.8 0 0 1 3.6.4c0 1.3-1 2.6-3.6 4.3z" fill="#f2577f"/>'),
  '🏡': svg('<path d="M3 11.2L12 4l9 7.2V20a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 20z" fill="#ffc9b8"/><path d="M1.8 11.8L12 3.6l10.2 8.2" stroke="#d06a72" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 18.6c-2.4-1.6-3.3-2.8-3.3-4a1.65 1.65 0 0 1 3.3-.4 1.65 1.65 0 0 1 3.3.4c0 1.2-.9 2.4-3.3 4z" fill="#f2577f"/>'),
  '💧': svg('<path d="M12 2.4c3.8 4.8 6.8 8.4 6.8 12.2a6.8 6.8 0 0 1-13.6 0C5.2 10.8 8.2 7.2 12 2.4z" fill="#3cc79a"/><path d="M8.6 14.4a3.5 3.5 0 0 0 2.4 3.6" stroke="#c9f5e5" stroke-width="1.6" fill="none" stroke-linecap="round"/>'),
  '🫧': svg('<circle cx="9" cy="13.5" r="6" fill="#d8efff" stroke="#8ccaf0" stroke-width="1.2"/><circle cx="17" cy="7.4" r="3.6" fill="#e9dcff" stroke="#b9a2ee" stroke-width="1.1"/><circle cx="18" cy="16.8" r="2.3" fill="#ffe0ef" stroke="#f0a0c4" stroke-width="1"/><path d="M6.3 11.4a3 3 0 0 1 2.2-1.8" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round"/>'),
  '🫙': svg('<rect x="6.2" y="2.8" width="11.6" height="3.6" rx="1.4" fill="#ee9f2c"/><path d="M5.8 8.2h12.4v10.6a2.6 2.6 0 0 1-2.6 2.6H8.4a2.6 2.6 0 0 1-2.6-2.6z" fill="#e8f3ff" stroke="#9fb8d6" stroke-width="1.1"/><path d="M6.4 12.6h11.2v6.2a2 2 0 0 1-2 2H8.4a2 2 0 0 1-2-2z" fill="#3cc79a"/>'),
  '😆': svg('<circle cx="12" cy="12" r="9.6" fill="#ffd56a"/><path d="M6.8 9.4l2.4 1.4-2.4 1.4M17.2 9.4l-2.4 1.4 2.4 1.4" stroke="#6b4a2e" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.4 14h9.2a4.6 4.6 0 0 1-9.2 0z" fill="#8a4b3a"/><path d="M9.4 16.6a3 3 0 0 0 5.2 0" fill="#ff8fa8"/>'),
  '🤲': svg(`<path d="M3.6 12.4c0 5 3.8 8.6 8.4 8.6s8.4-3.6 8.4-8.6" stroke="#f5b48e" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="${P.heart}" fill="#f2577f" transform="translate(5.6 2.6) scale(.53)"/>`),
  '👆': svg('<circle cx="12" cy="12" r="3.4" fill="#3cc79a"/><circle cx="12" cy="12" r="6.6" fill="none" stroke="#3cc79a" stroke-width="1.6" opacity=".55"/><circle cx="12" cy="12" r="9.6" fill="none" stroke="#3cc79a" stroke-width="1.2" opacity=".3"/>'),
  '🔮': svg('<circle cx="12" cy="10.4" r="7.4" fill="#c9b2ff"/><circle cx="12" cy="10.4" r="7.4" fill="none" stroke="#9a7ae8" stroke-width="1"/><path d="M8.4 7.6a4.4 4.4 0 0 1 3.2-2" stroke="#f3ecff" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M6.6 17.6h10.8l1.2 3.6H5.4z" fill="#d79a5a"/>'),
  '💫': svg(`<path d="M4.4 12.6a7.6 7.6 0 1 0 6.2-8.2" stroke="#f0a020" stroke-width="2" fill="none" stroke-linecap="round"/><path d="${P.star}" fill="#ffc53d" transform="translate(2.5 1.4) scale(.42)"/>`),
  '🎓': svg('<path d="M12 4.4l10 4.6-10 4.6L2 9z" fill="#5e4a8c"/><path d="M6.4 11.4v4.4c1.4 1.4 3.4 2 5.6 2s4.2-.6 5.6-2v-4.4L12 14z" fill="#7b64ad"/><path d="M20.6 9.6v5.2" stroke="#ffc53d" stroke-width="1.6" stroke-linecap="round"/><circle cx="20.6" cy="15.6" r="1.3" fill="#ffc53d"/>'),
  '🌙': svg(`<path d="M15.6 3.2A8.8 8.8 0 1 0 20.8 16 7.2 7.2 0 0 1 15.6 3.2z" fill="#ffe08a"/><path d="${P.sparkle}" fill="#fff4c4" transform="translate(14.5 3) scale(.32)"/>`),
  '☀️': svg('<circle cx="12" cy="12" r="5" fill="#ffc53d"/><g stroke="#ffb020" stroke-width="2" stroke-linecap="round"><path d="M12 2.4v2.4M12 19.2v2.4M2.4 12h2.4M19.2 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M5.2 18.8l1.7-1.7M17.1 6.9l1.7-1.7"/></g>'),
  '⏳': ICON.hourglass,
  // a trip (ranch life): a little suitcase with a sticker
  '🧳': svg('<path d="M9 6.6V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v1.6" stroke="#8a5a3a" stroke-width="1.7" fill="none"/><rect x="2.8" y="6.4" width="18.4" height="13.8" rx="2.6" fill="#f2aa6a"/><rect x="2.8" y="6.4" width="18.4" height="3.6" rx="1.8" fill="#e38c4c"/><path d="M7.4 6.8v13M16.6 6.8v13" stroke="#b8642e" stroke-width="1.7"/><circle cx="12" cy="14.6" r="2.5" fill="#7fd4c0"/><path d="M10.9 14.7l.8.8 1.5-1.6" stroke="#fff" stroke-width=".9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
};
// ---------- medals (MEDALS in content.js): a ribbon, a metal disc and an emblem; higher medals get gems ----------
let medalN = 0;
const STAR5 = 'M12 9.6l1.5 3.1 3.4.4-2.5 2.3.7 3.3-3.1-1.7-3.1 1.7.7-3.3-2.5-2.3 3.4-.4z';
const GEM = 'M9.2 12.4h5.6l1.9 2.2-4.7 5-4.7-5z';
function medal({ rib = ['#6fa8ff', '#4f86e0'], rim, face, emblem, rays = '' }) {
  const id = 'md' + (++medalN);
  return `<svg class="gi medal" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><defs><radialGradient id="${id}" cx="36%" cy="32%" r="78%"><stop offset="0" stop-color="${face[0]}"/><stop offset="1" stop-color="${face[1]}"/></radialGradient></defs>
    ${rays}<path d="M6.6 1h4.2l2.6 8h-4.2z" fill="${rib[0]}"/><path d="M17.4 1h-4.2l-2.6 8h4.2z" fill="${rib[1]}"/>
    <circle cx="12" cy="15" r="7.6" fill="url(#${id})" stroke="${rim}" stroke-width="1.3"/><circle cx="12" cy="15" r="5.6" fill="none" stroke="${rim}" stroke-width=".6" opacity=".55"/>
    ${emblem}<path d="M7.6 12.4a5 5 0 0 1 3-2.6" stroke="#fff" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".75"/></svg>`;
}
const MEDAL_ART = {
  // the Grown-Up Ribbon: a pink rosette with two tails
  '🎀': () => `<svg class="gi medal" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8.4 13.6l-3 8.6 3-1.2 1.6 2.6 2-8.6zM15.6 13.6l3 8.6-3-1.2-1.6 2.6-2-8.6z" fill="#f25c8a"/>
    <g fill="#ff9cc0">${Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2; return `<circle cx="${(12 + Math.cos(a) * 6).toFixed(2)}" cy="${(10 + Math.sin(a) * 6).toFixed(2)}" r="2.6"/>`; }).join('')}</g>
    <circle cx="12" cy="10" r="6" fill="#ffc2d8"/><circle cx="12" cy="10" r="3.6" fill="#f25c8a"/><path d="${STAR5}" fill="#fff" transform="translate(12 10) scale(.5) translate(-12 -14.4)"/></svg>`,
  '🥉': () => medal({ rim: '#9a5426', face: ['#f6c08c', '#b8692f'], emblem: `<path d="${STAR5}" fill="#fff1df" opacity=".9"/>` }),
  '🥈': () => medal({ rib: ['#ff9cc0', '#f2709c'], rim: '#7f8ba0', face: ['#ffffff', '#a9b4c4'], emblem: `<path d="${STAR5}" fill="#fff" opacity=".95"/>` }),
  '🥇': () => medal({ rib: ['#ff6f7d', '#e04a5c'], rim: '#c88a0e', face: ['#fff4b0', '#f0ae1c'], emblem: `<path d="${STAR5}" fill="#fff9dc"/>` }),
  '💠': () => medal({ rib: ['#b49cff', '#8f74ea'], rim: '#7d8fb4', face: ['#f8fbff', '#c4d1ea'], emblem: `<path d="${P.sparkle}" fill="#8fb8ff" transform="translate(12 15) scale(.42) translate(-12 -12)"/>` }),
  '💚': () => medal({ rib: ['#5fd6a0', '#2fb07a'], rim: '#c88a0e', face: ['#fff4b0', '#f0ae1c'], emblem: `<path d="${GEM}" fill="#2fc47f" stroke="#1b8a58" stroke-width=".6" stroke-linejoin="round"/><path d="M9.2 12.4h5.6l-2.8 7.2z" fill="#7fe8b8" opacity=".7"/>` }),
  '💎': () => medal({ rib: ['#8fd4ff', '#5ab4f0'], rim: '#8aa4c8', face: ['#ffffff', '#cfe6ff'], emblem: `<path d="${GEM}" fill="#bfe8ff" stroke="#5aa8e0" stroke-width=".6" stroke-linejoin="round"/><path d="M9.2 12.4h5.6l-2.8 7.2z" fill="#fff" opacity=".8"/>` }),
  '🌑': () => medal({ rib: ['#7a5cc8', '#4b3690'], rim: '#9a7ae8', face: ['#5a4a80', '#191230'], emblem: `<path d="${GEM}" fill="#b48cff" stroke="#e0ccff" stroke-width=".5" stroke-linejoin="round"/><path d="M9.2 12.4h5.6l-2.8 7.2z" fill="#e6d8ff" opacity=".55"/>` }),
  '🌟': () => medal({ rib: ['#ff9cc0', '#9b7cf0'], rim: '#f0a020', face: ['#fff8d0', '#ff9ec4'],
    rays: `<g fill="#ffd36a" opacity=".85">${Array.from({ length: 8 }, (_, i) => `<path d="M12 4.6l1 3.4h-2z" transform="rotate(${i * 45} 12 15)"/>`).join('')}</g>`,
    emblem: `<path d="${P.sparkle}" fill="#fff" transform="translate(12 15) scale(.5) translate(-12 -12)"/>` }),
};

// ---------- heirlooms (HEIRLOOMS in content.js); the Golden Jar Lid and the Wishing Star reuse the jar and star ----------
const HEIRLOOM_ART = {
  '🧸': svg('<rect x="3" y="10.4" width="18" height="10.4" rx="2" fill="#ffb8c8"/><rect x="3" y="10.4" width="18" height="3.2" rx="1.4" fill="#f590ac"/><circle cx="8.6" cy="7" r="2" fill="#c98a5a"/><circle cx="15.4" cy="7" r="2" fill="#c98a5a"/><circle cx="12" cy="8.4" r="3.8" fill="#d99a68"/><circle cx="10.6" cy="8" r=".6" fill="#3a2a20"/><circle cx="13.4" cy="8" r=".6" fill="#3a2a20"/><circle cx="12" cy="9.6" r=".8" fill="#3a2a20"/><path d="M8 16.6h8" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>'),
  '🍪': svg('<ellipse cx="12" cy="17.6" rx="8.6" ry="3.2" fill="#4f86e0"/><rect x="3.4" y="10.4" width="17.2" height="7.2" fill="#6fa8ff"/><ellipse cx="12" cy="10.4" rx="8.6" ry="3.2" fill="#9cc6ff"/><path d="M5 13.6h14" stroke="#fff" stroke-width="1" stroke-dasharray="1.4 1.4" opacity=".8"/><circle cx="12" cy="8.6" r="3.6" fill="#e0a25e"/><circle cx="10.8" cy="8" r=".6" fill="#6b3f24"/><circle cx="13.2" cy="8.4" r=".55" fill="#6b3f24"/><circle cx="12" cy="9.8" r=".5" fill="#6b3f24"/>'),
  '🍀': svg(`<rect x="3" y="3" width="18" height="18" rx="2" fill="#d9a46b"/><rect x="5.2" y="5.2" width="13.6" height="13.6" rx="1" fill="#fbf4e4"/><g fill="#4fbf62">${[0, 90, 180, 270].map(r => `<path d="M12 12c-2.6-2.6-2-4.4-.6-4.4.4 0 .6.2.6.6 0-.4.2-.6.6-.6 1.4 0 2 1.8-.6 4.4z" transform="rotate(${r} 12 12)"/>`).join('')}</g><path d="M12 12.4q.6 2.6 2.4 4.2" stroke="#3a9a4a" stroke-width=".9" fill="none" stroke-linecap="round"/>`),
  '🏮': svg('<path d="M12 1.4v2.4" stroke="#8a6a50" stroke-width="1.2"/><rect x="9" y="3.6" width="6" height="1.8" rx=".6" fill="#8a4a2e"/><ellipse cx="12" cy="12" rx="6.6" ry="6.8" fill="#ff8a4a"/><path d="M8.6 6.6c-1.4 3-1.4 7.8 0 10.8M15.4 6.6c1.4 3 1.4 7.8 0 10.8M12 5.2v13.6" stroke="#e0632a" stroke-width=".9" fill="none"/><ellipse cx="12" cy="12" rx="3.4" ry="4.4" fill="#ffd36a" opacity=".55"/><rect x="9" y="18.6" width="6" height="1.8" rx=".6" fill="#8a4a2e"/><path d="M12 20.4v2.2" stroke="#ffb020" stroke-width="1.2" stroke-linecap="round"/>'),
  '🧵': svg('<rect x="3" y="3" width="18" height="18" rx="2.4" fill="#fff"/><rect x="3" y="3" width="9" height="9" rx="2" fill="#ffb3cc"/><rect x="12" y="3" width="9" height="9" rx="2" fill="#a8dcff"/><rect x="3" y="12" width="9" height="9" rx="2" fill="#ffe08a"/><rect x="12" y="12" width="9" height="9" rx="2" fill="#b6efc9"/><path d="M12 3.6v16.8M3.6 12h16.8" stroke="#fff" stroke-width="1.2" stroke-dasharray="1.4 1.2"/><path d="M12 9.6c-1.6-1.1-2.2-1.9-2.2-2.7a1.1 1.1 0 0 1 2.2-.3 1.1 1.1 0 0 1 2.2.3c0 .8-.6 1.6-2.2 2.7z" fill="#f2577f" transform="translate(-4.5 0)"/>'),
  '🖼️': svg('<rect x="2.6" y="4" width="18.8" height="16" rx="1.6" fill="#e0b05c"/><rect x="4.8" y="6.2" width="14.4" height="11.6" rx=".8" fill="#fde9f1"/><path d="M7.4 16.6c0-2.6 1.4-4.6 3.2-4.6s3.2 2 3.2 4.6z" fill="#7fe0bf"/><path d="M12.6 16.6c0-2 1.1-3.6 2.4-3.6s2.4 1.6 2.4 3.6z" fill="#ffb3cc"/><circle cx="9.6" cy="14.6" r=".45" fill="#2a1f3d"/><circle cx="11.6" cy="14.6" r=".45" fill="#2a1f3d"/><circle cx="14.4" cy="15" r=".4" fill="#2a1f3d"/><circle cx="15.8" cy="15" r=".4" fill="#2a1f3d"/>'),
  '🗿': svg('<rect x="5" y="17.4" width="14" height="4" rx="1" fill="#c9b8a8"/><rect x="6.6" y="15.4" width="10.8" height="2.4" rx=".8" fill="#ddd0c2"/><path d="M12 4.4c3.8 0 6.4 3.4 6.4 7 0 2.4-1.6 4-3.6 4H9.2c-2 0-3.6-1.6-3.6-4 0-3.6 2.6-7 6.4-7z" fill="#f0b830" stroke="#c88a0e" stroke-width="1"/><path d="M8.6 8.8a3.8 3.8 0 0 1 2.4-2.2" stroke="#fff4b8" stroke-width="1.3" fill="none" stroke-linecap="round"/><circle cx="10.2" cy="11" r=".7" fill="#8a5a0a"/><circle cx="13.8" cy="11" r=".7" fill="#8a5a0a"/><path d="M11 12.8q1 .8 2 0" stroke="#8a5a0a" stroke-width=".8" fill="none" stroke-linecap="round"/>'),
};
Object.assign(MEM, MEDAL_ART, HEIRLOOM_ART);

// memIcon(emoji): the drawing for a Journal / medal / heirloom emoji (a fresh copy for drawings with their own
// gradients), or the fallback for an emoji with no drawing yet.
export const memIcon = (emoji, fallback) => { const v = MEM[emoji]; return typeof v === 'function' ? v() : (v || fallback); };
// The same drawing as a standalone SVG document (for canvas textures such as the medal pin), or null.
export const iconSvgDoc = emoji => { const v = memIcon(emoji, null); return v ? v.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" ') : null; };

// ---------- contests (C1b) ----------
// A cup in a contest's color (CONTESTS color: Beauty pink, Sprint blue, Bounce-Off orange; never a metal, the medals own
// gold, silver and bronze), sized by its tier with the classes cup-1..cup-4 (Little..Champion), a star on the Champion
// Cup. ghost: a cup not won yet (an outline in the text color). Also the coach's whistle, a ribbon bow (Dress up), a
// check mark and a rival's little blob.
const hex2 = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => '#' + hex2(a).map((v, i) => Math.round(v + (hex2(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
const STAR = (cx, cy, r1, r2) => Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? r2 : r1, a = (-90 + i * 36) * Math.PI / 180; return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`; }).join(' ');
export function cupIcon(color, { tier = 1, champion = false, ghost = false } = {}) {
  const base = ghost ? 'currentColor' : color, dark = ghost ? 'currentColor' : mix(color, '#3a1f3a', 0.38), lite = ghost ? 'currentColor' : mix(color, '#ffffff', 0.55);
  const fo = ghost ? ' fill-opacity=".22"' : '', so = ghost ? ' stroke-opacity=".55"' : '';
  const star = champion ? `<polygon points="${STAR(12.6, 9.4, 3.15, 1.37)}" fill="${ghost ? 'currentColor' : mix(color, '#ffffff', 0.85)}"${ghost ? ' fill-opacity=".55"' : ''}/>` : '';
  return `<svg class="gi cup cup-${tier}${ghost ? ' ghost' : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M4.44 4.04A3.57 3.57 0 0 0 4.44 11.18M19.56 4.04A3.57 3.57 0 0 1 19.56 11.18" fill="none" stroke="${dark}" stroke-width="1.6"${so}/>
    <path d="M3.18 4.88A8.82 9.66 0 0 0 20.82 4.88Z" fill="${base}"${fo} stroke="${dark}" stroke-width=".9"${so}/>
    <rect x="2.55" y="3.2" width="18.9" height="2.31" rx="1.05" fill="${lite}"${fo} stroke="${dark}" stroke-width=".9"${so}/>
    <rect x="10.74" y="14.1" width="2.52" height="3.6" fill="${dark}"${ghost ? ' fill-opacity=".55"' : ''}/>
    <rect x="6.75" y="17.48" width="10.5" height="3.36" rx="1.05" fill="${ghost ? 'currentColor' : dark}"${fo} stroke="${dark}" stroke-width=".9"${so}/>
    ${ghost ? '' : `<ellipse cx="6.96" cy="8.66" rx="1.26" ry="2.1" fill="${mix(color, '#ffffff', 0.62)}"/>`}${star}</svg>`;
}
ICON.whistle = svg('<ellipse cx="9" cy="14.2" rx="6.6" ry="6.4" fill="#f2a21b"/><rect x="10.6" y="7.6" width="11.2" height="5.4" rx="1.3" fill="#f2a21b"/><circle cx="8.4" cy="14.8" r="2" fill="#fff" fill-opacity=".8"/><path d="M3.6 9.4l-1.8-2.2" stroke="#c97e0c" stroke-width="1.4" stroke-linecap="round"/>');
ICON.bow = svg('<path d="M11 12.4L7.4 21l3-.6zM13 12.4l3.6 8.6-3-.6z" fill="#e0558f"/><ellipse cx="6.6" cy="10.6" rx="5.6" ry="4.6" fill="#ff79ad" stroke="#e0558f" stroke-width="1.1"/><ellipse cx="17.4" cy="10.6" rx="5.6" ry="4.6" fill="#ff79ad" stroke="#e0558f" stroke-width="1.1"/><ellipse cx="12" cy="11" rx="2.8" ry="2.9" fill="#e0558f"/>');
ICON.check = svg('<path d="M5 12.6l4.4 4.4L19.4 6.8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>', 'gi check');
export function blobIcon(color) {
  const dark = mix(color, '#2c2142', 0.35), lite = mix(color, '#ffffff', 0.6);
  return `<svg class="gi blob" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 4.6c-.9 0-1.6.6-1.8 1.4C5.6 6.6 2.4 10 2.4 14.2c0 3.6 3.6 5.6 9.6 5.6s9.6-2 9.6-5.6c0-4.2-3.4-7.8-8-8.3-.2-.7-.8-1.3-1.6-1.3z" fill="${color}" stroke="${dark}" stroke-width="1"/>
    <ellipse cx="6.4" cy="10.4" rx="2" ry="1.3" fill="${lite}"/><ellipse cx="8.8" cy="13.6" rx="1.2" ry="1.7" fill="#2c2142"/><ellipse cx="15.2" cy="13.6" rx="1.2" ry="1.7" fill="#2c2142"/></svg>`;
}
// the Journal's contest line (a cup won): one cup in all three contests' colors
MEM['🏆'] = svg(`<path d="M4.44 4.04A3.57 3.57 0 0 0 4.44 11.18M19.56 4.04A3.57 3.57 0 0 1 19.56 11.18" fill="none" stroke="#3fa2ff" stroke-width="1.7"/><path d="M3.18 4.88A8.82 9.66 0 0 0 20.82 4.88Z" fill="#ff74b0" stroke="#b8467a" stroke-width=".9"/><rect x="2.55" y="3.2" width="18.9" height="2.31" rx="1.05" fill="#ffc2dc" stroke="#b8467a" stroke-width=".9"/><rect x="10.74" y="14.1" width="2.52" height="3.6" fill="#c9701c"/><rect x="6.75" y="17.48" width="10.5" height="3.36" rx="1.05" fill="#ff9b2f" stroke="#c9701c" stroke-width=".9"/><ellipse cx="6.96" cy="8.66" rx="1.26" ry="2.1" fill="#ffd0e4"/><polygon points="${STAR(12.6, 9.4, 3.15, 1.37)}" fill="#fff4c4"/>`);

// A little slime drawing for the family tree and the spark-form list. motif adds the spark form's mark.
const MOTIF = {
  smore: '<rect x="11.4" y="7" width="13.2" height="3.2" rx="1.2" fill="#7a4a2e"/><rect x="12.2" y=".8" width="11.6" height="6.8" rx="2.6" fill="#fffaf2" stroke="#e8d6bd" stroke-width=".8"/><path d="M12.6 5h10.8" stroke="#f0c69a" stroke-width="1.1"/>',
  honeycomb: '<g fill="none" stroke="#c98a10" stroke-width="1" opacity=".75"><path d="M10.6 14.6l2.2-1.3 2.2 1.3v2.5l-2.2 1.3-2.2-1.3zM15 14.6l2.2-1.3 2.2 1.3v2.5l-2.2 1.3-2.2-1.3zM19.4 14.6l2.2-1.3 2.2 1.3v2.5l-2.2 1.3-2.2-1.3z"/></g><path d="M25.6 10.4c0 2 .8 3 .8 4.2a1 1 0 0 1-2 0c0-1.2.8-2.2 1.2-4.2z" fill="#ffb800"/>',
  campfire: '<path d="M18 .8c2.6 2.6 4 4.6 4 6.8a4 4 0 0 1-8 0c0-1.4.8-2.6 1.6-3.6.2 1.2.8 1.8 1.4 1.8 0-2 .4-3.4 1-5z" fill="#ff8a2a"/><path d="M18 4.2c1.2 1.4 1.8 2.4 1.8 3.4a1.8 1.8 0 0 1-3.6 0c0-1 .8-2 1.8-3.4z" fill="#ffe066"/>',
  storm: '<path d="M10.6 7.2a3.4 3.4 0 0 1 4.6-3.2 4.4 4.4 0 0 1 8.2 1.4 2.9 2.9 0 0 1 .2 5.8H11.4a2.4 2.4 0 0 1-.8-4z" fill="#eef4ff" stroke="#b9c8e8" stroke-width=".8"/><path d="M19 10.4l-2.4 3.6h2.2l-1.6 3.2" stroke="#ffd23f" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
};
let gradN = 0;
// color: one color, or two ([a, b]) for a pair form (split diagonally)
export function slimeArt(color = '#9fe6c6', motif = null, extra = '') {
  const m = motif && MOTIF[motif] ? MOTIF[motif] : '';
  const lift = m ? 3 : 0;
  let defs = '', fill = color;
  if (Array.isArray(color)) {
    if (color.length > 1) {
      const id = 'sg' + (++gradN);
      defs = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset=".5" stop-color="${color[0]}"/><stop offset=".5" stop-color="${color[1]}"/></linearGradient></defs>`;
      fill = `url(#${id})`;
    } else fill = color[0];
  }
  return `<svg class="slime-art${extra}" viewBox="0 0 36 30" aria-hidden="true" focusable="false" style="--c:${fill}">${defs}
    <path d="M18 ${5 + lift}c7.4 0 13 6 13 13.2 0 4.4-3 6.8-7 6.8H12c-4 0-7-2.4-7-6.8C5 ${11 + lift} 10.6 ${5 + lift} 18 ${5 + lift}z" fill="var(--c)"/>
    <path d="M18 ${5 + lift}c7.4 0 13 6 13 13.2 0 4.4-3 6.8-7 6.8H12c-4 0-7-2.4-7-6.8C5 ${11 + lift} 10.6 ${5 + lift} 18 ${5 + lift}z" fill="none" stroke="rgba(60,40,80,.18)" stroke-width="1"/>
    <path d="M10.4 ${12.5 + lift}c1-2.2 3-3.6 5.2-4" stroke="rgba(255,255,255,.75)" stroke-width="2" fill="none" stroke-linecap="round"/>
    ${m}
    <ellipse cx="14.2" cy="${17.4 + lift * 0.4}" rx="1.4" ry="1.8" fill="#2a1f3d"/><ellipse cx="21.8" cy="${17.4 + lift * 0.4}" rx="1.4" ry="1.8" fill="#2a1f3d"/>
    <circle cx="14.6" cy="${16.8 + lift * 0.4}" r=".5" fill="#fff"/><circle cx="22.2" cy="${16.8 + lift * 0.4}" r=".5" fill="#fff"/>
    <ellipse cx="11.6" cy="${20.2 + lift * 0.4}" rx="1.6" ry=".9" fill="#ff7aa8" opacity=".5"/><ellipse cx="24.4" cy="${20.2 + lift * 0.4}" rx="1.6" ry=".9" fill="#ff7aa8" opacity=".5"/>
    <path d="M16.6 ${20.6 + lift * 0.4}q1.4 1.2 2.8 0" stroke="#2a1f3d" stroke-width="1" fill="none" stroke-linecap="round"/>
  </svg>`;
}
// The "not found yet" version: a soft silhouette with a question mark.
export const slimeUnknown = () => `<svg class="slime-art unknown" viewBox="0 0 36 30" aria-hidden="true" focusable="false">
  <path d="M18 5c7.4 0 13 6 13 13.2 0 4.4-3 6.8-7 6.8H12c-4 0-7-2.4-7-6.8C5 11 10.6 5 18 5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 2.4" opacity=".6"/>
  <text x="18" y="21.4" text-anchor="middle" font-size="11" font-weight="800" fill="currentColor" opacity=".7" font-family="system-ui, sans-serif">?</text></svg>`;
