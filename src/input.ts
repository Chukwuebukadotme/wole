import { DENOMS } from './rules/fare.ts';
import { byId } from './ui/dom.ts';

/** What the game does in response to the player. */
export interface Controls {
  playing(): boolean;
  changeOpen(): boolean;
  lane(dir: -1 | 1): void;
  hopOrGo(): void;
  brake(on: boolean): void;
  horn(on: boolean): void;
  pause(): void;
  mute(): void;
  giveChange(value: number): void;
  undoChange(): void;
}

/** Wire keyboard, swipes and on-screen buttons to the game. */
export function bindInput(view: HTMLCanvasElement, c: Controls): void {
  const markTouch = (): void => document.body.classList.add('touch');
  if (window.matchMedia?.('(pointer: coarse)').matches) markTouch();
  window.addEventListener('touchstart', markTouch, { passive: true, once: true });

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'm' && !e.repeat) {
      c.mute();
      return;
    }
    if (!c.playing()) return;
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault();
    if (k === 'arrowdown' || k === 's' || k === 'shift') {
      c.brake(true);
      return;
    }
    if (e.repeat) return;
    if (c.changeOpen()) {
      const index = Number.parseInt(k, 10) - 1;
      const value = DENOMS[index];
      if (value !== undefined) {
        c.giveChange(value);
        return;
      }
      if (k === 'backspace') {
        e.preventDefault();
        c.undoChange();
        return;
      }
    }
    if (k === 'arrowleft' || k === 'a') c.lane(-1);
    else if (k === 'arrowright' || k === 'd') c.lane(1);
    else if (k === ' ' || k === 'arrowup' || k === 'w') c.hopOrGo();
    else if (k === 'h') c.horn(true);
    else if (k === 'p' || k === 'escape') c.pause();
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'arrowdown' || k === 's' || k === 'shift') c.brake(false);
    if (k === 'h') c.horn(false);
  });
  window.addEventListener('blur', () => {
    c.brake(false);
    c.horn(false);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && c.playing()) c.pause();
  });

  let swipe: { id: number; x: number; y: number; ax: number; flicked: boolean } | null = null;
  view.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') markTouch();
    if (!c.playing()) return;
    swipe = { id: e.pointerId, x: e.clientX, y: e.clientY, ax: e.clientX, flicked: false };
    try {
      view.setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture is optional.
    }
  });
  view.addEventListener('pointermove', (e) => {
    if (!swipe || e.pointerId !== swipe.id) return;
    const dx = e.clientX - swipe.ax;
    const dy = e.clientY - swipe.y;
    if (!swipe.flicked && Math.abs(dy) > 45 && Math.abs(dy) > Math.abs(e.clientX - swipe.x)) {
      swipe.flicked = true;
      if (dy < 0) c.hopOrGo();
      swipe.y = e.clientY;
    }
    if (Math.abs(dx) > 42) {
      c.lane(dx > 0 ? 1 : -1);
      swipe.ax += Math.sign(dx) * 42;
    }
  });
  const endSwipe = (e: PointerEvent): void => {
    if (swipe && e.pointerId === swipe.id) swipe = null;
  };
  view.addEventListener('pointerup', endSwipe);
  view.addEventListener('pointercancel', endSwipe);

  const hold = (el: HTMLElement, on: () => void, off: () => void): void => {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Pointer capture is optional.
      }
      el.classList.add('on');
      on();
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const)
      el.addEventListener(type, () => {
        el.classList.remove('on');
        off();
      });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  };
  hold(byId('b-brake'), () => c.brake(true), () => c.brake(false));
  hold(byId('b-horn'), () => c.horn(true), () => c.horn(false));
  byId('b-hop').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    c.hopOrGo();
  });
  byId('b-pause').addEventListener('click', () => c.pause());
  byId('b-mute').addEventListener('click', () => {
    c.mute();
    view.focus({ preventScroll: true });
  });
}
