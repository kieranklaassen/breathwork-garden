import { GameApp } from './app/GameApp';
import './style.css';

const canvas = document.querySelector<HTMLCanvasElement>('#garden-canvas');
const hud = document.querySelector<HTMLElement>('#hud');

if (!canvas || !hud) {
  throw new Error('Missing #garden-canvas or #hud');
}

new GameApp(canvas, hud);
