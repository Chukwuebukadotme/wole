// Renderer, lights, sky and camera. The world group slides toward the camera as the player drives, so the
// player's vehicle and the camera stay near the origin.
import * as THREE from 'three';
import type { CityId } from '../config/cities.ts';
import { setReflections } from '../art/surfaces.ts';
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
};

export type Quality = 'high' | 'medium' | 'low';

/** What each graphics tier spends. Fog closes in to match the draw distance, so scenery never pops in. */
export const TIERS: Readonly<Record<Quality, { pixels: number; shadow: number; detail: boolean; ahead: number; fogNear: number; fogFar: number }>> = {
  high: { pixels: 2, shadow: 2048, detail: true, ahead: 430, fogNear: 130, fogFar: 470 },
  medium: { pixels: 1.5, shadow: 1024, detail: true, ahead: 380, fogNear: 110, fogFar: 420 },
  low: { pixels: 1, shadow: 0, detail: false, ahead: 300, fogNear: 80, fogFar: 330 },
};

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
  // Sky and ground fill light for everything; vehicles also get reflections from the sky environment map.
  private readonly hemi = new THREE.HemisphereLight(0xe4f2ff, 0x8c7d68, 1.35);
  private readonly sun = new THREE.DirectionalLight(0xfff3df, 2.6);
  /** Sun direction (from the sun towards the ground) and the shadow camera's light-space axes. */
  private readonly sunDir = new THREE.Vector3(50, -90, -42).normalize();
  private readonly lightRight = new THREE.Vector3();
  private readonly lightUp = new THREE.Vector3();
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private readonly skyUniforms = { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } };
  private readonly sky: THREE.Mesh;
  private readonly clouds = new THREE.Group();
  quality: Quality;

  constructor(host: HTMLElement) {
    this.quality = Stage.autoQuality();
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TIERS[this.quality].pixels));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.id = 'view';
    this.renderer.domElement.setAttribute('aria-label', 'West Road Life game view');
    host.prepend(this.renderer.domElement);

    this.scene.fog = this.fog;
    this.scene.add(this.hemi, this.sun, this.sun.target, this.world, this.far);
    // Soft upper-left sun; shadows only near the player, where they matter.
    this.sun.castShadow = TIERS[this.quality].shadow > 0;
    const size = TIERS[this.quality].shadow || 1024;
    this.sun.shadow.mapSize.set(size, size);
    const cam = this.sun.shadow.camera;
    cam.left = -34;
    cam.right = 34;
    cam.top = 48;
    cam.bottom = -48;
    cam.near = 10;
    cam.far = 240;
    this.sun.shadow.bias = -0.00025;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.radius = 2.5;
    this.lightRight.crossVectors(this.sunDir, new THREE.Vector3(0, 1, 0)).normalize();
    this.lightUp.crossVectors(this.lightRight, this.sunDir).normalize();

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

  /** Default tier for this device: high on desktops, medium on phones and tablets. */
  static autoQuality(): Quality {
    const mobile = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const small = Math.min(window.screen.width, window.screen.height) < 420 && (navigator.hardwareConcurrency ?? 8) <= 4;
    return mobile ? (small ? 'low' : 'medium') : 'high';
  }

  /** Switch graphics tier: resolution, shadow map and fog distance. */
  setQuality(q: Quality): void {
    const t = TIERS[q];
    this.quality = q;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.pixels));
    const shadows = t.shadow > 0;
    this.sun.castShadow = shadows;
    if (shadows && this.sun.shadow.mapSize.x !== t.shadow) {
      this.sun.shadow.mapSize.set(t.shadow, t.shadow);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.fog.near = t.fogNear;
    this.fog.far = t.fogFar;
    this.resize();
  }

  /** Sky, fog and light colours for a city. */
  setCity(city: CityId, harmattan = false): void {
    const p = PALETTES[city];
    this.skyUniforms.top.value.setHex(p.top);
    this.skyUniforms.horizon.value.setHex(p.horizon);
    this.fog.color.setHex(p.fog);
    this.fog.near = harmattan ? 70 : TIERS[this.quality].fogNear;
    this.fog.far = harmattan ? 340 : TIERS[this.quality].fogFar;
    this.hemi.color.setHex(p.hemiSky);
    this.hemi.groundColor.setHex(p.hemiGround);
    this.sun.color.setHex(p.sun);
    this.sun.intensity = harmattan ? 2.2 : 2.6;
    this.buildEnvironment(p);
  }

  /**
   * Image-based light from the same sky: a gradient dome, the sun's glow and a warm ground, prefiltered so
   * glass and paint reflect the scene they are in and rough surfaces pick up soft sky light.
   */
  private buildEnvironment(p: Palette): void {
    const envScene = new THREE.Scene();
    const dome = new THREE.Mesh(this.sky.geometry, this.sky.material);
    envScene.add(dome);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9a8c74 }));
    ground.position.y = -40;
    envScene.add(ground);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(70, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(p.sun).multiplyScalar(6) }));
    glow.position.copy(this.sunDir).multiplyScalar(-800);
    envScene.add(glow);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTarget?.dispose();
    this.envTarget = pmrem.fromScene(envScene, 0.035);
    pmrem.dispose();
    ground.geometry.dispose();
    glow.geometry.dispose();
    // Only glossy things (vehicles, glass, painted metal) use it: reflections matter there, and the big rough
    // surfaces (roads, walls) look the same with the cheaper sky fill light at half the cost.
    setReflections(this.envTarget.texture);
  }

  /** Move the world for the player's distance and keep the sun's shadows around them. */
  follow(dist: number, x: number, dt: number): void {
    this.world.position.z = dist;
    // Centre the shadow map just ahead of the player, snapped to whole shadow texels in the world's frame,
    // so shadows of buildings and props do not shimmer as the world slides past.
    const cam = this.sun.shadow.camera;
    const texX = (cam.right - cam.left) / this.sun.shadow.mapSize.x;
    const texY = (cam.top - cam.bottom) / this.sun.shadow.mapSize.y;
    const target = new THREE.Vector3(x, 0, -14 - dist);
    const a = target.dot(this.lightRight);
    const b = target.dot(this.lightUp);
    target.addScaledVector(this.lightRight, Math.round(a / texX) * texX - a);
    target.addScaledVector(this.lightUp, Math.round(b / texY) * texY - b);
    target.z += dist;
    this.sun.target.position.copy(target);
    this.sun.position.copy(target).addScaledVector(this.sunDir, -110);
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
