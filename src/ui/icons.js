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
};
export const memIcon = (emoji, fallback) => MEM[emoji] || fallback;

// A little slime drawing for the family tree and the spark-form list. motif adds the spark form's mark.
const MOTIF = {
  smore: '<rect x="11.5" y="1.6" width="13" height="7.6" rx="2.6" fill="#fffaf2" stroke="#e8d6bd" stroke-width=".8"/><path d="M11.8 6.4h12.4" stroke="#f0c69a" stroke-width="1.2"/><rect x="6.8" y="16.6" width="22.4" height="3.6" rx="1.6" fill="#7a4a2e" opacity=".85"/>',
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
