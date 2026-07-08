import * as THREE from 'three';
import type { PlantType } from '../../persist/gardenStore';

export interface PlantHandle {
  group: THREE.Group;
  setGrowth(stage01: number): void;
  update(dt: number, time: number): void;
}

function flatMat(color: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

export function createPlant(type: Exclude<PlantType, null>, seed = 1): PlantHandle {
  switch (type) {
    case 'flower':
      return createFlower(seed);
    case 'tree':
      return createTree(seed);
    case 'grass':
      return createGrass(seed);
    default: {
      const _exhaustive: never = type;
      throw new Error(`Unknown plant type: ${_exhaustive}`);
    }
  }
}

function createFlower(seed: number): PlantHandle {
  const group = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.04, 0.55, 5),
    flatMat(0x4a9c5a),
  );
  stem.position.y = 0.28;
  stem.castShadow = true;
  group.add(stem);

  const petalMat = flatMat(0xf2a0c0 + ((seed * 17) % 40));
  const bloom = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), petalMat);
    const a = (i / 5) * Math.PI * 2;
    petal.position.set(Math.cos(a) * 0.12, 0.55, Math.sin(a) * 0.12);
    petal.scale.set(1, 0.45, 0.7);
    bloom.add(petal);
  }
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 6, 5),
    flatMat(0xf5d76e),
  );
  center.position.y = 0.55;
  bloom.add(center);
  group.add(bloom);

  const leaf = new THREE.Mesh(
    new THREE.ConeGeometry(0.1, 0.18, 4),
    flatMat(0x3d8b4f),
  );
  leaf.rotation.z = 0.9;
  leaf.position.set(0.08, 0.22, 0);
  group.add(leaf);

  return {
    group,
    setGrowth(s) {
      const sprout = Math.min(1, s * 2);
      const open = Math.max(0, (s - 0.45) / 0.55);
      stem.scale.set(1, sprout, 1);
      stem.position.y = 0.28 * sprout;
      bloom.scale.setScalar(0.15 + open * 0.85);
      bloom.visible = s > 0.2;
      leaf.scale.setScalar(sprout);
    },
    update(_dt, time) {
      bloom.rotation.y = Math.sin(time * 0.8 + seed) * 0.08;
      group.rotation.z = Math.sin(time * 1.1 + seed) * 0.04;
    },
  };
}

function createTree(seed: number): PlantHandle {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.09, 0.7, 5),
    flatMat(0x8b5a3c),
  );
  trunk.position.y = 0.35;
  trunk.castShadow = true;
  group.add(trunk);

  const canopyMat = flatMat(0x2f7a45);
  const canopy = new THREE.Group();
  const layers = [
    { y: 0.75, r: 0.42, h: 0.35 },
    { y: 1.0, r: 0.32, h: 0.3 },
    { y: 1.22, r: 0.2, h: 0.25 },
  ];
  for (const L of layers) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(L.r, L.h, 6),
      canopyMat,
    );
    cone.position.y = L.y;
    cone.castShadow = true;
    canopy.add(cone);
  }
  group.add(canopy);

  return {
    group,
    setGrowth(s) {
      const stem = Math.min(1, s * 1.4);
      const cap = Math.max(0, (s - 0.35) / 0.65);
      trunk.scale.set(1, stem, 1);
      trunk.position.y = 0.35 * stem;
      canopy.scale.setScalar(0.2 + cap * 0.8);
      canopy.position.y = (stem - 1) * 0.2;
      canopy.visible = s > 0.25;
    },
    update(_dt, time) {
      canopy.rotation.y = Math.sin(time * 0.5 + seed) * 0.05;
      group.rotation.z = Math.sin(time * 0.7 + seed * 0.3) * 0.03;
    },
  };
}

function createGrass(seed: number): PlantHandle {
  const group = new THREE.Group();
  const blades: THREE.Mesh[] = [];
  const mat = flatMat(0x6bbf6a);
  for (let i = 0; i < 7; i++) {
    const blade = new THREE.Mesh(
      new THREE.ConeGeometry(0.035, 0.35 + (i % 3) * 0.06, 4),
      mat,
    );
    const a = (i / 7) * Math.PI * 2;
    blade.position.set(Math.cos(a) * 0.12, 0.18, Math.sin(a) * 0.12);
    blade.rotation.z = (i - 3) * 0.12;
    blade.castShadow = true;
    group.add(blade);
    blades.push(blade);
  }
  const puff = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 5, 4),
    flatMat(0xe8f0a0),
  );
  puff.position.y = 0.38;
  group.add(puff);

  return {
    group,
    setGrowth(s) {
      const h = Math.min(1, s * 1.2);
      for (const b of blades) {
        b.scale.set(1, h, 1);
        b.position.y = 0.18 * h;
      }
      puff.scale.setScalar(Math.max(0, (s - 0.5) * 2));
      puff.visible = s > 0.5;
    },
    update(_dt, time) {
      group.rotation.z = Math.sin(time * 2.2 + seed) * 0.08;
    },
  };
}
