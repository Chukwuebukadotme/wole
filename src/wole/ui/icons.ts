import { PAX, type PaxKind } from '../rules/data.ts';

// Small passenger silhouettes (16 × 20) so a glance at the seats shows who is on board.
const HEAD = '<circle cx="8" cy="5" r="2.7"/>';
const BODY = '<path d="M4 19V11.5C4 9.5 5.5 8.6 8 8.6s4 .9 4 2.9V19z"/>';
const EXTRA: Readonly<Record<PaxKind, string>> = {
  regular: '',
  trader: '<ellipse cx="8" cy="1.6" rx="6.2" ry="1.4"/>',
  student: '<rect x="11.2" y="10" width="3.6" height="5.6" rx="1"/>',
  worker: '<rect x="11.4" y="14.2" width="4" height="3.2" rx=".6"/><path d="M7.4 9h1.2l.4 4-1 1.1-1-1.1z" fill="#fff8e6"/>',
  preacher: '<path d="M3 19l1.6-9C5 9 6.2 8.6 8 8.6s3 .4 3.4 1.4L13 19z"/><rect x="11.6" y="11" width="3" height="3.8" rx=".4" fill="#2b1d14"/>',
  baba: '<rect x="5.6" y=".6" width="4.8" height="2.2" rx=".6"/><path d="M14 8.6V19" stroke="currentColor" stroke-width="1.2"/>',
  hawker: '<rect x="1.4" y="0.4" width="13.2" height="1.8" rx=".6"/>',
  guest: '<path d="M3.2 3.4C3.6 .4 12.4 .4 12.8 3.4 11 2.4 5 2.4 3.2 3.4z"/>',
};

/** Inline SVG for a passenger type, filled with its colour; the light outline keeps dark colours visible on dark panels. */
export function paxIcon(kind: PaxKind, size = 13): string {
  const color = PAX[kind].color;
  return `<svg viewBox="0 0 16 20" width="${size}" height="${Math.round(size * 1.25)}" aria-hidden="true" style="color:${color}" fill="currentColor" stroke="rgba(255,248,230,.75)" stroke-width=".7">${EXTRA[kind]}${HEAD}${BODY}</svg>`;
}
