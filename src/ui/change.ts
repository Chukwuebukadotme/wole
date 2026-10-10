import { DENOMS } from '../rules/fare.ts';
import { money } from '../rules/util.ts';
import { byId } from './dom.ts';

export interface ChangeView {
  readonly who: string;
  readonly fare: number;
  readonly paid: number;
  readonly due: number;
  readonly given: readonly number[];
  readonly timeLeft: number;
  readonly total: number;
}

/** "Give change" panel shown while the bus is parked at a stop. */
export class ChangePanel {
  private readonly root = byId('change');
  private readonly who = byId('ch-who');
  private readonly fare = byId('ch-fare');
  private readonly paid = byId('ch-paid');
  private readonly due = byId('ch-due');
  private readonly given = byId('ch-given');
  private readonly timer = byId('ch-timer');

  constructor(onGive: (value: number) => void, onUndo: () => void) {
    const buttons = byId('ch-buttons');
    buttons.replaceChildren(
      ...DENOMS.map((value, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'denom';
        b.innerHTML = `${money(value)} <kbd>${i + 1}</kbd>`;
        b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          onGive(value);
        });
        return b;
      }),
    );
    const undo = document.createElement('button');
    undo.type = 'button';
    undo.className = 'undo';
    undo.innerHTML = 'Undo <kbd>⌫</kbd>';
    undo.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      onUndo();
    });
    buttons.appendChild(undo);
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  show(v: ChangeView): void {
    this.root.hidden = false;
    this.who.textContent = v.who;
    this.fare.textContent = money(v.fare);
    this.paid.textContent = money(v.paid);
    this.due.textContent = money(v.due);
    this.given.textContent = v.given.length ? `Given: ${v.given.map((g) => money(g)).join(' + ')} = ${money(v.given.reduce((a, b) => a + b, 0))}` : 'Tap the notes to make change';
    this.timer.style.transform = `scaleX(${Math.max(0, v.timeLeft / v.total).toFixed(3)})`;
    this.timer.classList.toggle('low', v.timeLeft < 2.5);
  }

  hide(): void {
    this.root.hidden = true;
  }
}
