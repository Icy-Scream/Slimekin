const LONG = ['', ' thousand', ' million', ' billion', ' trillion', ' quadrillion', ' quintillion', ' sextillion'];
const SHORT = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx'];

function scaled(n, names) {
  const i = Math.min(names.length - 1, Math.floor(Math.log10(n) / 3));
  const v = n / Math.pow(1000, i);
  let s = v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0);
  if (s.includes('.')) s = s.replace(/\.?0+$/, '');
  return s + names[i];
}

// Big readable numbers: "1,234", "12.5 million"
export function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n);
  if (n < 10 && n % 1 !== 0) return n.toFixed(1).replace(/\.0$/, '');
  if (n < 1e6) return Math.floor(n).toLocaleString('en-US');
  return scaled(n, LONG);
}

// Compact numbers for buttons: "950", "12.3K", "4.5M"
export function fmtShort(n) {
  if (!isFinite(n)) return '∞';
  if (n < 10 && n % 1 !== 0) return n.toFixed(1).replace(/\.0$/, '');
  if (n < 1000) return String(Math.floor(n));
  return scaled(n, SHORT);
}

export function fmtRate(n) {
  if (n < 10) return n.toFixed(1).replace(/\.0$/, '');
  return fmtShort(n);
}

export function fmtDuration(sec) {
  sec = Math.max(0, Math.round(sec));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}
