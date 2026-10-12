import type * as THREE from 'three';
import { vehicleMaterial, worldMaterial } from './surfaces.ts';

/** Kit colours (West Road Life art language). */
export const C = {
  ink: 0x142b4e,
  inkSoft: 0x24406b,
  cream: 0xfff3d9,
  yellow: 0xffd447,
  red: 0xef4b43,
  bridgeBlue: 0x18b9e4,
  teal: 0x12bcc1,
  violet: 0x7647d8,
  green: 0x609d55,
  leaf: 0x6fb34f,
  leafDark: 0x4d8f3e,
  /** Deep navy glazing. */
  glass: 0x22385f,
  glassLit: 0x2c4a7c,
  tyre: 0x2a2d34,
  hub: 0xfff3d9,
  black: 0x23262d,
  chrome: 0xb6bcc6,
  tail: 0xff3b30,
  lamp: 0xfff1c4,
  plate: 0xffd447,
  white: 0xf7f4ec,
  skin: [0x5a3825, 0x7a4a2c, 0x8d5a36, 0xa86f45, 0xc98e63, 0xe2b48c, 0xf1caa5] as const,
} as const;

/** Smooth painted surfaces: vehicles and street furniture (physical, with clear coat where painted). */
export function satin(): THREE.MeshPhysicalMaterial {
  return vehicleMaterial();
}

/** Brick, stone, roads, leaves and people. */
export function matte(): THREE.MeshStandardMaterial {
  return worldMaterial();
}
