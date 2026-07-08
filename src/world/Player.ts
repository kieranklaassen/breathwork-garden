import * as THREE from 'three';

export type PlayerPose = 'idle' | 'walk' | 'sit';

export class Player {
  readonly group = new THREE.Group();
  private body: THREE.Group;
  private torso: THREE.Mesh;
  private head: THREE.Mesh;
  private leftLeg: THREE.Mesh;
  private rightLeg: THREE.Mesh;
  private leftArm: THREE.Mesh;
  private rightArm: THREE.Mesh;
  private aura: THREE.Mesh;
  private shadow: THREE.Mesh;

  pose: PlayerPose = 'idle';
  gridX = 0;
  gridZ = 0;
  private walkFrom = new THREE.Vector3();
  private walkTarget = new THREE.Vector3();
  private walkT = 1;
  private walkDuration = 0.55;
  private sitT = 1;
  private breathFill = 0.35;
  private onArrive: (() => void) | null = null;
  private onSitDone: (() => void) | null = null;
  private footstepCb: (() => void) | null = null;
  private lastFoot = 0;

  constructor() {
    this.body = new THREE.Group();
    this.group.add(this.body);

    const skin = new THREE.MeshLambertMaterial({
      color: 0xe8b896,
      flatShading: true,
    });
    const cloth = new THREE.MeshLambertMaterial({
      color: 0xd4784a,
      flatShading: true,
    });
    const hair = new THREE.MeshLambertMaterial({
      color: 0x5c3a2a,
      flatShading: true,
    });

    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.18), cloth);
    this.torso.position.y = 0.42;
    this.torso.castShadow = true;
    this.body.add(this.torso);

    this.head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), skin);
    this.head.position.y = 0.68;
    this.head.castShadow = true;
    this.body.add(this.head);

    const hairMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.1, 0.24),
      hair,
    );
    hairMesh.position.y = 0.78;
    this.body.add(hairMesh);

    this.leftLeg = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.28, 0.1),
      cloth,
    );
    this.leftLeg.position.set(-0.08, 0.14, 0);
    this.body.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.28, 0.1),
      cloth,
    );
    this.rightLeg.position.set(0.08, 0.14, 0);
    this.body.add(this.rightLeg);

    this.leftArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.26, 0.08),
      skin,
    );
    this.leftArm.position.set(-0.2, 0.42, 0);
    this.body.add(this.leftArm);

    this.rightArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.26, 0.08),
      skin,
    );
    this.rightArm.position.set(0.2, 0.42, 0);
    this.body.add(this.rightArm);

    this.aura = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 12, 10),
      new THREE.MeshBasicMaterial({
        color: 0xffe0a0,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.aura.position.y = 0.4;
    this.group.add(this.aura);

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.22, 16),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.02;
    this.group.add(this.shadow);
  }

  setFootstepCallback(cb: (() => void) | null): void {
    this.footstepCb = cb;
  }

  placeAt(worldX: number, worldZ: number, gx: number, gz: number): void {
    this.group.position.set(worldX, 0, worldZ);
    this.gridX = gx;
    this.gridZ = gz;
    this.walkT = 1;
    this.pose = 'idle';
  }

  isBusy(): boolean {
    return this.pose === 'walk' || this.pose === 'sit' || this.walkT < 1 || this.sitT < 1;
  }

  private pendingGrid: { x: number; z: number } | null = null;

  walkTo(
    worldX: number,
    worldZ: number,
    gx: number,
    gz: number,
    onArrive?: () => void,
  ): boolean {
    if (this.isBusy() && this.pose !== 'idle') return false;
    this.walkFrom.copy(this.group.position);
    this.walkTarget.set(worldX, 0, worldZ);
    this.walkT = 0;
    this.pose = 'walk';
    this.pendingGrid = { x: gx, z: gz };
    this.onArrive = onArrive ?? null;
    const dx = worldX - this.walkFrom.x;
    const dz = worldZ - this.walkFrom.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.01) {
      this.body.rotation.y = Math.atan2(dx, dz);
    }
    return true;
  }

  startSit(onDone?: () => void): void {
    this.pose = 'sit';
    this.sitT = 0;
    this.onSitDone = onDone ?? null;
  }

  standUp(): void {
    this.pose = 'idle';
    this.sitT = 1;
    this.walkT = 1;
    this.onSitDone = null;
    this.onArrive = null;
    this.pendingGrid = null;
    this.leftLeg.rotation.set(0, 0, 0);
    this.rightLeg.rotation.set(0, 0, 0);
    this.leftArm.rotation.set(0, 0, 0);
    this.rightArm.rotation.set(0, 0, 0);
    this.torso.position.y = 0.42;
    this.head.position.y = 0.68;
    this.body.position.y = 0;
    this.torso.scale.set(1, 1, 1);
    (this.aura.material as THREE.MeshBasicMaterial).opacity = 0;
  }

  setBreathFill(fill: number): void {
    this.breathFill = fill;
  }

  update(dt: number): void {
    if (this.pose === 'walk' && this.walkT < 1) {
      this.walkT = Math.min(1, this.walkT + dt / this.walkDuration);
      const e = easeInOut(this.walkT);
      this.group.position.lerpVectors(this.walkFrom, this.walkTarget, e);
      const bob = Math.sin(this.walkT * Math.PI * 4) * 0.04;
      this.body.position.y = Math.abs(bob);
      const swing = Math.sin(this.walkT * Math.PI * 4) * 0.45;
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.leftArm.rotation.x = -swing * 0.6;
      this.rightArm.rotation.x = swing * 0.6;

      const footPhase = Math.floor(this.walkT * 4);
      if (footPhase !== this.lastFoot && footPhase > 0) {
        this.lastFoot = footPhase;
        this.footstepCb?.();
      }

      if (this.walkT >= 1) {
        this.pose = 'idle';
        this.body.position.y = 0;
        this.leftLeg.rotation.x = 0;
        this.rightLeg.rotation.x = 0;
        this.leftArm.rotation.x = 0;
        this.rightArm.rotation.x = 0;
        this.lastFoot = 0;
        if (this.pendingGrid) {
          this.gridX = this.pendingGrid.x;
          this.gridZ = this.pendingGrid.z;
          this.pendingGrid = null;
        }
        this.onArrive?.();
        this.onArrive = null;
      }
    }

    if (this.pose === 'sit' && this.sitT < 1) {
      this.sitT = Math.min(1, this.sitT + dt / 0.7);
      const s = easeInOut(this.sitT);
      this.body.position.y = -0.08 * s;
      this.torso.position.y = 0.42 - 0.06 * s;
      this.head.position.y = 0.68 - 0.05 * s;
      this.leftLeg.rotation.set(1.2 * s, 0.4 * s, 0.5 * s);
      this.rightLeg.rotation.set(1.2 * s, -0.4 * s, -0.5 * s);
      this.leftArm.rotation.set(0.3 * s, 0, 0.4 * s);
      this.rightArm.rotation.set(0.3 * s, 0, -0.4 * s);
      if (this.sitT >= 1) {
        this.onSitDone?.();
        this.onSitDone = null;
      }
    }

    if (this.pose === 'sit') {
      const pulse = 1 + this.breathFill * 0.12;
      this.torso.scale.set(pulse, 1 + this.breathFill * 0.08, pulse);
      const auraMat = this.aura.material as THREE.MeshBasicMaterial;
      auraMat.opacity = 0.08 + this.breathFill * 0.28;
      this.aura.scale.setScalar(0.85 + this.breathFill * 0.35);
    } else if (this.pose === 'idle') {
      this.torso.scale.set(1, 1, 1);
      (this.aura.material as THREE.MeshBasicMaterial).opacity = 0;
      const idle = Math.sin(performance.now() * 0.002) * 0.015;
      this.body.position.y = idle;
    }
  }
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
