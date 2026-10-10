/** Required element by id; a missing element is a build error, so fail loudly. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id} in index.html`);
  return el as T;
}

const ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Escape text for use inside HTML templates. */
export const esc = (text: string | number): string => String(text).replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);

/** Set text only when it changed, avoiding layout work every frame. */
export class TextCache {
  private readonly last = new Map<HTMLElement, string>();
  set(el: HTMLElement, text: string): void {
    if (this.last.get(el) === text) return;
    this.last.set(el, text);
    el.textContent = text;
  }
  clear(): void {
    this.last.clear();
  }
}
