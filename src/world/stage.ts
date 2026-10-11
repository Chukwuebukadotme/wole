// Renderer, lights, sky and camera. The world group slides toward the camera as the player drives, so the
// player's vehicle and the camera stay near the origin.
import * as THREE from 'three';
import type { CityId } from '../config/cities.ts';
import { mulberry32 } from '../rules/util.ts';

interface Palette {
  readonly top: number;
  readonly horizon: number;
  readonly fog: number;
  readonly hemiSky: number;
  readonly hemiGround: number;
  readonly sun: number;
}

const PALETTES: Readonly<Record<CityId, Palette>> = {
  london: { top: 0x2f8fe0, horizon: 0xcde7f6, fog: 0xd3e6f1, hemiSky: 0xe4f2ff, hemiGround: 0x8c7d68, sun: 0xfff3df },
  lagos: { top: 0x3399e2, horizon: 0xe3ecee, fog: 0xe2e7e2, hemiSky: 0xfff6e4, hemiGround: 0x8f7a5e, sun: 0xffefd2 },
};
/** Harmattan dust from the Sahara softens Lagos from November to February. */
const HARMATTAN: Palette = { top: 0x7ab0d8, horizon: 0xe9d9b8, fog: 0xe6d6b4, hemiSky: 0xfff0d8, hemiGround: 0x8f7a5e, sun: 0xffe2b8 };

export type Quality = 'high' | 'low';

function cloudTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    const rng = mulberry32(7);
    // Puffy cartoon cloud: overlapping soft circles with a flat, slightly shaded base.
    const puffs = [
      [70, 78, 38],
      [112, 58, 46],
      [160, 66, 40],
      [196, 82, 30],
      [44, 90, 26],
      [130, 88, 40],
    ] as const;
    for (const [x, y, r] of puffs) {
      const grad = g.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.2, x, y, r);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.75, 'rgba(250,252,255,0.98)');
      grad.addColorStop(1, 'rgba(235,242,250,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x + (rng() - 0.5) * 4, y, r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = 'destination-out';
    g.fillRect(0, 108, 256, 20);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.3, 1400);
  /** Everything placed by distance along the road: z = -distance. */
  readonly world = new THREE.Group();
  /** Things that stay with the camera far away: skyline backdrops. */
  readonly far = new THREE.Group();
  readonly fog = new THREE.Fog(0xd3e6f1, 140, 520);
  private readonly hemi = new THREE.HemisphereLight(0xe4f2ff, 0x8c7d68, 1.6);
  private readonly sun = new THREE.DirectionalLight(0xfff3df, 2.4);
  private readonly skyUniforms = { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } };
  private readonly sky: THREE.Mesh;
  private readonly clouds = new THREE.Group();
  quality: Quality;

  constructor(host: HTMLElement) {
    const mobile = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    this.quality = mobile && Math.min(window.screen.width, window.screen.height) < 420 && (navigator.hardwareConcurrency ?? 8) <= 4 ? 'low' : 'high';
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.6 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.id = 'view';
    this.renderer.domElement.setAttribute('aria-label', 'West Road Life game view');
    host.prepend(this.renderer.domElement);

    this.scene.fog = this.fog;
    this.scene.add(this.hemi, this.sun, this.sun.target, this.world, this.far);
    // Soft upper-left sun; shadows only near the player, where they matter.
    this.sun.castShadow = this.quality === 'high';
    const size = 2048;
    this.sun.shadow.mapSize.set(size, size);
    const cam = this.sun.shadow.camera;
    cam.left = -34;
    cam.right = 34;
    cam.top = 60;
    cam.bottom = -40;
    cam.near = 10;
    cam.far = 220;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 3;

    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: [
        'uniform vec3 top;',
        'uniform vec3 horizon;',
        'varying vec3 vDir;',
        'void main() {',
        '  float h = clamp(vDir.y, 0.0, 1.0);',
        '  gl_FragColor = vec4(mix(horizon, top, pow(h, 0.55)), 1.0);',
        '  #include <colorspace_fragment>',
        '}',
      ].join('\n'),
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), skyMat);
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);

    const cloudMat = new THREE.SpriteMaterial({ map: cloudTexture(), fog: false, depthWrite: false, transparent: true });
    const rng = mulberry32(11);
    for (let i = 0; i < 14; i++) {
      const sprite = new THREE.Sprite(cloudMat);
      const w = 120 + rng() * 160;
      sprite.scale.set(w, w * 0.5, 1);
      sprite.position.set((rng() - 0.5) * 1400, 150 + rng() * 170, -500 - rng() * 500);
      this.clouds.add(sprite);
    }
    this.scene.add(this.clouds);
    this.setCity('london', false);
  }

  /** Lighter rendering for slower devices: fewer pixels and no shadows. */
  lighten(): void {
    this.renderer.setPixelRatio(1);
    this.sun.castShadow = false;
    this.renderer.shadowMap.enabled = false;
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      if (m && !Array.isArray(m)) m.needsUpdate = true;
    });
    this.resize();
  }

  /** Sky, fog and light colours for a city. */
  setCity(city: CityId, harmattan: boolean): void {
    const p = city === 'lagos' && harmattan ? HARMATTAN : PALETTES[city];
    this.skyUniforms.top.value.setHex(p.top);
    this.skyUniforms.horizon.value.setHex(p.horizon);
    this.fog.color.setHex(p.fog);
    this.fog.near = harmattan ? 70 : 140;
    this.fog.far = harmattan ? 340 : 520;
    this.hemi.color.setHex(p.hemiSky);
    this.hemi.groundColor.setHex(p.hemiGround);
    this.sun.color.setHex(p.sun);
    this.sun.intensity = harmattan ? 2.0 : 2.4;
  }

  /** Move the world for the player's distance and keep the sun's shadows around them. */
  follow(dist: number, x: number, dt: number): void {
    this.world.position.z = dist;
    this.sun.target.position.set(x, 0, -12);
    this.sun.position.set(x - 50, 90, 30);
    this.sky.position.copy(this.camera.position);
    this.far.position.set(this.camera.position.x, 0, this.camera.position.z);
    this.clouds.position.set(this.camera.position.x * 0.9, 0, this.camera.position.z);
    for (const c of this.clouds.children) {
      c.position.x += dt * 1.5;
      if (c.position.x > 720) c.position.x -= 1440;
    }
  }

  resize(): void {
    const parent = this.renderer.domElement.parentElement;
    const w = parent?.clientWidth || window.innerWidth;
    const h = parent?.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
