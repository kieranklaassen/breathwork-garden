import * as THREE from 'three';
import type { GardenSave, PlantType, TileSave } from '../persist/gardenStore';
import { createPlant, type PlantHandle } from './plants/PlantFactory';
import { GRID_SIZE, hash2, TILE_SIZE, tileWorldPos } from './pathing';

const SAND = 0xe6c089;
const SAND2 = 0xd9b078;
const GREEN = 0x7cbc6a;
const GREEN2 = 0x6aad5c;

interface TileRuntime {
  mesh: THREE.Mesh;
  data: TileSave;
  plant: PlantHandle | null;
  decor: THREE.Object3D[];
}

export class TileGrid {
  readonly group = new THREE.Group();
  private tiles = new Map<string, TileRuntime>();
  private sandMat: THREE.MeshLambertMaterial;
  private greenMat: THREE.MeshLambertMaterial;
  private growing = new Map<string, { plant: PlantHandle; t: number; duration: number; onDone: () => void }>();

  constructor() {
    this.sandMat = new THREE.MeshLambertMaterial({
      color: SAND,
      flatShading: true,
    });
    this.greenMat = new THREE.MeshLambertMaterial({
      color: GREEN,
      flatShading: true,
    });
  }

  key(x: number, z: number): string {
    return `${x},${z}`;
  }

  buildFromSave(save: GardenSave): void {
    while (this.group.children.length) {
      this.group.remove(this.group.children[0]);
    }
    this.tiles.clear();
    this.growing.clear();

    for (const data of save.tiles) {
      this.spawnTile(data);
    }
  }

  private spawnTile(data: TileSave): void {
    const { x, z } = tileWorldPos(data.x, data.z);
    const h = 0.18 + hash2(data.x, data.z) * 0.04;
    const geo = new THREE.BoxGeometry(TILE_SIZE * 0.96, h, TILE_SIZE * 0.96);
    const mat = (data.terrain === 'green' ? this.greenMat : this.sandMat).clone();
    if (data.terrain === 'sand') {
      mat.color.setHex(hash2(data.x + 1, data.z) > 0.5 ? SAND : SAND2);
    } else {
      mat.color.setHex(hash2(data.x, data.z + 3) > 0.5 ? GREEN : GREEN2);
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, h / 2, z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.userData.gridX = data.x;
    mesh.userData.gridZ = data.z;
    this.group.add(mesh);

    const decor: THREE.Object3D[] = [];
    if (data.terrain === 'sand') {
      this.addDesertDecor(data.x, data.z, x, z, h, decor);
    } else if (!data.plantType) {
      this.addGrassTufts(x, z, h, decor, data.x + data.z);
    }

    let plant: PlantHandle | null = null;
    if (data.plantType) {
      plant = createPlant(data.plantType, data.x * 10 + data.z);
      plant.group.position.set(x, h, z);
      plant.setGrowth(Math.max(0.15, data.growthStage / 3));
      this.group.add(plant.group);
    }

    this.tiles.set(this.key(data.x, data.z), { mesh, data: { ...data }, plant, decor });
  }

  private addDesertDecor(
    gx: number,
    gz: number,
    x: number,
    z: number,
    h: number,
    decor: THREE.Object3D[],
  ): void {
    const r = hash2(gx, gz);
    if (r > 0.82) {
      const cactus = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({
        color: 0x5a9e5e,
        flatShading: true,
      });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.45, 6), mat);
      body.position.y = 0.22;
      body.castShadow = true;
      cactus.add(body);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 5), mat);
      arm.position.set(0.12, 0.28, 0);
      arm.rotation.z = -0.7;
      cactus.add(arm);
      cactus.position.set(x + 0.25, h, z - 0.2);
      this.group.add(cactus);
      decor.push(cactus);
    } else if (r > 0.65) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.1 + r * 0.08, 0),
        new THREE.MeshLambertMaterial({ color: 0xc4b49a, flatShading: true }),
      );
      rock.position.set(x - 0.28, h + 0.06, z + 0.22);
      rock.castShadow = true;
      this.group.add(rock);
      decor.push(rock);
    } else if (r > 0.45) {
      const pebble = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 5, 4),
        new THREE.MeshLambertMaterial({ color: 0xd2c2a8, flatShading: true }),
      );
      pebble.position.set(x + 0.3, h + 0.03, z + 0.15);
      this.group.add(pebble);
      decor.push(pebble);
    }
  }

  private addGrassTufts(
    x: number,
    z: number,
    h: number,
    decor: THREE.Object3D[],
    seed: number,
  ): void {
    const mat = new THREE.MeshLambertMaterial({
      color: 0x5aaa58,
      flatShading: true,
    });
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.16, 4), mat);
      blade.position.set(
        x + ((seed + i * 3) % 7) * 0.04 - 0.12,
        h + 0.08,
        z + ((seed + i * 5) % 5) * 0.05 - 0.1,
      );
      this.group.add(blade);
      decor.push(blade);
    }
  }

  getTileMeshes(): THREE.Mesh[] {
    return [...this.tiles.values()].map((t) => t.mesh);
  }

  getTile(x: number, z: number): TileRuntime | undefined {
    return this.tiles.get(this.key(x, z));
  }

  greenRatio(): number {
    if (this.tiles.size === 0) return 0;
    let green = 0;
    for (const t of this.tiles.values()) {
      if (t.data.terrain === 'green') green += 1;
    }
    return green / this.tiles.size;
  }

  exportTiles(): TileSave[] {
    return [...this.tiles.values()].map((t) => ({ ...t.data }));
  }

  /**
   * Grow plant with animation. Calls onDone when growth finishes (persist point).
   */
  growPlant(
    x: number,
    z: number,
    plantType: Exclude<PlantType, null>,
    techniqueId: string,
    onDone: () => void,
  ): void {
    const tile = this.getTile(x, z);
    if (!tile) {
      onDone();
      return;
    }

    for (const d of tile.decor) {
      this.group.remove(d);
    }
    tile.decor = [];

    if (tile.plant) {
      this.group.remove(tile.plant.group);
      tile.plant = null;
    }

    tile.data.terrain = 'green';
    tile.data.plantType = plantType;
    tile.data.growthStage = 0;
    tile.data.lastTechnique = techniqueId as TileSave['lastTechnique'];
    (tile.mesh.material as THREE.MeshLambertMaterial).color.setHex(GREEN);

    const { x: wx, z: wz } = tileWorldPos(x, z);
    const tileH = (tile.mesh.geometry as THREE.BoxGeometry).parameters.height;
    const plant = createPlant(plantType, x * 10 + z);
    plant.group.position.set(wx, tile.mesh.position.y + tileH / 2, wz);
    plant.setGrowth(0);
    this.group.add(plant.group);
    tile.plant = plant;

    this.growing.set(this.key(x, z), {
      plant,
      t: 0,
      duration: 1.6,
      onDone: () => {
        tile.data.growthStage = 3;
        plant.setGrowth(1);
        onDone();
      },
    });
  }

  update(dt: number, time: number): void {
    for (const [key, g] of this.growing) {
      g.t += dt;
      const s = Math.min(1, g.t / g.duration);
      // sprout → stem → bloom curve (slow sprout, faster bloom)
      const curved =
        s < 0.35 ? (s / 0.35) * 0.15 : 0.15 + ((s - 0.35) / 0.65) * 0.85;
      g.plant.setGrowth(curved);
      g.plant.update(dt, time);
      if (s >= 1) {
        g.onDone();
        this.growing.delete(key);
      }
    }
    for (const tile of this.tiles.values()) {
      if (tile.plant && !this.growing.has(this.key(tile.data.x, tile.data.z))) {
        tile.plant.update(dt, time);
      }
    }
  }
}

export { GRID_SIZE };
