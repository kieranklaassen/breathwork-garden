import { describe, expect, it } from 'vitest';
import {
  defaultGarden,
  loadGarden,
  saveGarden,
  STORAGE_KEY,
} from './gardenStore';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

describe('gardenStore', () => {
  it('defaults to desert with center green', () => {
    const g = defaultGarden(9);
    const center = g.tiles.find((t) => t.x === 4 && t.z === 4);
    expect(center?.terrain).toBe('green');
    expect(g.tiles.filter((t) => t.terrain === 'sand').length).toBe(80);
  });

  it('round-trips through storage', () => {
    const mem = new MemoryStorage();
    const g = defaultGarden(9);
    g.tiles[0].terrain = 'green';
    g.tiles[0].plantType = 'flower';
    g.tiles[0].growthStage = 3;
    saveGarden(g, mem);
    const loaded = loadGarden(mem, 9);
    expect(loaded.tiles[0].plantType).toBe('flower');
    expect(mem.getItem(STORAGE_KEY)).toBeTruthy();
  });

  it('falls back on corrupt JSON', () => {
    const mem = new MemoryStorage();
    mem.setItem(STORAGE_KEY, '{not-json');
    const g = loadGarden(mem, 9);
    expect(g.playerPos).toEqual({ x: 4, z: 4 });
  });

  it('resets on unknown schemaVersion', () => {
    const mem = new MemoryStorage();
    mem.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: 99, tiles: [], playerPos: { x: 0, z: 0 } }),
    );
    const g = loadGarden(mem, 9);
    expect(g.schemaVersion).toBe(1);
    expect(g.tiles.length).toBe(81);
  });

  it('resets when stats missing', () => {
    const mem = new MemoryStorage();
    mem.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        tiles: [{ x: 0, z: 0, terrain: 'sand', plantType: null, growthStage: 0 }],
        playerPos: { x: 0, z: 0 },
      }),
    );
    const g = loadGarden(mem, 9);
    expect(g.stats.sessionsDone).toBe(0);
  });

  it('coerces invalid plantType to null', () => {
    const mem = new MemoryStorage();
    const base = defaultGarden(9);
    base.tiles[0].plantType = 'dragon' as never;
    saveGarden(base, mem);
    const g = loadGarden(mem, 9);
    expect(g.tiles[0].plantType).toBeNull();
  });
});
