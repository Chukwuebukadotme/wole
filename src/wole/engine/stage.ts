import * as THREE from 'three';
import { setSurfaceDetail, vehicleMaterial } from '../../art/surfaces.ts';
import { clamp, lerp, mod } from '../rules/util.ts';
import { night, reflective, setEnvironment, setNightLevel, setReflectionLevel } from './materials.ts';
import { skylineWindowsTexture } from './textures.ts';

export type Quality = 'high' | 'medium' | 'low';

/** Graphics tiers: render resolution and sun-shadow map size (0: contact shadows only, no sky reflections). */
export const TIERS: Readonly<Record<Quality, { pixels: number; shadow: number; reflections: boolean }>> = {
  high: { pixels: 2, shadow: 2048, reflections: true },
  medium: { pixels: 1.25, shadow: 1024, reflections: true },
  low: { pixels: 1, shadow: 0, reflections: false },
};

const SUNRISE = 6;
const SUNSET = 18.8;
const MOON = new THREE.Vector3(-0.35, 0.85, 0.4).normalize();
const sunAt = new THREE.Vector3();

/**
 * Where the sun is (a unit vector from the ground towards it) at a game hour. It rises on the right of the road and
 * sets on the left, always a little behind the camera so the faces you see are lit; the moon stands in at night.
 */
export function sunPosition(hour: number, out: THREE.Vector3): THREE.Vector3 {
  const h = mod(hour, 24);
  const day = clamp((h - SUNRISE) / (SUNSET - SUNRISE), 0, 1);
  const elev = 0.2 + Math.sin(day * Math.PI) * 0.95;
  const across = Math.cos(day * Math.PI) * 0.9 - 0.3;
  const len = Math.hypot(across, 0.55);
  out.set((across / len) * Math.cos(elev), Math.sin(elev), (0.55 / len) * Math.cos(elev));
  // Fade between sun and moon around dawn and dusk, while the light is dim.
  const fromRise = h < 12 ? SUNRISE - h : h - SUNSET;
  return out.lerp(MOON, clamp(fromRise / 0.8 + 0.5, 0, 1)).normalize();
}

interface SkyKey {
  readonly hour: number;
  readonly sky: number;
  readonly fog: number;
  readonly hemiSky: number;
  readonly hemiGround: number;
  readonly hemi: number;
  readonly sunColor: number;
  readonly sun: number;
  readonly dark: number;
}

// Lagos day: warm hazy morning, white noon, gold afternoon, orange dusk, blue night.
const KEYS: readonly SkyKey[] = [
  { hour: 0, sky: 0x0b1026, fog: 0x10162e, hemiSky: 0x2a3b66, hemiGround: 0x101018, hemi: 0.9, sunColor: 0x8899cc, sun: 0.35, dark: 1 },
  { hour: 5.2, sky: 0x1a2142, fog: 0x1d2442, hemiSky: 0x3a4a7a, hemiGround: 0x15151c, hemi: 1.0, sunColor: 0x8899cc, sun: 0.35, dark: 1 },
  { hour: 6.2, sky: 0xf2a07b, fog: 0xe8b08f, hemiSky: 0xffd2b0, hemiGround: 0x5a4a40, hemi: 1.9, sunColor: 0xffb070, sun: 1.3, dark: 0.45 },
  { hour: 7.6, sky: 0xf1d9b0, fog: 0xe9d3a7, hemiSky: 0xfff3d6, hemiGround: 0x6b5a45, hemi: 2.7, sunColor: 0xfff0cf, sun: 2.2, dark: 0 },
  { hour: 12, sky: 0xbfd9ea, fog: 0xd6e2e8, hemiSky: 0xffffff, hemiGround: 0x6b5a45, hemi: 2.9, sunColor: 0xffffff, sun: 2.6, dark: 0 },
  { hour: 16.4, sky: 0xf3d39a, fog: 0xeed6a8, hemiSky: 0xffe9c2, hemiGround: 0x6b5a45, hemi: 2.6, sunColor: 0xffd28a, sun: 2.3, dark: 0 },
  { hour: 18.2, sky: 0xe9765b, fog: 0xc98a72, hemiSky: 0xffb38a, hemiGround: 0x4a3a35, hemi: 1.8, sunColor: 0xff8a50, sun: 1.2, dark: 0.45 },
  { hour: 19.3, sky: 0x141a36, fog: 0x1a2140, hemiSky: 0x34497a, hemiGround: 0x15151c, hemi: 1.0, sunColor: 0x8899cc, sun: 0.4, dark: 1 },
  { hour: 24, sky: 0x0b1026, fog: 0x10162e, hemiSky: 0x2a3b66, hemiGround: 0x101018, hemi: 0.9, sunColor: 0x8899cc, sun: 0.35, dark: 1 },
];

const HAZE = new THREE.Color(0xd9b98a);
const STORM = new THREE.Color(0x5d6670);
const RAIN_DROPS = 700;

export interface Weather {
  /** 0 to 1 rain strength. */
  readonly rain: number;
  /** 0 to 1 harmattan dust. */
  readonly haze: number;
}

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  quality: Quality;
  /** Direction the sunlight travels and the shadow map's axes, for snapping it to whole texels. */
  private readonly sunDir = new THREE.Vector3(0, -1, 0);
  private readonly lightRight = new THREE.Vector3();
  private readonly lightUp = new THREE.Vector3();
  private readonly snap = new THREE.Vector3();
  private envTarget: THREE.WebGLRenderTarget | null = null;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 340);
  readonly fog = new THREE.Fog(0xe9d3a7, 70, 235);
  private readonly hemi = new THREE.HemisphereLight(0xfff3d6, 0x6b5a45, 2.7);
  private readonly sun = new THREE.DirectionalLight(0xfff0cf, 2.2);
  readonly busLight = new THREE.SpotLight(0xfff4d6, 0, 70, 0.5, 0.55, 1.1);
  private readonly rain: THREE.LineSegments;
  private readonly rainPos: Float32Array;
  private readonly rainMat = new THREE.LineBasicMaterial({ color: 0xc3d1dc, transparent: true, opacity: 0 });
  readonly skyline = new THREE.Group();
  private readonly skylineBodies: THREE.MeshBasicMaterial[] = [];
  private readonly skylineDay = new THREE.Color(0x5d6b7a);
  private readonly skylineNight = new THREE.Color(0x141a2e);
  private readonly tmpA = new THREE.Color();
  private readonly tmpB = new THREE.Color();
  darkness = 0;

  constructor(host: HTMLElement, quality: Quality) {
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.id = 'view';
    this.renderer.domElement.setAttribute('aria-label', 'Wole Wole game view');
    host.prepend(this.renderer.domElement);
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(0xf1d9b0);
    this.sun.position.set(-30, 60, 20);
    this.scene.add(this.hemi, this.sun, this.sun.target);
    // Sun shadows cover the road from just behind the bus to well ahead of it.
    const shadowSize = TIERS[quality].shadow;
    this.sun.castShadow = shadowSize > 0;
    this.sun.shadow.mapSize.set(shadowSize || 1024, shadowSize || 1024);
    const cam = this.sun.shadow.camera;
    cam.left = -32;
    cam.right = 32;
    cam.top = 62;
    cam.bottom = -62;
    cam.near = 1;
    cam.far = 320;
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.05;
    this.sun.shadow.radius = 2;
    // Vehicles share one physical material (paint, glass, rubber and chrome per vertex); it has no painted detail here.
    setSurfaceDetail(false);
    reflective(vehicleMaterial());
    this.buildEnvironment();
    setEnvironment(TIERS[quality].reflections ? (this.envTarget?.texture ?? null) : null);
    this.busLight.position.set(0, 1.4, -2.6);
    this.busLight.target.position.set(0, 0, -30);

    this.rainPos = new Float32Array(RAIN_DROPS * 6);
    for (let i = 0; i < RAIN_DROPS; i++) this.respawnDrop(i, Math.random() * 18);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.LineSegments(geo, this.rainMat);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.scene.add(this.rain);

    this.buildSkyline();
    this.scene.add(this.skyline);
    this.skyline.visible = false;
  }

  private respawnDrop(i: number, y: number): void {
    const x = (Math.random() - 0.5) * 44;
    const z = -Math.random() * 60 + 8;
    const p = this.rainPos;
    p.set([x, y, z, x + 0.05, y + 0.7, z - 0.25], i * 6);
  }

  private buildSkyline(): void {
    const windows = skylineWindowsTexture();
    const n = night();
    for (let i = 0; i < 22; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const w = 10 + Math.random() * 16;
      const h = 20 + Math.random() * 60;
      const bodyMat = new THREE.MeshBasicMaterial({ color: 0x5d6b7a, fog: true });
      this.skylineBodies.push(bodyMat);
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, 10), bodyMat);
      body.position.set(side * (70 + Math.random() * 140), h / 2 - 8, -230 - Math.random() * 70);
      const lit = new THREE.MeshBasicMaterial({ map: windows, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      n.skyline.push(lit);
      const front = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, h * 0.9), lit);
      front.position.set(0, 0, 5.05);
      body.add(front);
      this.skyline.add(body);
    }
  }

  /** First guess at a tier: phones start on Medium (small, low-core phones on Low), computers on High. */
  static autoQuality(): Quality {
    const mobile = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const small = Math.min(window.screen.width, window.screen.height) < 420 && (navigator.hardwareConcurrency ?? 8) <= 4;
    return mobile ? (small ? 'low' : 'medium') : 'high';
  }

  private pixelRatio(): number {
    const mobile = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    return Math.min(window.devicePixelRatio || 1, TIERS[this.quality].pixels, mobile ? 1.5 : 2);
  }

  /** Switch graphics tier: resolution, sun shadows and reflections. */
  setQuality(q: Quality): void {
    if (q === this.quality) return;
    this.quality = q;
    const t = TIERS[q];
    this.renderer.setPixelRatio(this.pixelRatio());
    this.sun.castShadow = t.shadow > 0;
    if (t.shadow > 0 && this.sun.shadow.mapSize.x !== t.shadow) {
      this.sun.shadow.mapSize.set(t.shadow, t.shadow);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    setEnvironment(t.reflections ? (this.envTarget?.texture ?? null) : null);
    this.resize();
  }

  /** A soft sky for paint and glass to reflect: blue overhead, warm haze at the horizon, dusty ground below. */
  private buildEnvironment(): void {
    const scene = new THREE.Scene();
    const geo = new THREE.SphereGeometry(100, 24, 12);
    const pos = geo.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const top = new THREE.Color(0xa9cbe6);
    const horizon = new THREE.Color(0xf1e2c0);
    const ground = new THREE.Color(0x7d6e5a);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 100;
      if (y >= 0) c.lerpColors(horizon, top, Math.pow(y, 0.6));
      else c.lerpColors(horizon, ground, Math.min(1, -y * 4));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
    scene.add(dome);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTarget = pmrem.fromScene(scene, 0.04);
    pmrem.dispose();
    geo.dispose();
    (dome.material as THREE.Material).dispose();
  }

  /** Keep the sun's shadow map around the bus, snapped to whole shadow texels in the road's own frame. */
  follow(dist: number, x: number): void {
    const cam = this.sun.shadow.camera;
    const texX = (cam.right - cam.left) / this.sun.shadow.mapSize.x;
    const texY = (cam.top - cam.bottom) / this.sun.shadow.mapSize.y;
    // In the road's frame z is −distance; snapping there keeps shadows of buildings and stalls still as they pass.
    const t = this.snap.set(x * 0.6, 0, -dist - 34);
    const a = t.dot(this.lightRight);
    const b = t.dot(this.lightUp);
    t.addScaledVector(this.lightRight, Math.round(a / texX) * texX - a);
    t.addScaledVector(this.lightUp, Math.round(b / texY) * texY - b);
    t.z += dist;
    this.sun.target.position.copy(t);
    this.sun.position.copy(t).addScaledVector(this.sunDir, -160);
  }

  resize(): void {
    const parent = this.renderer.domElement.parentElement;
    const w = parent?.clientWidth || window.innerWidth;
    const h = parent?.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Set sky, fog and lights for a game hour and weather. */
  setSky(hour: number, weather: Weather, onBridge: boolean): void {
    const hr = mod(hour, 24);
    let a = KEYS[0];
    let b = KEYS[1];
    for (let i = 0; i < KEYS.length - 1; i++) {
      const k0 = KEYS[i];
      const k1 = KEYS[i + 1];
      if (k0 && k1 && hr >= k0.hour && hr <= k1.hour) {
        a = k0;
        b = k1;
        break;
      }
    }
    if (!a || !b) return;
    const t = clamp((hr - a.hour) / Math.max(0.0001, b.hour - a.hour), 0, 1);
    const mix = (x: number, y: number, target: THREE.Color): THREE.Color => target.lerpColors(this.tmpA.setHex(x), this.tmpB.setHex(y), t);
    const bg = this.scene.background as THREE.Color;
    mix(a.sky, b.sky, bg);
    mix(a.fog, b.fog, this.fog.color);
    mix(a.hemiSky, b.hemiSky, this.hemi.color);
    mix(a.hemiGround, b.hemiGround, this.hemi.groundColor);
    mix(a.sunColor, b.sunColor, this.sun.color);
    let hemiI = lerp(a.hemi, b.hemi, t);
    let sunI = lerp(a.sun, b.sun, t);
    this.darkness = lerp(a.dark, b.dark, t);

    let near = 70;
    let far = onBridge ? 280 : 235;
    if (weather.haze > 0) {
      const day = 1 - this.darkness;
      this.fog.color.lerp(HAZE, weather.haze * 0.55 * day);
      bg.lerp(HAZE, weather.haze * 0.6 * day);
      near = lerp(near, 18, weather.haze);
      far = lerp(far, 115, weather.haze);
      sunI *= 1 - weather.haze * 0.35;
    }
    if (weather.rain > 0) {
      this.fog.color.lerp(STORM, weather.rain * 0.5);
      bg.lerp(STORM, weather.rain * 0.55);
      hemiI *= 1 - weather.rain * 0.3;
      sunI *= 1 - weather.rain * 0.6;
      far = lerp(far, 150, weather.rain);
      near = lerp(near, 30, weather.rain);
      this.darkness = Math.max(this.darkness, weather.rain * 0.35);
    }
    this.fog.near = near;
    this.fog.far = far;
    // By day, less sky fill and more direct sun: open ground stays about as bright, while shade and shadows read.
    const day = 1 - this.darkness;
    this.hemi.intensity = hemiI * (1 - 0.32 * day);
    this.sun.intensity = sunI * (1 + 0.4 * day);
    sunPosition(hr, sunAt);
    this.sunDir.copy(sunAt).negate();
    this.lightRight.crossVectors(this.sunDir, THREE.Object3D.DEFAULT_UP).normalize();
    this.lightUp.crossVectors(this.lightRight, this.sunDir).normalize();
    // Paint and glass reflect the sky by day; at night only a faint sheen is left.
    setReflectionLevel(0.75 * (1 - this.darkness * 0.85) * (1 - weather.rain * 0.3));
    this.busLight.intensity = this.darkness * 60;
    setNightLevel(this.darkness);
    this.skyline.visible = onBridge;
    if (onBridge) for (const m of this.skylineBodies) m.color.lerpColors(this.skylineDay, this.skylineNight, this.darkness);
    this.rain.visible = weather.rain > 0.02;
    this.rainMat.opacity = weather.rain * 0.55;
  }

  /** Move rain with the camera; heavier rain falls faster. */
  updateRain(dt: number, speed: number, rain: number): void {
    if (rain <= 0.02) return;
    const p = this.rainPos;
    const fall = (20 + rain * 8) * dt;
    const rush = speed * dt;
    for (let i = 0; i < RAIN_DROPS; i++) {
      const o = i * 6;
      const y = (p[o + 1] ?? 0) - fall;
      const z = (p[o + 2] ?? 0) + rush;
      if (y < 0 || z > 10) this.respawnDrop(i, 16 + Math.random() * 4);
      else {
        p[o + 1] = y;
        p[o + 4] = y + 0.7;
        p[o + 2] = z;
        p[o + 5] = z - 0.25;
      }
    }
    this.rain.position.set(this.camera.position.x, 0, 0);
    (this.rain.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
