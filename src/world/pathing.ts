export const GRID_SIZE = 9;
export const TILE_SIZE = 1.05;

export function tileWorldPos(x: number, z: number): { x: number; z: number } {
  const origin = (GRID_SIZE - 1) / 2;
  return {
    x: (x - origin) * TILE_SIZE,
    z: (z - origin) * TILE_SIZE,
  };
}

export function isAdjacent(
  ax: number,
  az: number,
  bx: number,
  bz: number,
): boolean {
  return Math.abs(ax - bx) + Math.abs(az - bz) === 1;
}

export function inBounds(x: number, z: number): boolean {
  return x >= 0 && z >= 0 && x < GRID_SIZE && z < GRID_SIZE;
}

/** Simple deterministic hash for decor placement. */
export function hash2(x: number, z: number): number {
  let n = x * 374761393 + z * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}
