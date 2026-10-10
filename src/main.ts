import { loadCarModels } from './engine/cars.ts';
import { Game } from './game/game.ts';
import { bindInput } from './input.ts';

function fail(message: string): void {
  const el = document.getElementById('loading');
  if (!el) return;
  el.hidden = false;
  el.classList.add('fail');
  const p = el.querySelector('p');
  if (p) p.textContent = message;
}

try {
  const host = document.getElementById('app');
  if (!host) throw new Error('#app is missing from index.html');
  const game = new Game(host);
  game.view.tabIndex = 0;
  bindInput(game.view, {
    playing: () => game.playing(),
    changeOpen: () => game.changeOpen(),
    lane: (dir) => game.laneChange(dir),
    hopOrGo: () => game.hopOrGo(),
    brake: (on) => game.setBrake(on),
    gas: (on) => game.setGas(on),
    horn: (on) => game.horn(on),
    pause: () => game.pauseFromInput(),
    mute: () => game.muteFromInput(),
    giveChange: (value) => game.giveChange(value),
    undoChange: () => game.undoChange(),
  });
  game.start();
  // Traffic uses simple box cars until the 3D models arrive.
  void loadCarModels();
  // Automated play tests read live state through ?debug; normal players never see it.
  if (new URLSearchParams(window.location.search).has('debug')) (window as unknown as { __wole?: Game }).__wole = game;
} catch (err) {
  console.error(err);
  fail('Your browser could not start the 3D graphics. Close some tabs, update your browser, or try another one.');
}
