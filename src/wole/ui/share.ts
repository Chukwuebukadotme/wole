// Share card: a picture of the result plus a message and link, sent through the phone's share sheet.

export interface ShareCard {
  /** Small line at the top, e.g. "DAILY SHIFT · 11 OCT". */
  readonly badge: string;
  readonly amount: string;
  readonly amountLabel: string;
  /** Light-hearted driver title. */
  readonly driver: string;
  readonly name: string;
  readonly lines: readonly (readonly [string, string])[];
  readonly cta: string;
  readonly url: string;
}

const DISPLAY = '"Alfa Slab One", Rockwell, Georgia, serif';
const UI = '"Barlow Semi Condensed", "Arial Narrow", Arial, sans-serif';

function fit(g: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, family: string, weight = ''): void {
  let s = size;
  g.font = `${weight} ${s}px ${family}`.trim();
  while (g.measureText(text).width > maxWidth && s > 12) {
    s -= 2;
    g.font = `${weight} ${s}px ${family}`.trim();
  }
}

/** Draw the card (1080 × 1350, the shape WhatsApp and Instagram show best). */
export async function drawShareCard(c: ShareCard): Promise<Blob | null> {
  try {
    await Promise.all([document.fonts.load(`80px ${DISPLAY}`), document.fonts.load(`700 40px ${UI}`)]);
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
  g.fillStyle = '#f6b800';
  g.fillRect(0, 0, W, H);
  // The danfo's black stripes.
  g.fillStyle = '#141414';
  g.fillRect(0, H - 150, W, 34);
  g.fillRect(0, H - 96, W, 18);
  g.fillRect(0, 0, W, 18);
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#141414';
  g.font = `110px ${DISPLAY}`;
  g.fillText('Wole Wole', W / 2, 190);
  g.font = `700 40px ${UI}`;
  g.fillText(c.badge.toUpperCase(), W / 2, 260);

  // Amount panel.
  g.fillStyle = '#141414';
  g.beginPath();
  g.roundRect(90, 310, W - 180, 330, 36);
  g.fill();
  g.fillStyle = '#f6b800';
  fit(g, c.amount, W - 260, 170, DISPLAY);
  g.fillText(c.amount, W / 2, 500);
  g.fillStyle = '#fff8e6';
  g.font = `700 44px ${UI}`;
  g.fillText(c.amountLabel, W / 2, 580);

  g.fillStyle = '#141414';
  fit(g, `“${c.driver}”`, W - 160, 62, DISPLAY);
  g.fillText(`“${c.driver}”`, W / 2, 730);
  if (c.name) {
    g.font = `700 40px ${UI}`;
    g.fillText(`— ${c.name}`, W / 2, 790);
  }

  // Stat rows.
  let y = 860;
  g.font = `700 44px ${UI}`;
  for (const [k, v] of c.lines.slice(0, 4)) {
    g.textAlign = 'left';
    g.fillText(k, 150, y);
    g.textAlign = 'right';
    g.fillText(v, W - 150, y);
    g.fillStyle = 'rgba(20,20,20,0.25)';
    g.fillRect(150, y + 18, W - 300, 3);
    g.fillStyle = '#141414';
    y += 64;
  }
  g.textAlign = 'center';
  fit(g, c.cta, W - 160, 56, DISPLAY);
  g.fillText(c.cta, W / 2, H - 172);
  g.fillStyle = '#f6b800';
  g.font = `700 30px ${UI}`;
  g.fillStyle = '#141414';
  g.fillText(c.url.replace(/^https?:\/\//, '').replace(/\?.*$/, ''), W / 2, H - 30);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

/**
 * Share the card through the system share sheet when the browser supports it.
 * Returns false when there is no share sheet, so the caller can show its own options.
 */
export async function shareNative(card: Blob | null, text: string, url: string): Promise<boolean> {
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  try {
    if (card && nav.share && nav.canShare) {
      const file = new File([card], 'wole-wole.png', { type: 'image/png' });
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], text: `${text} ${url}` });
        return true;
      }
    }
    if (nav.share) {
      await nav.share({ text, url });
      return true;
    }
  } catch (err) {
    // Closing the share sheet is not an error worth showing.
    if (err instanceof DOMException && err.name === 'AbortError') return true;
  }
  return false;
}

export const whatsappLink = (text: string, url: string): string => `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
