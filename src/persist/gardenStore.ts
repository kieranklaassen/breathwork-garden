import type { TechniqueId } from '../breath/types';

export const STORAGE_KEY = 'breathwork-garden-v1';
export const SCHEMA_VERSION = 1;

export type Terrain = 'sand' | 'green';
export type PlantType = 'tree' | 'flower' | 'grass' | null;

export interface TileSave {
  x: number;
  z: number;
  terrain: Terrain;
  plantType: PlantType;
  growthStage: number;
  lastTechnique?: TechniqueId;
}

export interface GardenSave {
  schemaVersion: number;
  tiles: TileSave[];
  playerPos: { x: number; z: number };
  stats: {
    sessionsDone: number;
    tilesGreened: number;
    bestHoldMs: number;
  };
}

export function defaultGarden(gridSize = 9): GardenSave {
  const center = Math.floor(gridSize / 2);
  const tiles: TileSave[] = [];
  for (let z = 0; z < gridSize; z++) {
    for (let x = 0; x < gridSize; x++) {
      const isCenter = x === center && z === center;
      tiles.push({
        x,
        z,
        terrain: isCenter ? 'green' : 'sand',
        plantType: null,
        growthStage: 0,
      });
    }
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    tiles,
    playerPos: { x: center, z: center },
    stats: { sessionsDone: 0, tilesGreened: 1, bestHoldMs: 0 },
  };
}

const PLANT_TYPES = new Set(['tree', 'flower', 'grass']);

function sanitizePlantType(value: unknown): PlantType {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && PLANT_TYPES.has(value)) {
    return value as Exclude<PlantType, null>;
  }
  return null;
}

export function loadGarden(
  storage: Storage = localStorage,
  gridSize = 9,
): GardenSave {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return defaultGarden(gridSize);
    const parsed = JSON.parse(raw) as GardenSave;
    if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION) {
      // Unknown schema: reset safely rather than migrate mid-prototype.
      return defaultGarden(gridSize);
    }
    if (!Array.isArray(parsed.tiles) || parsed.tiles.length === 0 || !parsed.playerPos) {
      return defaultGarden(gridSize);
    }
    if (
      !parsed.stats ||
      typeof parsed.stats.sessionsDone !== 'number' ||
      typeof parsed.stats.tilesGreened !== 'number' ||
      typeof parsed.stats.bestHoldMs !== 'number'
    ) {
      return defaultGarden(gridSize);
    }
    if (
      !Number.isFinite(parsed.playerPos.x) ||
      !Number.isFinite(parsed.playerPos.z)
    ) {
      return defaultGarden(gridSize);
    }
    parsed.tiles = parsed.tiles.map((t) => ({
      ...t,
      plantType: sanitizePlantType(t.plantType),
      terrain: t.terrain === 'green' ? 'green' : 'sand',
    }));
    return parsed;
  } catch {
    return defaultGarden(gridSize);
  }
}

export function saveGarden(data: GardenSave, storage: Storage = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function plantTypeForTechnique(id: TechniqueId): Exclude<PlantType, null> {
  switch (id) {
    case 'wimHof':
      return 'tree';
    case 'coherence':
      return 'flower';
    case 'energizing':
      return 'grass';
  }
}
