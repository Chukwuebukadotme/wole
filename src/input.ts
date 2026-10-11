// Keyboard, swipes, holding the road, and the on-screen Brake and Gas buttons.
import { byId } from './ui/dom.ts';

export interface Controls {
  /** True while a drive is running and not paused. */
  driving(): boolean;
  lane(dir: -1 | 1): void;
  gas(source: string, on: boolean): void;
  brake(source: string, on: boolean): void;
  pause(): void;
  mute(): void;
  /** Swipe on the scene outside a drive (garage browsing). */
  swipe(dir: -1 | 1): void;
  /** Any first gesture: lets audio start. */
  gesture(): void;
}

export function bindInput(view: HTMLElement, c: Controls): void {
  const markTouch = (): void => document.body.classList.add('touch');
  if (window.matchMedia?.('(pointer: coarse)').matches) markTouch();
  window.addEventListener('touchstart', markTouch, { passive: true, once: true });
  window.addEventListener('pointerdown', () => c.gesture(), { capture: true });
  window.addEventListener('keydown', () => c.gesture(), { capture: true, once: true });

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    const typing = (e.target as HTMLElement | null)?.tagName === 'INPUT';
    if (typing) return;
    if (k === 'm' && !e.repeat) {
      c.mute();
      return;
    }
    if (!c.driving()) return;
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault();
    if (k === 'arrowdown' || k === 's' || k === ' ') c.brake('key', true);
    else if (k === 'arrowup' || k === 'w') c.gas('key', true);
    if (e.repeat) return;
    if (k === 'arrowleft' || k === 'a') c.lane(-1);
    else if (k === 'arrowright' || k === 'd') c.lane(1);
    else if (k === 'p' || k === 'escape') c.pause();
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'arrowdown' || k === 's' || k === ' ') c.brake('key', false);
    if (k === 'arrowup' || k === 'w') c.gas('key', false);
  });
  window.addEventListener('blur', () => {
    c.brake('key', false);
    c.gas('key', false);
    c.gas('road', false);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && c.driving()) c.pause();
  });

  // On the road: a sideways swipe changes lane; a hold without swiping speeds up.
  let touch: { id: number; x: number; y: number; ax: number; swiped: boolean; timer: number } | null = null;
  view.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') markTouch();
    touch = { id: e.pointerId, x: e.clientX, y: e.clientY, ax: e.clientX, swiped: false, timer: 0 };
    try {
      view.setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture is optional.
    }
    if (c.driving()) {
      const t = touch;
      t.timer = window.setTimeout(() => {
        if (touch === t && !t.swiped) c.gas('road', true);
      }, 140);
    }
  });
  view.addEventListener('pointermove', (e) => {
    if (!touch || e.pointerId !== touch.id) return;
    const dx = e.clientX - touch.ax;
    if (Math.abs(dx) > 34 && Math.abs(dx) > Math.abs(e.clientY - touch.y) * 0.8) {
      const dir = dx > 0 ? 1 : -1;
      touch.swiped = true;
      touch.ax += dir * 50;
      if (c.driving()) {
        c.gas('road', false);
        c.lane(dir);
      } else c.swipe(dir);
    }
  });
  const end = (e: PointerEvent): void => {
    if (!touch || e.pointerId !== touch.id) return;
    window.clearTimeout(touch.timer);
    touch = null;
    c.gas('road', false);
  };
  view.addEventListener('pointerup', end);
  view.addEventListener('pointercancel', end);

  const hold = (el: HTMLElement, set: (on: boolean) => void): void => {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Pointer capture is optional.
      }
      el.classList.add('on');
      set(true);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const)
      el.addEventListener(type, () => {
        el.classList.remove('on');
        set(false);
      });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  };
  hold(byId('b-brake'), (on) => c.brake('button', on));
  hold(byId('b-gas'), (on) => c.gas('button', on));
  byId('b-pause').addEventListener('click', () => c.pause());
}
