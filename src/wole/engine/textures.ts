import * as THREE from 'three';
import { LANE_W, LANES, ROAD_W } from '../rules/data.ts';
import { mulberry32, type Rng } from '../rules/util.ts';

export const FONT_BLOCK = '"Arial Black", Impact, "Helvetica Neue", sans-serif';
export const FONT_PLAIN = 'Arial, "Helvetica Neue", sans-serif';
type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void;

/** Draw on a fresh canvas and wrap it as an sRGB texture. */
export function canvasTexture(width: number, height: number, draw: Draw, repeat?: [number, number]): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('2D canvas is unavailable');
  draw(g, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
  }
  return texture;
}

/** Shrink a font until `text` fits `maxWidth`. */
export function fitFont(g: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, weight = '900', family = FONT_BLOCK): void {
  let s = size;
  g.font = `${weight} ${s}px ${family}`;
  while (g.measureText(text).width > maxWidth && s > 8) {
    s -= 1;
    g.font = `${weight} ${s}px ${family}`;
  }
}

function speckle(g: CanvasRenderingContext2D, w: number, h: number, count: number, rng: Rng, light = 0.05, dark = 0.09): void {
  for (let i = 0; i < count; i++) {
    g.fillStyle = rng() < 0.5 ? `rgba(255,255,255,${light})` : `rgba(0,0,0,${dark})`;
    g.fillRect(rng() * w, rng() * h, 2, 2);
  }
}

// ---------- Road surfaces (one canvas = one 10 m period along the road) ----------
export function roadTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 256, (g, w, h) => {
    const rng = mulberry32(11);
    g.fillStyle = '#3a3a3d';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 1800, rng);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.fillRect(rng() * w, rng() * h, 30 + rng() * 60, 4 + rng() * 6);
    }
    const px = (x: number): number => (x / ROAD_W + 0.5) * w;
    g.fillStyle = '#ebe5d4';
    for (let i = 1; i < LANES; i++) g.fillRect(px(-ROAD_W / 2 + i * LANE_W) - 3, 0, 6, h * 0.5);
    g.fillRect(5, 0, 6, h);
    g.fillRect(w - 11, 0, 6, h);
  }, [1, 3]);
}

export function brtLaneTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 1024, (g, w, h) => {
    g.fillStyle = 'rgba(176,58,46,0.55)';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f4f1e8';
    g.textAlign = 'center';
    g.font = `900 46px ${FONT_BLOCK}`;
    g.fillText('BRT', w / 2, h * 0.45);
    g.font = `900 30px ${FONT_BLOCK}`;
    g.fillText('ONLY', w / 2, h * 0.45 + 40);
  });
}

export function pavementTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (g, w, h) => {
    const rng = mulberry32(5);
    g.fillStyle = '#bdb19b';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 500, rng, 0.04, 0.07);
    g.fillStyle = 'rgba(0,0,0,0.16)';
    for (let i = 0; i < 4; i++) {
      g.fillRect(0, (i * h) / 4, w, 2);
      g.fillRect((i * w) / 4, 0, 2, h);
    }
  }, [1, 6]);
}

export function kerbTexture(): THREE.CanvasTexture {
  return canvasTexture(16, 64, (g, w, h) => {
    g.fillStyle = '#f2efe6';
    g.fillRect(0, 0, w, h / 2);
    g.fillStyle = '#1d1d1f';
    g.fillRect(0, h / 2, w, h / 2);
  }, [1, 15]);
}

export function grassTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 128, (g, w, h) => {
    const rng = mulberry32(8);
    g.fillStyle = '#5f8a3a';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = rng() < 0.5 ? 'rgba(40,70,20,0.35)' : 'rgba(150,180,80,0.25)';
      g.fillRect(rng() * w, rng() * h, 2, 3);
    }
  }, [2, 4]);
}

export function groundTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 128, (g, w, h) => {
    const rng = mulberry32(9);
    g.fillStyle = '#9c7650';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 900, rng, 0.06, 0.1);
  }, [20, 4]);
}

export function waterTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 128, (g, w, h) => {
    const rng = mulberry32(4);
    g.fillStyle = '#2f6f86';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(220,240,245,${0.12 + rng() * 0.2})`;
      g.fillRect(rng() * w, rng() * h, 10 + rng() * 22, 2);
    }
  }, [30, 3]);
}

export function railingTexture(): THREE.CanvasTexture {
  return canvasTexture(64, 64, (g, w, h) => {
    const rng = mulberry32(6);
    g.fillStyle = '#c9c4b8';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 160, rng, 0.05, 0.12);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, 0, 2, h);
  }, [10, 1]);
}

// ---------- Small signs and markings ----------
export const barrierTexture = (): THREE.CanvasTexture =>
  canvasTexture(128, 64, (g, w, h) => {
    g.fillStyle = '#fafafa';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f46036';
    for (let x = -h; x < w; x += 32) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + 16, 0);
      g.lineTo(x + 16 + h, h);
      g.lineTo(x + h, h);
      g.fill();
    }
  });

export const noteTexture = (): THREE.CanvasTexture =>
  canvasTexture(128, 64, (g, w, h) => {
    g.fillStyle = '#3f8f4f';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c9e7b8';
    g.lineWidth = 5;
    g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `900 34px ${FONT_BLOCK}`;
    g.fillText('₦20', w / 2, h / 2 + 2);
  });

export function bayTexture(color: string, words: [string, string], pump = false): THREE.CanvasTexture {
  return canvasTexture(256, 1024, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = color;
    g.lineWidth = 14;
    g.strokeRect(8, 8, w - 16, h - 16);
    g.lineWidth = 8;
    g.globalAlpha = 0.7;
    for (let y = -w; y < h - 170; y += 64) {
      g.beginPath();
      g.moveTo(16, y);
      g.lineTo(w - 16, y + w - 32);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.fillStyle = color;
    g.textAlign = 'center';
    g.font = `900 62px ${FONT_BLOCK}`;
    g.fillText(words[0], w / 2, h - 100);
    g.fillText(words[1], w / 2, h - 32);
    if (pump) {
      // Fuel pump pictogram, so the bay does not rely on colour alone.
      const x = w / 2 - 46;
      const y = h - 330;
      g.fillRect(x, y, 70, 120);
      g.fillRect(x - 8, y + 112, 86, 16);
      g.clearRect(x + 12, y + 14, 46, 34);
      g.lineWidth = 10;
      g.strokeStyle = color;
      g.beginPath();
      g.moveTo(x + 70, y + 30);
      g.lineTo(x + 92, y + 30);
      g.lineTo(x + 92, y + 96);
      g.stroke();
    }
  });
}

export function plateTexture(top: string, name: string, bg = '#0c5a3a'): THREE.CanvasTexture {
  return canvasTexture(512, 176, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 8;
    g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.font = `700 30px ${FONT_PLAIN}`;
    g.fillText(top, w / 2, 52);
    fitFont(g, name.toUpperCase(), w - 50, 76);
    g.fillText(name.toUpperCase(), w / 2, 138);
  });
}

export const stopLineTexture = (): THREE.CanvasTexture =>
  canvasTexture(256, 32, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#f4f1e8';
    g.fillRect(0, 4, w, h - 8);
  });

/** Soft dark blob that sits under a vehicle so it looks planted on the road. */
export const shadowTexture = (): THREE.CanvasTexture =>
  canvasTexture(128, 128, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(0,0,0,0.75)');
    grad.addColorStop(0.55, 'rgba(0,0,0,0.45)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });

export const lightPoolTexture = (): THREE.CanvasTexture =>
  canvasTexture(128, 128, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,214,150,0.9)');
    grad.addColorStop(0.5, 'rgba(255,190,110,0.35)');
    grad.addColorStop(1, 'rgba(255,190,110,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });

export function stickerTexture(text: string): THREE.CanvasTexture {
  return canvasTexture(512, 96, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#141414';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    fitFont(g, text, w - 24, 54);
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

export const buntingTexture = (): THREE.CanvasTexture =>
  canvasTexture(512, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#333';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, 6);
    g.quadraticCurveTo(w / 2, 26, w, 6);
    g.stroke();
    for (let i = 0; i < 16; i++) {
      const x = 8 + i * 31;
      const y = 8 + Math.sin((i / 15) * Math.PI) * 16;
      g.fillStyle = i % 2 === 0 ? '#008751' : '#ffffff';
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 22, y);
      g.lineTo(x + 11, y + 28);
      g.fill();
    }
  });

export const tollSignTexture = (): THREE.CanvasTexture =>
  canvasTexture(1024, 96, (g, w, h) => {
    g.fillStyle = '#16365c';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `900 52px ${FONT_BLOCK}`;
    g.fillText('LEKKI TOLL GATE · SLOW DOWN · ₦200', w / 2, h / 2 + 2);
  });

/** Chequered race banner with a word in the middle, e.g. "START" or "FINISH". */
export function raceBannerTexture(word: string): THREE.CanvasTexture {
  return canvasTexture(1024, 128, (g, w, h) => {
    const sq = 32;
    for (let x = 0; x < w; x += sq) for (let y = 0; y < h; y += sq) {
      g.fillStyle = (x / sq + y / sq) % 2 === 0 ? '#141414' : '#f4f1e8';
      g.fillRect(x, y, sq, sq);
    }
    g.fillStyle = '#f6b800';
    g.fillRect(w * 0.3, 12, w * 0.4, h - 24);
    g.fillStyle = '#141414';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    fitFont(g, word, w * 0.36, 78);
    g.fillText(word, w / 2, h / 2 + 4);
  });
}

/** Floating name tag: the name on a pill in the driver's colour. */
export function nameTagTexture(name: string, color: string): THREE.CanvasTexture {
  return canvasTexture(256, 72, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = color;
    g.strokeStyle = '#141414';
    g.lineWidth = 6;
    g.beginPath();
    g.roundRect(4, 4, w - 8, h - 22, 22);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(w / 2 - 12, h - 19);
    g.lineTo(w / 2 + 12, h - 19);
    g.lineTo(w / 2, h - 4);
    g.closePath();
    g.fillStyle = '#141414';
    g.fill();
    const c = new THREE.Color(color);
    g.fillStyle = c.r * 0.3 + c.g * 0.59 + c.b * 0.11 > 0.55 ? '#141414' : '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    fitFont(g, name.toUpperCase(), w - 40, 34);
    g.fillText(name.toUpperCase(), w / 2, (h - 18) / 2 + 3);
  });
}

/** Two rows of black and white squares for a start or finish line on the road. */
export const chequerTexture = (): THREE.CanvasTexture =>
  canvasTexture(512, 32, (g, w, h) => {
    const sq = h / 2;
    for (let x = 0; x < w; x += sq) for (let y = 0; y < h; y += sq) {
      g.fillStyle = (x / sq + y / sq) % 2 === 0 ? '#141414' : '#f4f1e8';
      g.fillRect(x, y, sq, sq);
    }
  });

export const cameraSignTexture = (): THREE.CanvasTexture =>
  canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = '#f2efe6';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b03a2e';
    g.lineWidth = 10;
    g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#141414';
    g.textAlign = 'center';
    g.font = `900 34px ${FONT_BLOCK}`;
    g.fillText('BRT LANE', w / 2, 52);
    g.font = `700 26px ${FONT_PLAIN}`;
    g.fillText('CAMERA ENFORCED', w / 2, 92);
  });

export function stationSignTexture(price: number): THREE.CanvasTexture {
  return canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = '#0f5c4d';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f6b800';
    g.fillRect(0, 0, w, 70);
    g.fillStyle = '#141414';
    g.textAlign = 'center';
    g.font = `900 46px ${FONT_BLOCK}`;
    g.fillText('MAINLAND OIL', w / 2, 52);
    g.fillStyle = '#ffffff';
    g.font = `700 34px ${FONT_PLAIN}`;
    g.fillText('PMS per litre', w / 2, 130);
    g.font = `900 72px ${FONT_BLOCK}`;
    g.fillText(`₦${price}`, w / 2, 215);
  });
}

// ---------- Billboards (fictional brands only) ----------
const BILLBOARDS: readonly [string, string, string, string][] = [
  ['COLD ZOBO', 'Sweet like home', '#7a1f3d', '#ffe9a8'],
  ['SHARP SHARP DATA', '5GB for small money', '#203a72', '#f6b800'],
  ['DRIVE SAFE', 'Your family dey wait for you', '#0f5c4d', '#ffffff'],
  ['AUNTY BISI EVENTS', 'Owambe planners · Lekki & Mainland', '#f46036', '#ffffff'],
  ['LAGOS NO DEY CARRY LAST', 'Hustle with your chest', '#141414', '#f6b800'],
];
export function billboardTextures(): THREE.CanvasTexture[] {
  return BILLBOARDS.map(([title, sub, bg, fg]) =>
    canvasTexture(512, 256, (g, w, h) => {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      g.fillStyle = fg;
      g.textAlign = 'center';
      fitFont(g, title, w - 40, 64);
      g.fillText(title, w / 2, h * 0.48);
      g.font = `600 30px ${FONT_PLAIN}`;
      g.fillText(sub, w / 2, h * 0.78);
    }),
  );
}

// ---------- Building facades ----------
export interface FacadeVariant {
  readonly id: string;
  readonly len: number;
  readonly height: number;
  readonly wall: number;
  readonly awning: boolean;
  readonly map: THREE.CanvasTexture;
  readonly glow: THREE.CanvasTexture;
}

const PX = 32; // canvas pixels per metre
type Painter = (g: CanvasRenderingContext2D, glow: CanvasRenderingContext2D, w: number, h: number, rng: Rng) => void;

function blankCanvas(w: number, h: number): { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('2D canvas is unavailable');
  return { canvas, g };
}

function wrapCanvas(canvas: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function facade(id: string, len: number, height: number, wallCss: string, wall: number, awning: boolean, paint: Painter): FacadeVariant {
  const w = Math.round(len * PX);
  const h = Math.round(height * PX);
  const base = blankCanvas(w, h);
  const light = blankCanvas(w, h);
  light.g.fillStyle = '#000000';
  light.g.fillRect(0, 0, w, h);
  base.g.fillStyle = wallCss;
  base.g.fillRect(0, 0, w, h);
  speckle(base.g, w, h, Math.floor((w * h) / 90), mulberry32(id.length * 31 + w), 0.04, 0.06);
  paint(base.g, light.g, w, h, mulberry32(w + h + id.length));
  return { id, len, height, wall, awning, map: wrapCanvas(base.canvas, true), glow: wrapCanvas(light.canvas, true) };
}

const windowAt = (g: CanvasRenderingContext2D, glow: CanvasRenderingContext2D, x: number, y: number, ww: number, wh: number, lit: boolean): void => {
  g.fillStyle = '#2b3a44';
  g.fillRect(x, y, ww, wh);
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = 2;
  g.strokeRect(x, y, ww, wh);
  g.beginPath();
  g.moveTo(x + ww / 2, y);
  g.lineTo(x + ww / 2, y + wh);
  g.stroke();
  if (lit) {
    glow.fillStyle = '#ffcf7a';
    glow.fillRect(x + 2, y + 2, ww - 4, wh - 4);
  }
};

const signBand = (g: CanvasRenderingContext2D, glow: CanvasRenderingContext2D, y: number, w: number, bh: number, title: string, sub: string, bg: string, fg: string): void => {
  g.fillStyle = bg;
  g.fillRect(10, y, w - 20, bh);
  g.strokeStyle = fg;
  g.lineWidth = 3;
  g.strokeRect(14, y + 4, w - 28, bh - 8);
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fitFont(g, title, w - 50, bh * 0.5);
  g.fillText(title, w / 2, y + bh * 0.42);
  g.font = `600 ${Math.round(bh * 0.2)}px ${FONT_PLAIN}`;
  g.fillText(sub, w / 2, y + bh * 0.8);
  glow.fillStyle = 'rgba(255,255,255,0.55)';
  glow.fillRect(10, y, w - 20, bh);
};

const shopOpening = (g: CanvasRenderingContext2D, glow: CanvasRenderingContext2D, x: number, y: number, ow: number, oh: number, rng: Rng): void => {
  g.fillStyle = '#2b2420';
  g.fillRect(x, y, ow, oh);
  for (let i = 0; i < 14; i++) {
    g.fillStyle = ['#d7263d', '#1b998b', '#f2c14e', '#3c91e6', '#f46036'][i % 5] ?? '#ccc';
    g.fillRect(x + 6 + rng() * (ow - 30), y + oh * 0.35 + rng() * oh * 0.5, 10 + rng() * 14, 8 + rng() * 10);
  }
  glow.fillStyle = 'rgba(255,200,120,0.7)';
  glow.fillRect(x, y, ow, oh);
};

const SHOPS: readonly [string, string, string, string][] = [
  ['IYA BASIRA KITCHEN', 'Rice · Stew · Pepper soup', '#0f5c4d', '#f7f2e4'],
  ['MR FIX ELECTRICALS', 'Fans · Sockets · Wiring', '#203a72', '#f4f4f4'],
  ['OLUWASEUN VULCANISER', 'Tyre & tube · 24 hours', '#f2a900', '#1a1a1a'],
  ['ADUKE FABRICS', 'Ankara · Lace · Aso-oke', '#7a1f3d', '#ffe9a8'],
  ["KING'S PHONE PLAZA", 'Repairs · Chargers', '#e8e2d4', '#8a1c1c'],
  ['MUMMY CHINEDU PROVISIONS', 'Sachet water · Bread · Milo', '#2b2b2b', '#ffd166'],
  ['ALHAJI MUSA SUYA SPOT', 'Fresh every evening', '#7b3f00', '#ffe9a8'],
  ['DE-BOSS PRINTING PRESS', 'Banners · Cards · Flyers', '#1b998b', '#ffffff'],
];

export function facadeVariants(): FacadeVariant[] {
  const out: FacadeVariant[] = [];
  SHOPS.forEach(([title, sub, bg, fg], i) => {
    if (i % 2 === 0) {
      out.push(
        facade(`shop2-${i}`, 9, 7, '#e3d5b8', 0xe3d5b8, true, (g, glow, w, h, rng) => {
          shopOpening(g, glow, 24, h - 3 * PX, w - 48, 3 * PX - 6, rng);
          signBand(g, glow, h - 4.3 * PX, w, 1.1 * PX, title, sub, bg, fg);
          windowAt(g, glow, 40, 18, 2 * PX, 1.6 * PX, rng() < 0.7);
          windowAt(g, glow, w - 40 - 2 * PX, 18, 2 * PX, 1.6 * PX, rng() < 0.7);
        }),
      );
    } else {
      out.push(
        facade(`shop1-${i}`, 8, 4.6, '#cfd8c2', 0xcfd8c2, true, (g, glow, w, h, rng) => {
          shopOpening(g, glow, 18, h - 2.8 * PX, w - 36, 2.8 * PX - 4, rng);
          signBand(g, glow, 4, w, 1.5 * PX, title, sub, bg, fg);
        }),
      );
    }
  });
  out.push(
    facade('flats', 10, 10, '#d9a87c', 0xd9a87c, false, (g, glow, w, h, rng) => {
      for (let floor = 0; floor < 3; floor++) {
        const y = 14 + floor * 3.1 * PX;
        for (let k = 0; k < 3; k++) windowAt(g, glow, 22 + k * 3.2 * PX, y, 1.8 * PX, 1.5 * PX, rng() < 0.6);
        g.fillStyle = '#6b5a45';
        g.fillRect(10, y + 1.7 * PX, w - 20, 6);
        for (let c = 0; c < 8; c++) {
          g.fillStyle = ['#d7263d', '#f2c14e', '#3c91e6', '#fafafa', '#9b5de5'][Math.floor(rng() * 5)] ?? '#fff';
          g.fillRect(16 + rng() * (w - 40), y + 1.7 * PX + 6, 12, 18);
        }
      }
      g.fillStyle = '#4a3b30';
      g.fillRect(w / 2 - 22, h - 2.4 * PX, 44, 2.4 * PX);
    }),
  );
  out.push(
    facade('office', 10, 15, '#7fa6c3', 0x7fa6c3, false, (g, glow, w, h, rng) => {
      for (let y = 10; y < h - 2.6 * PX; y += 1.6 * PX)
        for (let x = 10; x < w - 10; x += 2 * PX) {
          g.fillStyle = 'rgba(30,60,90,0.55)';
          g.fillRect(x, y, 2 * PX - 6, 1.6 * PX - 6);
          if (rng() < 0.45) {
            glow.fillStyle = '#ffe2a8';
            glow.fillRect(x, y, 2 * PX - 6, 1.6 * PX - 6);
          }
        }
      g.fillStyle = '#26333d';
      g.fillRect(w / 2 - 50, h - 2.5 * PX, 100, 2.5 * PX);
      g.fillStyle = '#ffffff';
      g.textAlign = 'center';
      g.font = `900 22px ${FONT_BLOCK}`;
      g.fillText('ADEYEMI TOWERS', w / 2, h - 2.7 * PX);
    }),
  );
  out.push(
    facade('church', 10, 9, '#f2efe6', 0xf2efe6, false, (g, glow, w, h) => {
      g.fillStyle = '#5b3a29';
      g.beginPath();
      g.moveTo(w / 2 - 34, h);
      g.lineTo(w / 2 - 34, h - 2.6 * PX);
      g.quadraticCurveTo(w / 2, h - 4 * PX, w / 2 + 34, h - 2.6 * PX);
      g.lineTo(w / 2 + 34, h);
      g.fill();
      g.fillStyle = '#3c91e6';
      g.beginPath();
      g.arc(w / 2, h - 5.6 * PX, 0.9 * PX, 0, Math.PI * 2);
      g.fill();
      glow.fillStyle = '#9fd0ff';
      glow.beginPath();
      glow.arc(w / 2, h - 5.6 * PX, 0.9 * PX, 0, Math.PI * 2);
      glow.fill();
      g.fillStyle = '#141414';
      g.fillRect(w / 2 - 4, 6, 8, 46);
      g.fillRect(w / 2 - 18, 18, 36, 8);
      g.textAlign = 'center';
      g.font = `900 20px ${FONT_BLOCK}`;
      g.fillText('MOUNTAIN OF GRACE ASSEMBLY', w / 2, h - 7.4 * PX);
      g.font = `600 16px ${FONT_PLAIN}`;
      g.fillText('Night vigil every Friday', w / 2, h - 6.9 * PX);
    }),
  );
  out.push(
    facade('wall', 10, 3.2, '#d9d2c0', 0xd9d2c0, false, (g, _glow, w, h) => {
      g.fillStyle = '#2f3a38';
      g.fillRect(w - 3.2 * PX, h - 2.6 * PX, 2.6 * PX, 2.6 * PX);
      g.fillStyle = '#b03a2e';
      g.font = `900 22px ${FONT_BLOCK}`;
      g.textAlign = 'left';
      g.fillText('POST NO BILL', 14, 40);
      g.fillText('THIS HOUSE IS NOT FOR SALE', 14, 76);
      g.font = `700 14px ${FONT_PLAIN}`;
      g.fillText('BEWARE OF 419', 14, 96);
    }),
  );
  out.push(
    facade('salon', 8, 5, '#f3c6d3', 0xf3c6d3, true, (g, glow, w, h, rng) => {
      shopOpening(g, glow, 18, h - 2.8 * PX, w - 36, 2.8 * PX - 4, rng);
      g.fillStyle = '#ffffff';
      g.fillRect(10, 6, w - 20, 1.6 * PX);
      for (let i = 0; i < 4; i++) {
        const cx = 40 + i * 52;
        g.fillStyle = '#6b4428';
        g.beginPath();
        g.arc(cx, 34, 13, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#141414';
        g.fillRect(cx - 15, 14 + (i % 2) * 4, 30, 10 + i * 2);
      }
      g.fillStyle = '#7a1f3d';
      g.textAlign = 'center';
      g.font = `900 20px ${FONT_BLOCK}`;
      g.fillText('TOP GLAMOUR SALOON', w / 2, 6 + 1.6 * PX - 6);
    }),
  );
  out.push(
    facade('pharmacy', 8, 5, '#e9f2ea', 0xe9f2ea, true, (g, glow, w, h, rng) => {
      shopOpening(g, glow, 18, h - 2.8 * PX, w - 36, 2.8 * PX - 4, rng);
      g.fillStyle = '#0b7a3e';
      g.fillRect(w / 2 - 12, 8, 24, 52);
      g.fillRect(w / 2 - 26, 22, 52, 24);
      glow.fillStyle = '#7dffb0';
      glow.fillRect(w / 2 - 12, 8, 24, 52);
      glow.fillRect(w / 2 - 26, 22, 52, 24);
      g.fillStyle = '#0b7a3e';
      g.textAlign = 'center';
      g.font = `900 16px ${FONT_BLOCK}`;
      g.fillText('BEST CHOICE PHARMACY', w / 2, 72);
    }),
  );
  return out;
}

// ---------- Distant skyline for the bridge ----------
export const skylineWindowsTexture = (): THREE.CanvasTexture =>
  canvasTexture(64, 128, (g, w, h) => {
    g.fillStyle = '#000000';
    g.fillRect(0, 0, w, h);
    const rng = mulberry32(21);
    for (let y = 4; y < h; y += 8)
      for (let x = 4; x < w; x += 8)
        if (rng() < 0.35) {
          g.fillStyle = '#ffd38a';
          g.fillRect(x, y, 4, 4);
        }
  }, [1, 1]);
