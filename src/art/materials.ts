import * as THREE from 'three';

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

let satinMat: THREE.MeshStandardMaterial | null = null;
let matteMat: THREE.MeshStandardMaterial | null = null;

/** Smooth painted surfaces: vehicles and street furniture. */
export function satin(): THREE.MeshStandardMaterial {
  satinMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.05 });
  return satinMat;
}

/** Brick, stone, cloth and leaves. */
export function matte(): THREE.MeshStandardMaterial {
  matteMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 });
  return matteMat;
}
