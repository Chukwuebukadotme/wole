// Small rendered pictures of vehicles for the garage, made with the game's own renderer.
import * as THREE from 'three';
import { satin } from './materials.ts';
import type { Shape } from './kit.ts';

const W = 240;
const H = 170;

export class Thumbnails {
  private readonly cache = new Map<string, string>();
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 120);
  private readonly target = new THREE.WebGLRenderTarget(W, H, { samples: 4 });
  private readonly renderer: THREE.WebGLRenderer;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    const sun = new THREE.DirectionalLight(0xfff3df, 2.6);
    sun.position.set(-6, 10, -6);
    this.scene.add(new THREE.HemisphereLight(0xe4f2ff, 0x8c7d68, 1.9), sun);
  }

  /** PNG data URL of a vehicle from a front three-quarter view; `key` caches it. */
  get(key: string, make: () => Shape): string {
    const hit = this.cache.get(key);
    if (hit) return hit;
    const geo = make().build();
    const mesh = new THREE.Mesh(geo, satin());
    this.scene.add(mesh);
    const box = geo.boundingBox ?? new THREE.Box3();
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const reach = Math.max(size.z * 0.95, size.y * 1.6, size.x * 1.8) * 1.45 + 1.2;
    this.camera.position.set(centre.x - reach * 0.62, centre.y + reach * 0.32, centre.z - reach * 0.78);
    this.camera.lookAt(centre);
    const before = this.renderer.getRenderTarget();
    const clearAlpha = this.renderer.getClearAlpha();
    const tone = this.renderer.toneMapping;
    this.renderer.setRenderTarget(this.target);
    this.renderer.setClearAlpha(0);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    const px = new Uint8Array(W * H * 4);
    this.renderer.readRenderTargetPixels(this.target, 0, 0, W, H, px);
    this.renderer.setRenderTarget(before);
    this.renderer.setClearAlpha(clearAlpha);
    this.renderer.toneMapping = tone;
    this.scene.remove(mesh);
    geo.dispose();
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext('2d');
    if (!g) return '';
    const img = g.createImageData(W, H);
    // The render target holds linear colour, bottom row first: convert to sRGB and flip.
    const srgb = (v: number): number => {
      const c = v / 255;
      return 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
    };
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const from = ((H - 1 - y) * W + x) * 4;
        const to = (y * W + x) * 4;
        img.data[to] = srgb(px[from] ?? 0);
        img.data[to + 1] = srgb(px[from + 1] ?? 0);
        img.data[to + 2] = srgb(px[from + 2] ?? 0);
        img.data[to + 3] = px[from + 3] ?? 0;
      }
    g.putImageData(img, 0, 0);
    const url = canvas.toDataURL('image/png');
    this.cache.set(key, url);
    return url;
  }
}
