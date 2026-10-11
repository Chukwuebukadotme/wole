// Canvas textures: a shared atlas of shop signs and billboards, the danfo sticker and the river.
// Every name and advert is invented for the game.
import * as THREE from 'three';
import type { CityId } from '../config/cities.ts';
import { mulberry32, pick } from '../rules/util.ts';

const LONDON_SHOPS = [
  'THE COFFEE HOUSE',
  'BERMONDSEY BAKERY',
  'NEWS & FOOD',
  'FLOWERS',
  'THE ANCHOR',
  'FISH & CHIPS',
  'TOOLEY BOOKS',
  'CORNER DELI',
  'PHONE REPAIRS',
  'THE LAMB & FLAG',
  'DRY CLEANERS',
  'RIVER CAFE',
  'THE OLD BARGE',
  'BARBERS',
  'WAPPING WINES',
  'TEA ROOMS',
];
const LAGOS_SHOPS = [
  "GOD'S GRACE ELECTRONICS",
  'MAMA PUT · FOOD IS READY',
  'IYA BASIRA PROVISIONS',
  'JESUS IS LORD PHONES',
  'ADUKE FABRICS',
  'OLUWASEUN VULCANISER',
  'BEST CHOICE PHARMACY',
  'MR FIX ELECTRICALS',
  'MUSA SUYA SPOT',
  'GLAMOUR SALOON',
  'KING OF KINGS POS',
  'NO WAHALA BUKA',
  'ABIKE GELE & ASO-OKE',
  'EKO MOBILE ACCESSORIES',
  'DIVINE FAVOUR STORES',
  'CHOP LIFE RESTAURANT',
];
const LONDON_ADS = [
  ['RIVER BUS', 'See the city from the Thames'],
  ['TEA O’CLOCK', 'Proper tea, all day'],
  ['WEST ROAD LIFE', 'Drive it. Share it.'],
  ['MUSEUM OF BUSES', 'Free entry this weekend'],
] as const;
const LAGOS_ADS = [
  ['MAMA’S JOLLOF', 'Party rice, every day'],
  ['WEST ROAD LIFE', 'Oya, drive and share!'],
  ['SUPA MALT', 'Cold one for the go-slow'],
  ['EKO DATA', 'Fast internet, no shakara'],
] as const;

export const SHOP_COLS = 4;
export const SHOP_ROWS = 16;
export const BOARD_COLS = 2;
export const BOARD_ROWS = 4;

/** Cell in a texture atlas: offset and size in UV space. */
export interface Cell {
  readonly u: number;
  readonly v: number;
  readonly du: number;
  readonly dv: number;
}

function fitText(g: CanvasRenderingContext2D, text: string, maxW: number, size: number, font: string): void {
  let s = size;
  g.font = `${s}px ${font}`;
  while (g.measureText(text).width > maxW && s > 12) {
    s -= 2;
    g.font = `${s}px ${font}`;
  }
}

/**
 * Sign atlas for a city: shop fascias in the top half (4 × 16 cells of 512 × 64)
 * and billboards in the bottom half (2 × 4 cells of 1024 × 256).
 */
export function signAtlas(city: CityId): { texture: THREE.CanvasTexture; shop: Cell[]; board: Cell[] } {
  const W = 2048;
  const H = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  const shop: Cell[] = [];
  const board: Cell[] = [];
  const rng = mulberry32(city === 'london' ? 5 : 9);
  if (g) {
    const cw = W / SHOP_COLS;
    const ch = 64;
    const names = city === 'london' ? LONDON_SHOPS : LAGOS_SHOPS;
    for (let r = 0; r < SHOP_ROWS; r++)
      for (let c = 0; c < SHOP_COLS; c++) {
        const x = c * cw;
        const y = r * ch;
        const name = names[(r * SHOP_COLS + c) % names.length] ?? 'SHOP';
        if (city === 'london') {
          const bg = pick([0x1f3a6b, 0x2f4f3a, 0x23262d, 0x7a1f24, 0x2b4a7c], rng);
          g.fillStyle = `#${bg.toString(16).padStart(6, '0')}`;
          g.fillRect(x, y, cw, ch);
          g.strokeStyle = '#e8b847';
          g.lineWidth = 3;
          g.strokeRect(x + 6, y + 6, cw - 12, ch - 12);
          g.fillStyle = '#fff3d9';
          fitText(g, name, cw - 40, 34, 'Georgia, "Times New Roman", serif');
        } else {
          // Hand-painted: bright board, bold letters, a little wobble.
          const bgs = ['#ffd447', '#12bcc1', '#ef4b43', '#2d5bd0', '#2a8a5a', '#fff3d9', '#ef7a2b', '#7647d8'];
          const bg = pick(bgs, rng);
          g.fillStyle = bg;
          g.fillRect(x, y, cw, ch);
          const dark = bg === '#ffd447' || bg === '#fff3d9';
          g.fillStyle = dark ? '#142b4e' : '#fff3d9';
          fitText(g, name, cw - 30, 36, '900 "Arial Black", Impact, sans-serif');
          g.save();
          g.translate(x + cw / 2, y + ch / 2 + 2);
          g.rotate((rng() - 0.5) * 0.03);
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(name, 0, 0);
          g.restore();
          g.fillStyle = dark ? '#ef4b43' : '#ffd447';
          g.fillRect(x + 10, y + ch - 9, cw - 20, 4);
          shop.push({ u: x / W, v: 1 - (y + ch) / H, du: cw / W, dv: ch / H });
          continue;
        }
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(name, x + cw / 2, y + ch / 2 + 2);
        shop.push({ u: x / W, v: 1 - (y + ch) / H, du: cw / W, dv: ch / H });
      }
    const bw = W / BOARD_COLS;
    const bh = 256;
    const ads = city === 'london' ? LONDON_ADS : LAGOS_ADS;
    const top = H / 2;
    for (let r = 0; r < BOARD_ROWS; r++)
      for (let c = 0; c < BOARD_COLS; c++) {
        const x = c * bw;
        const y = top + r * bh;
        const ad = ads[(r * BOARD_COLS + c) % ads.length] ?? ads[0];
        const [bg, fg, accent] = pick(
          [
            ['#ffd447', '#142b4e', '#ef4b43'],
            ['#142b4e', '#fff3d9', '#ffd447'],
            ['#12bcc1', '#142b4e', '#fff3d9'],
            ['#ef4b43', '#fff3d9', '#ffd447'],
          ] as const,
          rng,
        );
        g.fillStyle = bg;
        g.fillRect(x, y, bw, bh);
        g.fillStyle = accent;
        g.beginPath();
        g.arc(x + bw - 130, y + bh / 2, 92, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = fg;
        g.textAlign = 'left';
        g.textBaseline = 'alphabetic';
        fitText(g, ad?.[0] ?? '', bw - 330, 92, 'italic 800 "Exo 2", "Arial Black", sans-serif');
        g.fillText(ad?.[0] ?? '', x + 40, y + 120);
        fitText(g, ad?.[1] ?? '', bw - 330, 46, '600 "Exo 2", Arial, sans-serif');
        g.fillText(ad?.[1] ?? '', x + 44, y + 190);
        board.push({ u: x / W, v: 1 - (y + bh) / H, du: bw / W, dv: bh / H });
      }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, shop, board };
}

/** Rear sticker for the player's danfo. */
export function stickerTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const g = canvas.getContext('2d');
  if (g) {
    g.fillStyle = '#fff3d9';
    g.beginPath();
    g.roundRect(2, 2, 508, 60, 12);
    g.fill();
    g.fillStyle = '#142b4e';
    fitText(g, text, 480, 34, '900 "Arial Black", Impact, sans-serif');
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 256, 34);
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Soft ripples for rivers and lagoons; scrolled slowly while driving. */
export function waterTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  if (g) {
    // Mid-tone water with bright little ripple highlights.
    g.fillStyle = '#c4d6e6';
    g.fillRect(0, 0, 256, 256);
    const rng = mulberry32(3);
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgba(255,255,255,${0.5 + rng() * 0.5})`;
      g.fillRect(rng() * 256, rng() * 256, 8 + rng() * 26, 2);
    }
  }
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(40, 40);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
