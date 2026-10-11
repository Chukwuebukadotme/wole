// Share card: a picture of the drive with the money earned, sent through the phone's share sheet.

export interface ShareCard {
  /** Screenshot of the drive (a data URL), or null. */
  readonly shot: string | null;
  readonly city: string;
  readonly area: string;
  readonly vehicle: string;
  readonly amount: string;
  readonly distance: string;
  readonly stats: readonly string[];
  readonly name: string;
  /** "Daily drive · 11 Oct", or null. */
  readonly badge: string | null;
  readonly url: string;
}

const DISPLAY = '"Exo 2", "Arial Black", sans-serif';
const INK = '#142b4e';
const CREAM = '#fff3d9';
const YELLOW = '#ffd447';
const MUTED = '#48617d';

function fit(g: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, style: string): void {
  let s = size;
  g.font = `${style} ${s}px ${DISPLAY}`;
  while (g.measureText(text).width > maxWidth && s > 14) {
    s -= 2;
    g.font = `${style} ${s}px ${DISPLAY}`;
  }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Draw the card at 1080 × 1350 (the shape social apps show best). */
export async function drawShareCard(c: ShareCard): Promise<HTMLCanvasElement | null> {
  try {
    await Promise.all([document.fonts.load(`italic 800 80px ${DISPLAY}`), document.fonts.load(`600 40px ${DISPLAY}`)]);
  } catch {
    // Fall back to whatever fonts are available.
  }
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  if (!g) return null;
  g.fillStyle = INK;
  g.fillRect(0, 0, W, H);
  // The drive itself, filling the top.
  const shot = c.shot ? await loadImage(c.shot) : null;
  const photoH = 700;
  if (shot) {
    const scale = Math.max(W / shot.width, photoH / shot.height);
    const sw = W / scale;
    const sh = photoH / scale;
    g.drawImage(shot, (shot.width - sw) / 2, (shot.height - sh) * 0.45, sw, sh, 0, 0, W, photoH);
  }
  const fade = g.createLinearGradient(0, 0, 0, 260);
  fade.addColorStop(0, 'rgba(20,43,78,0.7)');
  fade.addColorStop(1, 'rgba(20,43,78,0)');
  g.fillStyle = fade;
  g.fillRect(0, 0, W, 260);
  g.textAlign = 'center';
  g.fillStyle = CREAM;
  g.font = `italic 800 92px ${DISPLAY}`;
  g.fillText('WEST ROAD', W / 2, 120);
  g.fillStyle = YELLOW;
  g.font = `italic 800 110px ${DISPLAY}`;
  g.fillText('LIFE', W / 2, 228);
  if (c.badge) {
    g.font = `600 34px ${DISPLAY}`;
    const bw = g.measureText(c.badge.toUpperCase()).width + 48;
    g.fillStyle = YELLOW;
    g.beginPath();
    g.roundRect((W - bw) / 2, 262, bw, 54, 14);
    g.fill();
    g.fillStyle = INK;
    g.fillText(c.badge.toUpperCase(), W / 2, 300);
  }
  // Cream result card, as in the kit's share screen.
  const top = 600;
  g.fillStyle = INK;
  g.beginPath();
  g.roundRect(54, top + 12, W - 108, H - top - 66, 48);
  g.fill();
  g.fillStyle = CREAM;
  g.beginPath();
  g.roundRect(54, top, W - 108, H - top - 66, 48);
  g.fill();
  g.fillStyle = MUTED;
  fit(g, `${c.city} · ${c.area}`.toUpperCase(), W - 220, 40, '600');
  g.fillText(`${c.city} · ${c.area}`.toUpperCase(), W / 2, top + 80);
  g.fillStyle = INK;
  fit(g, c.amount, W - 220, 150, 'italic 800');
  g.fillText(c.amount, W / 2, top + 240);
  g.fillStyle = MUTED;
  g.font = `600 36px ${DISPLAY}`;
  g.fillText(`EARNED ON ${c.distance.toUpperCase()} IN A ${c.vehicle.toUpperCase()}`, W / 2, top + 304, W - 200);
  g.fillStyle = INK;
  g.font = `600 34px ${DISPLAY}`;
  g.fillText(c.stats.join('  ·  ').toUpperCase(), W / 2, top + 372, W - 200);
  g.fillStyle = YELLOW;
  g.beginPath();
  g.roundRect(150, top + 418, W - 300, 92, 24);
  g.fill();
  g.fillStyle = INK;
  fit(g, 'CAN YOU BEAT MY DRIVE?', W - 360, 50, 'italic 800');
  g.fillText('CAN YOU BEAT MY DRIVE?', W / 2, top + 482);
  g.fillStyle = MUTED;
  g.font = `600 32px ${DISPLAY}`;
  const from = c.name ? `${c.name.toUpperCase()} · ` : '';
  g.fillText(`${from}${c.url.replace(/^https?:\/\//, '').replace(/\?.*$/, '')}`, W / 2, top + 568, W - 200);
  return canvas;
}

export const canvasBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> => new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));

/**
 * Share through the system share sheet when available.
 * Returns 'shared', 'cancelled', or 'unavailable' so the caller can offer saving or copying instead.
 */
export async function shareNative(card: Blob | null, text: string, url: string): Promise<'shared' | 'cancelled' | 'unavailable'> {
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (!nav.share) return 'unavailable';
  try {
    if (card && nav.canShare) {
      const file = new File([card], 'west-road-life.png', { type: 'image/png' });
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], text: `${text} ${url}` });
        return 'shared';
      }
    }
    await nav.share({ text, url });
    return 'shared';
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    return 'unavailable';
  }
}
