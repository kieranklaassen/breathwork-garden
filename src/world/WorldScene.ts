import * as THREE from 'three';
import { Player } from './Player';
import { TileGrid } from './TileGrid';
import type { GardenSave } from '../persist/gardenStore';
import { tileWorldPos } from './pathing';

export class WorldScene {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly grid = new TileGrid();
  readonly player = new Player();

  private sun: THREE.DirectionalLight;
  private ambient: THREE.AmbientLight;
  private dust: THREE.Points;
  private dustVel: Float32Array;
  private frustumSize = 11;
  private camTarget = new THREE.Vector3();
  private camOffset = new THREE.Vector3(12, 12, 12);
  private sessionZoom = 0;
  private baseLook = new THREE.Vector3(0, 0, 0);

  constructor(canvas: HTMLCanvasElement) {
    this.scene.background = new THREE.Color(0xf2d4a8);
    this.scene.fog = new THREE.Fog(0xf2d4a8, 28, 48);

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.OrthographicCamera(
      (-this.frustumSize * aspect) / 2,
      (this.frustumSize * aspect) / 2,
      this.frustumSize / 2,
      -this.frustumSize / 2,
      0.1,
      100,
    );
    this.camera.position.copy(this.camOffset);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.ambient = new THREE.AmbientLight(0xffe6c8, 0.55);
    this.scene.add(this.ambient);

    this.sun = new THREE.DirectionalLight(0xfff0d0, 1.15);
    this.sun.position.set(8, 14, 6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 40;
    this.sun.shadow.camera.left = -12;
    this.sun.shadow.camera.right = 12;
    this.sun.shadow.camera.top = 12;
    this.sun.shadow.camera.bottom = -12;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    const hemi = new THREE.HemisphereLight(0xffe8c8, 0xc4a070, 0.35);
    this.scene.add(hemi);

    this.scene.add(this.grid.group);
    this.scene.add(this.player.group);

    // Ground plane under tiles for soft feel
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshLambertMaterial({ color: 0xe0b878, flatShading: true }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Dust particles
    const count = 80;
    const positions = new Float32Array(count * 3);
    this.dustVel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 14;
      positions[i * 3 + 1] = 0.2 + Math.random() * 3;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 14;
      this.dustVel[i * 3] = (Math.random() - 0.5) * 0.15;
      this.dustVel[i * 3 + 1] = 0.02 + Math.random() * 0.05;
      this.dustVel[i * 3 + 2] = (Math.random() - 0.5) * 0.15;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.dust = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        color: 0xf5e0c0,
        size: 0.06,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    this.scene.add(this.dust);

    window.addEventListener('resize', () => this.onResize());
  }

  loadGarden(save: GardenSave): void {
    this.grid.buildFromSave(save);
    const { x, z } = tileWorldPos(save.playerPos.x, save.playerPos.z);
    this.player.placeAt(x, z, save.playerPos.x, save.playerPos.z);
    this.camTarget.set(x, 0, z);
    this.updateCamera(0);
  }

  setSessionFocus(active: boolean): void {
    this.sessionZoom = active ? 1 : 0;
  }

  setBreathLight(fill: number): void {
    this.sun.intensity = 1.05 + fill * 0.25;
    this.ambient.intensity = 0.5 + fill * 0.15;
  }

  onResize(): void {
    const aspect = window.innerWidth / window.innerHeight;
    this.camera.left = (-this.frustumSize * aspect) / 2;
    this.camera.right = (this.frustumSize * aspect) / 2;
    this.camera.top = this.frustumSize / 2;
    this.camera.bottom = -this.frustumSize / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  update(dt: number, time: number): void {
    this.player.update(dt);
    this.grid.update(dt, time);

    // Dust drift
    const pos = this.dust.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      pos.setX(i, pos.getX(i) + this.dustVel[i * 3] * dt);
      pos.setY(i, pos.getY(i) + this.dustVel[i * 3 + 1] * dt);
      pos.setZ(i, pos.getZ(i) + this.dustVel[i * 3 + 2] * dt);
      if (pos.getY(i) > 3.5) pos.setY(i, 0.15);
      if (Math.abs(pos.getX(i)) > 8) pos.setX(i, -pos.getX(i) * 0.9);
      if (Math.abs(pos.getZ(i)) > 8) pos.setZ(i, -pos.getZ(i) * 0.9);
    }
    pos.needsUpdate = true;

    this.camTarget.lerp(this.player.group.position, 1 - Math.pow(0.001, dt));
    this.updateCamera(dt);
  }

  private updateCamera(dt: number): void {
    const zoom = 1 - this.sessionZoom * 0.18;
    const aspect = window.innerWidth / window.innerHeight;
    const size = this.frustumSize * zoom;
    this.camera.left = (-size * aspect) / 2;
    this.camera.right = (size * aspect) / 2;
    this.camera.top = size / 2;
    this.camera.bottom = -size / 2;
    this.camera.updateProjectionMatrix();

    const desired = this.camTarget.clone().add(this.camOffset);
    this.camera.position.lerp(desired, 1 - Math.pow(0.02, Math.max(dt, 0.001)));
    this.baseLook.lerp(this.camTarget, 0.08);
    this.camera.lookAt(this.baseLook);
    this.sun.target.position.copy(this.camTarget);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  pickTile(clientX: number, clientY: number): { x: number; z: number } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.camera);
    const hits = raycaster.intersectObjects(this.grid.getTileMeshes(), false);
    if (!hits.length) return null;
    const obj = hits[0].object;
    return { x: obj.userData.gridX as number, z: obj.userData.gridZ as number };
  }
}
