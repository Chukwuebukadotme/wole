// Entry point. ?gallery and ?street open development views; ?debug exposes the app to automated tests.
import { App } from './app.ts';
import { bindInput } from './input.ts';
import { decodeChallenge, isWoleChallenge } from './rules/social.ts';

const host = document.getElementById('app');
const params = new URLSearchParams(window.location.search);

/** The kit's recovery screen, shown when the 3D view cannot start. */
function recovery(): void {
  const loading = document.getElementById('loading');
  if (loading) loading.hidden = true;
  const screens = document.getElementById('screens');
  if (!screens) return;
  screens.innerHTML = `<section class="screen dim" role="alertdialog" aria-label="Could not load">
    <div class="overlay-card">
      <h2 class="disp">Could not load</h2>
      <p class="muted">The city did not finish loading.<br>Close other tabs or update your browser, then retry.</p>
      <button type="button" class="btn disp" id="retry">Retry</button>
      <a class="linkbtn" href="./" style="color:inherit;text-align:center">Back to home</a>
    </div>
  </section>`;
  document.getElementById('retry')?.addEventListener('click', () => window.location.reload());
}

// Development views are left out of production builds.
// Wole Wole (Lagos) used to live here: send its old challenge links on to /lagos/.
if (isWoleChallenge(params.get('c'))) window.location.replace(new URL(`lagos/?c=${params.get('c') ?? ''}`, document.baseURI).href);
else if (host && import.meta.env.DEV && params.has('gallery')) void import('./dev/gallery.ts').then((m) => m.startGallery(host));
else if (host && import.meta.env.DEV && params.has('street')) void import('./dev/streetview.ts').then((m) => m.startStreetView(host));
else if (host) {
  try {
    const app = new App(host);
    bindInput(app.stage.renderer.domElement, app.controls);
    if (params.has('debug')) (window as unknown as { __wrl?: App }).__wrl = app;
    app.boot(decodeChallenge(params.get('c'))).catch((err: unknown) => {
      console.error(err);
      recovery();
    });
  } catch (err) {
    console.error(err);
    recovery();
  }
}
