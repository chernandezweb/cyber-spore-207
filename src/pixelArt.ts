// CYBER-SPORE 207 // 2.5D Pixel-Art Sprite-Stacking Engine & Asset Baker
// Software-bakes 3D layered voxel/slice models into crisp pixel-art sprites with
// directional shading, ambient occlusion, 1px dark retro outlines, and white hit-flash variants.
import type { EnemyType, SurvivorId } from './types';

/** 1 crisp retro pixel = 2x2 world units (640x360 pixel buffer covers 1280x720 world) */
export const WORLD_PER_PIXEL = 2;

function pack(r: number, g: number, b: number, a = 255): number {
  return (((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;
}

function hexToABGR(hex: string): number {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return pack(r, g, b, 255);
}

function shade(col: number, mult: number): number {
  const a = (col >>> 24) & 255;
  if (a === 0) return 0;
  const r = Math.min(255, Math.max(0, Math.round((col & 255) * mult)));
  const g = Math.min(255, Math.max(0, Math.round(((col >>> 8) & 255) * mult)));
  const b = Math.min(255, Math.max(0, Math.round(((col >>> 16) & 255) * mult)));
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

const OUTLINE_COL = pack(10, 14, 24, 255);
const FLASH_COL = pack(255, 252, 240, 255);

/** Slice-by-slice 3D pixel model builder */
class StackGrid {
  readonly w: number;
  readonly d: number;
  readonly h: number;
  readonly data: Uint32Array;
  readonly emissive: Uint8Array;

  constructor(w: number, d: number, h: number) {
    this.w = w;
    this.d = d;
    this.h = h;
    this.data = new Uint32Array(w * d * h);
    this.emissive = new Uint8Array(w * d * h);
  }

  private idx(x: number, y: number, z: number): number {
    return (z * this.d + y) * this.w + x;
  }

  set(x: number, y: number, z: number, col: number, glow = false): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    const iz = Math.round(z);
    if (ix < 0 || ix >= this.w || iy < 0 || iy >= this.d || iz < 0 || iz >= this.h) return;
    const i = this.idx(ix, iy, iz);
    this.data[i] = col;
    this.emissive[i] = glow ? 1 : 0;
  }

  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, col: number, glow = false): void {
    const minX = Math.max(0, Math.floor(x0));
    const maxX = Math.min(this.w - 1, Math.floor(x1));
    const minY = Math.max(0, Math.floor(y0));
    const maxY = Math.min(this.d - 1, Math.floor(y1));
    const minZ = Math.max(0, Math.floor(z0));
    const maxZ = Math.min(this.h - 1, Math.floor(z1));
    for (let z = minZ; z <= maxZ; z++) {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const i = this.idx(x, y, z);
          this.data[i] = col;
          this.emissive[i] = glow ? 1 : 0;
        }
      }
    }
  }

  disc(cx: number, cy: number, z: number, radius: number, col: number, altCol?: number, glow = false): void {
    if (z < 0 || z >= this.h) return;
    const r2 = radius * radius;
    for (let y = 0; y < this.d; y++) {
      for (let x = 0; x < this.w; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r2) {
          const c = altCol && ((x + y + z) & 1) === 0 ? altCol : col;
          const i = this.idx(x, y, z);
          this.data[i] = c;
          this.emissive[i] = glow ? 1 : 0;
        }
      }
    }
  }

  ring(cx: number, cy: number, z: number, rOuter: number, rInner: number, col: number, glow = false): void {
    if (z < 0 || z >= this.h) return;
    const ro2 = rOuter * rOuter;
    const ri2 = rInner * rInner;
    for (let y = 0; y < this.d; y++) {
      for (let x = 0; x < this.w; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 <= ro2 && d2 >= ri2) {
          const i = this.idx(x, y, z);
          this.data[i] = col;
          this.emissive[i] = glow ? 1 : 0;
        }
      }
    }
  }
}

export interface BakedSprite {
  canvas: HTMLCanvasElement;
  flashCanvas: HTMLCanvasElement;
  pivotX: number; // ground-center X inside sprite canvas
  pivotY: number; // ground-center Y inside sprite canvas
}

export interface DirectionalSpriteSet {
  angles: number;
  frames: BakedSprite[];
}

/**
 * Software-rasterizes a 3D StackGrid at a given yaw angle into a crisp pixel-art canvas
 * with 2.5D vertical slice stacking, ambient occlusion, directional shading, 1px outline,
 * and a white arcade hit-flash silhouette.
 */
function bakeStackAngle(
  grid: StackGrid,
  angle: number,
  sliceStep = 0.85,
  addOutline = true,
  tiltY = 0.82
): BakedSprite {
  const diag = Math.ceil(Math.hypot(grid.w, grid.d)) + 4;
  const outW = diag + 2;
  const stackLift = Math.ceil(grid.h * sliceStep);
  const outH = Math.ceil(diag * tiltY) + stackLift + 4;

  const pivotX = Math.floor(outW * 0.5);
  const pivotY = outH - Math.floor(diag * tiltY * 0.5) - 2;

  const buf = new Uint32Array(outW * outH);
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const halfW = (grid.w - 1) * 0.5;
  const halfD = (grid.d - 1) * 0.5;

  // Render slices bottom-to-top using inverse rotation (gapless crisp nearest-neighbor!)
  for (let z = 0; z < grid.h; z++) {
    const zNorm = grid.h > 1 ? z / (grid.h - 1) : 1;
    const ao = 0.72 + zNorm * 0.36;
    const liftY = z * sliceStep;
    const sliceOffset = z * grid.d * grid.w;

    const minSy = Math.max(1, Math.floor(pivotY - liftY - diag * tiltY * 0.52));
    const maxSy = Math.min(outH - 2, Math.ceil(pivotY - liftY + diag * tiltY * 0.52));
    const minSx = Math.max(1, Math.floor(pivotX - diag * 0.52));
    const maxSx = Math.min(outW - 2, Math.ceil(pivotX + diag * 0.52));

    for (let sy = minSy; sy <= maxSy; sy++) {
      const dyScreen = (sy - (pivotY - liftY)) / tiltY;
      const rowOff = sy * outW;
      for (let sx = minSx; sx <= maxSx; sx++) {
        const dxScreen = sx - pivotX;
        // Inverse rotate screen (dx, dy) -> local model (+X is forward/aim direction)
        const lx = dxScreen * cosA + dyScreen * sinA + halfW;
        const ly = -dxScreen * sinA + dyScreen * cosA + halfD;
        const ix = Math.round(lx);
        const iy = Math.round(ly);
        if (ix < 0 || ix >= grid.w || iy < 0 || iy >= grid.d) continue;

        const gi = sliceOffset + iy * grid.w + ix;
        const col = grid.data[gi];
        if (col === 0) continue;

        if (grid.emissive[gi]) {
          buf[rowOff + sx] = col;
        } else {
          // Check top exposure & subtle top-left key light
          const topEmpty = z === grid.h - 1 || grid.data[gi + grid.d * grid.w] === 0;
          const dirLight = 1.0 - (dxScreen + dyScreen) * 0.012;
          const totalShade = ao * (topEmpty ? 1.08 : 0.90) * Math.max(0.84, Math.min(1.14, dirLight));
          buf[rowOff + sx] = shade(col, totalShade);
        }
      }
    }
  }

  // Optional 1px crisp dark retro outline pass
  const outlined = new Uint32Array(buf);
  if (addOutline) {
    for (let y = 1; y < outH - 1; y++) {
      const row = y * outW;
      for (let x = 1; x < outW - 1; x++) {
        const i = row + x;
        if (buf[i] !== 0) continue;
        if (
          buf[i - 1] !== 0 ||
          buf[i + 1] !== 0 ||
          buf[i - outW] !== 0 ||
          buf[i + outW] !== 0
        ) {
          outlined[i] = OUTLINE_COL;
        }
      }
    }
  }

  // Create main sprite canvas
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(outW, outH);
  new Uint32Array(img.data.buffer).set(outlined);
  ctx.putImageData(img, 0, 0);

  // Create white hit-flash silhouette canvas (zero runtime ctx.filter cost!)
  const flashBuf = new Uint32Array(outW * outH);
  for (let i = 0; i < outlined.length; i++) {
    if (outlined[i] !== 0) {
      flashBuf[i] = outlined[i] === OUTLINE_COL ? OUTLINE_COL : FLASH_COL;
    }
  }
  const flashCanvas = document.createElement('canvas');
  flashCanvas.width = outW;
  flashCanvas.height = outH;
  const fctx = flashCanvas.getContext('2d')!;
  const fimg = fctx.createImageData(outW, outH);
  new Uint32Array(fimg.data.buffer).set(flashBuf);
  fctx.putImageData(fimg, 0, 0);

  return { canvas, flashCanvas, pivotX, pivotY };
}

function bakeDirectional(grid: StackGrid, angles = 24, sliceStep = 0.85): DirectionalSpriteSet {
  const frames: BakedSprite[] = [];
  for (let i = 0; i < angles; i++) {
    const a = (i / angles) * Math.PI * 2;
    frames.push(bakeStackAngle(grid, a, sliceStep, true));
  }
  return { angles, frames };
}

export function pickAngleSprite(set: DirectionalSpriteSet, angle: number): BakedSprite {
  const norm = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const idx = Math.round((norm / (Math.PI * 2)) * set.angles) % set.angles;
  return set.frames[idx];
}

// ============================================================================
// 3D PIXEL-ART MODEL DEFINITIONS (Boxhead Survivors, Bestiary, Arena Props)
// Model local convention: +X = forward (aim/facing), Y = left/right, Z = up
// ============================================================================

function buildSurvivorGrid(bodyHex: string, accentHex: string, visorTrimHex: string): StackGrid {
  const g = new StackGrid(15, 15, 13);
  const body = hexToABGR(bodyHex);
  const bodyDark = shade(body, 0.72);
  const bodyHi = shade(body, 1.2);
  const accent = hexToABGR(accentHex);
  const trim = hexToABGR(visorTrimHex);
  const boots = pack(32, 38, 52);
  const packDark = pack(46, 56, 78);
  const packLight = pack(86, 102, 134);
  const helmet = pack(34, 42, 60);
  const helmetHi = pack(64, 78, 106);

  // Chunky boots (z 0..2)
  g.box(5, 4, 0, 8, 6, 2, boots);
  g.box(5, 8, 0, 8, 10, 2, boots);

  // Armored square Boxhead torso (z 3..7)
  g.box(4, 3, 3, 10, 11, 7, body);
  // Shoulder pads
  g.box(5, 2, 5, 9, 3, 7, bodyHi);
  g.box(5, 11, 5, 9, 12, 7, bodyHi);
  // Chest trim & belt
  g.box(4, 3, 3, 10, 11, 3, bodyDark);
  g.box(10, 5, 4, 10, 9, 6, trim);

  // Cyber jet-pack on back (-X side)
  g.box(2, 4, 3, 4, 10, 8, packDark);
  g.box(2, 5, 7, 3, 9, 8, packLight);
  g.set(2, 5, 5, accent, true);
  g.set(2, 9, 5, accent, true);

  // Iconic square Boxhead helmet (z 8..12)
  g.box(4, 4, 8, 10, 10, 12, helmet);
  g.box(5, 5, 12, 9, 9, 12, helmetHi);
  // Colored helmet crest stripe
  g.box(5, 7, 12, 9, 7, 12, bodyHi);
  // Glowing tactical visor (+X front face)
  g.box(10, 5, 9, 11, 9, 10, accent, true);

  return g;
}

function buildGoombaZombieGrid(stepPhase: number): StackGrid {
  const g = new StackGrid(15, 15, 11);
  const skin = pack(44, 96, 74);
  const skinDark = pack(26, 60, 48);
  const coat = pack(34, 52, 62);
  const cap = pack(108, 62, 42);
  const capSpot = pack(78, 224, 198);
  const eye = pack(72, 248, 255);

  const armL = stepPhase === 0 ? 1 : -1;
  // Feet
  g.box(5, 4, 0, 7, 6, 1, skinDark);
  g.box(6, 8, 0, 8, 10, 1, skinDark);
  // Tattered zombie torso
  g.box(4, 4, 2, 9, 10, 6, coat);
  g.box(4, 4, 2, 9, 10, 3, skinDark);
  // Reaching undead Boxhead arms (+X)
  g.box(8, 2, 4, 12 + armL, 4, 5, skin);
  g.box(8, 10, 4, 12 - armL, 12, 5, skin);
  // Square undead head + spore-mushroom cap
  g.box(4, 4, 6, 10, 10, 9, skin);
  g.box(3, 3, 9, 11, 11, 10, cap);
  g.set(5, 5, 10, capSpot, true);
  g.set(9, 9, 10, capSpot, true);
  // Glowing cyan zombie eyes
  g.set(10, 5, 7, eye, true);
  g.set(10, 5, 8, eye, true);
  g.set(10, 9, 7, eye, true);
  g.set(10, 9, 8, eye, true);

  return g;
}

function buildKoopaRunnerGrid(stepPhase: number): StackGrid {
  const g = new StackGrid(17, 17, 12);
  const shell = pack(46, 128, 62);
  const shellDark = pack(26, 76, 42);
  const trim = pack(74, 255, 76);
  const skin = pack(172, 114, 54);
  const visor = pack(255, 52, 52);
  const spike = pack(232, 238, 246);

  const stride = stepPhase === 0 ? 1 : -1;
  // Legs
  g.box(5 + stride, 4, 0, 7 + stride, 6, 2, skin);
  g.box(5 - stride, 10, 0, 7 - stride, 12, 2, skin);
  // Armored cyber carapace shell
  g.box(3, 3, 2, 11, 13, 8, shell);
  g.box(3, 3, 2, 11, 13, 3, shellDark);
  // Glowing lime carapace rim
  g.box(3, 3, 6, 11, 3, 6, trim, true);
  g.box(3, 13, 6, 11, 13, 6, trim, true);
  g.box(3, 3, 6, 3, 13, 6, trim, true);
  // Dorsal spikes
  g.box(5, 7, 9, 6, 9, 10, spike);
  g.box(8, 7, 9, 9, 9, 10, spike);
  // Forward claws
  g.box(11, 3, 4, 15, 5, 5, skin);
  g.box(11, 11, 4, 15, 13, 5, skin);
  // Snout head + red visor
  g.box(9, 5, 6, 14, 11, 10, skin);
  g.box(14, 6, 8, 15, 10, 9, visor, true);

  return g;
}

function buildWispDevilGrid(): StackGrid {
  const g = new StackGrid(15, 15, 12);
  const body = pack(116, 22, 104);
  const core = pack(255, 66, 224);
  const coreHi = pack(255, 198, 250);
  const horn = pack(244, 236, 220);

  // Floating flame tail (starts at z=2 for hovering feel)
  g.disc(7, 7, 2, 2.2, body);
  g.disc(7, 7, 3, 3.6, body, core);
  g.disc(7, 7, 4, 4.5, body);
  g.disc(7, 7, 5, 4.8, body);
  g.disc(7, 7, 6, 4.6, body, core);
  g.disc(7, 7, 7, 4.0, core);
  g.disc(7, 7, 8, 3.0, core, coreHi, true);
  g.disc(7, 7, 9, 1.8, coreHi, undefined, true);
  // Forward devil horns (+X)
  g.box(10, 3, 6, 13, 4, 8, horn);
  g.box(10, 10, 6, 13, 11, 8, horn);
  g.set(14, 3, 9, horn);
  g.set(14, 11, 9, horn);
  // Fierce eyes
  g.box(11, 5, 6, 11, 6, 7, pack(255, 240, 102), true);
  g.box(11, 8, 6, 11, 9, 7, pack(255, 240, 102), true);

  return g;
}

function buildPiranhaGrid(): StackGrid {
  const g = new StackGrid(17, 17, 13);
  const stem = pack(26, 98, 62);
  const leaf = pack(48, 154, 78);
  const bulb = pack(178, 36, 86);
  const spot = pack(252, 244, 226);
  const acid = pack(86, 255, 64);

  // Base leaves & stem
  g.disc(7, 8, 0, 5.5, leaf, stem);
  g.disc(7, 8, 1, 5.0, stem, leaf);
  g.disc(7, 8, 2, 3.5, stem);
  g.disc(7, 8, 3, 3.0, stem);
  // Bulbous spotted chomper head
  for (let z = 4; z <= 11; z++) {
    const r = z === 4 || z === 11 ? 3.8 : z === 5 || z === 10 ? 5.2 : 5.8;
    g.disc(8, 8, z, r, bulb);
  }
  // Classic white spots on bulb
  g.box(5, 5, 11, 6, 6, 11, spot);
  g.box(5, 10, 11, 6, 11, 11, spot);
  g.box(9, 4, 9, 10, 5, 10, spot);
  g.box(9, 11, 9, 10, 12, 10, spot);
  // Glowing acid maw + pixel fangs (+X)
  g.box(12, 5, 6, 15, 11, 9, acid, true);
  g.set(14, 5, 10, spot);
  g.set(14, 8, 10, spot);
  g.set(14, 11, 10, spot);
  g.set(14, 6, 5, spot);
  g.set(14, 10, 5, spot);

  return g;
}

function buildBowserBossGrid(): StackGrid {
  // Colossal 32x32x16 spiked cyber-dragon Leviathan boss!
  const g = new StackGrid(32, 32, 16);
  const dark = pack(34, 18, 46);
  const carapace = pack(98, 28, 76);
  const scale = pack(134, 42, 92);
  const lava = pack(255, 36, 128);
  const horn = pack(238, 228, 206);
  const claw = pack(66, 44, 82);
  const eye = pack(255, 48, 48);
  const cyanCore = pack(48, 246, 255);

  // Heavy feet
  g.box(8, 5, 0, 15, 11, 2, claw);
  g.box(8, 20, 0, 15, 26, 2, claw);

  // Massive spiked armored body (z 2..11)
  g.box(5, 5, 2, 23, 26, 10, carapace);
  g.box(6, 6, 11, 21, 25, 12, scale);
  g.box(5, 5, 2, 23, 26, 3, dark);

  // Glowing magenta magma cracks across shell
  g.box(6, 5, 6, 22, 5, 7, lava, true);
  g.box(6, 26, 6, 22, 26, 7, lava, true);
  g.box(5, 6, 6, 5, 25, 7, lava, true);
  g.box(10, 14, 12, 18, 17, 12, lava, true);
  g.box(13, 9, 12, 15, 22, 12, lava, true);

  // Iconic giant shell spikes
  const spikeCoords: [number, number][] = [
    [9, 9], [9, 22], [16, 9], [16, 22], [12, 15], [18, 15],
  ];
  for (const [sx, sy] of spikeCoords) {
    g.box(sx - 1, sy - 1, 13, sx + 1, sy + 1, 14, horn);
    g.set(sx, sy, 15, horn);
  }

  // Forward armored claws (+X)
  g.box(21, 2, 3, 29, 8, 7, claw);
  g.box(21, 23, 3, 29, 29, 7, claw);
  g.box(29, 3, 4, 31, 4, 5, horn);
  g.box(29, 6, 4, 31, 7, 5, horn);
  g.box(29, 24, 4, 31, 25, 5, horn);
  g.box(29, 27, 4, 31, 28, 5, horn);

  // Roaring draconic head & jaw
  g.box(19, 10, 7, 29, 21, 13, dark);
  g.box(20, 11, 13, 27, 20, 14, carapace);
  // Cyan plasma throat core
  g.box(28, 13, 8, 30, 18, 10, cyanCore, true);
  // Swept bull horns
  g.box(20, 7, 11, 24, 10, 13, horn);
  g.box(24, 4, 12, 28, 7, 14, horn);
  g.box(20, 21, 11, 24, 24, 13, horn);
  g.box(24, 24, 12, 28, 27, 14, horn);
  // Blazing red draconic eyes
  g.box(26, 11, 11, 28, 13, 12, eye, true);
  g.box(26, 18, 11, 28, 20, 12, eye, true);

  return g;
}

// ============================================================================
// STATIC 3D PIXEL-ART ARENA PROPS (Barrel, Barricade, [?] Block, Pipe, Monolith)
// ============================================================================

function buildBarrelGrid(damaged: boolean): StackGrid {
  const g = new StackGrid(16, 16, 12);
  const red = damaged ? pack(255, 92, 42) : pack(224, 44, 44);
  const redDark = pack(146, 22, 28);
  const rim = pack(172, 186, 204);
  const hazard = damaged ? pack(255, 252, 110) : pack(255, 198, 28);

  for (let z = 0; z < 11; z++) {
    const isRim = z === 0 || z === 10;
    const isBand = z === 4 || z === 5;
    const col = isRim ? rim : isBand ? hazard : red;
    const alt = isRim ? pack(132, 146, 164) : isBand ? pack(232, 152, 18) : redDark;
    g.disc(7.5, 7.5, z, isRim ? 6.4 : 6.0, col, isBand ? col : alt, damaged && isBand);
  }
  // Recessed dark top lid + fuel cap
  g.disc(7.5, 7.5, 11, 5.2, redDark);
  g.ring(7.5, 7.5, 11, 6.4, 5.1, rim);
  g.box(9, 6, 11, 10, 7, 11, hazard, true);
  return g;
}

function buildBarricadeGrid(): StackGrid {
  const g = new StackGrid(18, 18, 11);
  const steel = pack(54, 68, 94);
  const steelHi = pack(112, 136, 174);
  const energy = pack(46, 232, 255);
  const energyCore = pack(196, 252, 255);

  // Base plate
  g.box(1, 1, 0, 16, 16, 1, steel);
  // 4 reinforced corner posts
  for (const [cx, cy] of [[1, 1], [13, 1], [1, 13], [13, 13]]) {
    g.box(cx, cy, 0, cx + 3, cy + 3, 10, steel);
    g.box(cx + 1, cy + 1, 10, cx + 2, cy + 2, 10, steelHi);
  }
  // Glowing holographic energy shield lattice
  for (let z = 2; z <= 8; z += 2) {
    g.box(4, 2, z, 13, 15, z, energy, true);
    g.box(2, 4, z, 15, 13, z, energy, true);
  }
  g.box(6, 6, 9, 11, 11, 9, energyCore, true);
  return g;
}

function buildQuestionBlockGrid(spent: boolean): StackGrid {
  const g = new StackGrid(20, 20, 12);
  const gold = spent ? pack(54, 62, 82) : pack(248, 178, 28);
  const goldHi = spent ? pack(78, 90, 114) : pack(255, 224, 92);
  const goldDark = spent ? pack(34, 40, 54) : pack(188, 102, 16);
  const bolt = spent ? pack(24, 28, 38) : pack(124, 58, 14);
  const qCol = pack(255, 252, 236);

  g.box(1, 1, 0, 18, 18, 10, gold);
  g.box(1, 1, 0, 18, 18, 2, goldDark);
  g.box(2, 2, 11, 17, 17, 11, goldHi);
  // Corner rivets on top face
  for (const [rx, ry] of [[3, 3], [16, 3], [3, 16], [16, 16]]) {
    g.set(rx, ry, 11, bolt);
  }
  // Bold pixel '?' drawn on top face if active
  if (!spent) {
    const qPixels: [number, number][] = [
      [7, 5], [8, 5], [9, 5], [10, 5], [11, 5], [12, 5],
      [6, 6], [7, 6], [11, 6], [12, 6], [13, 6],
      [11, 7], [12, 7], [13, 7],
      [9, 8], [10, 8], [11, 8], [12, 8],
      [9, 9], [10, 9],
      [9, 10], [10, 10],
      [9, 11], [10, 11],
      [9, 13], [10, 13], [9, 14], [10, 14],
    ];
    for (const [qx, qy] of qPixels) {
      g.set(qx, qy, 11, qCol, true);
    }
  }
  return g;
}

function buildWarpPipeGrid(): StackGrid {
  const g = new StackGrid(36, 36, 10);
  const pipeDark = pack(14, 96, 56);
  const pipeMid = pack(34, 186, 98);
  const pipeHi = pack(112, 255, 162);
  const hole = pack(6, 18, 16);

  // Pipe shaft
  for (let z = 0; z < 6; z++) {
    g.disc(17.5, 17.5, z, 14.2, pipeMid, pipeDark);
  }
  // Flared classic Mario lip
  for (let z = 6; z < 10; z++) {
    g.disc(17.5, 17.5, z, 16.5, z === 9 ? pipeHi : pipeMid, pipeDark);
  }
  // Deep dark warp portal opening inside top
  for (let z = 7; z < 10; z++) {
    g.disc(17.5, 17.5, z, 11.2, hole);
  }
  return g;
}

function buildMonolithCrystalGrid(colHex: string): StackGrid {
  const g = new StackGrid(14, 14, 14);
  const col = hexToABGR(colHex);
  const core = pack(242, 254, 255);
  const radii = [1.0, 2.0, 3.0, 4.0, 4.8, 5.2, 5.2, 4.8, 4.0, 3.2, 2.4, 1.6, 1.0, 0.5];
  for (let z = 0; z < radii.length; z++) {
    const c = z >= 5 && z <= 7 ? core : col;
    g.disc(6.5, 6.5, z, radii[z], c, col, true);
  }
  return g;
}

// ============================================================================
// PROCEDURAL PIXEL-ART ARENA FLOOR TILE PATTERN (Cached Offscreen Canvas)
// ============================================================================

function buildFloorTileCanvas(): HTMLCanvasElement {
  // 120x120 logical pixels (= 240x240 world units, 4x4 tactical tiles of 30x30 px)
  const size = 120;
  const tile = 30;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const px = new Uint32Array(img.data.buffer);

  const slateA = pack(20, 28, 44);
  const slateB = pack(24, 34, 52);
  const grout = pack(12, 17, 28);
  const bevelHi = pack(34, 48, 72);
  const moss = pack(32, 86, 66);
  const speck = pack(16, 22, 36);

  // Deterministic tile micro-hash
  const hash = (x: number, y: number) => {
    let n = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };

  for (let y = 0; y < size; y++) {
    const ty = Math.floor(y / tile);
    const ly = y % tile;
    for (let x = 0; x < size; x++) {
      const tx = Math.floor(x / tile);
      const lx = x % tile;
      const checker = (tx + ty) & 1;

      let col = checker ? slateA : slateB;
      if (lx === 0 || ly === 0) {
        col = grout;
      } else if (lx === 1 || ly === 1) {
        col = bevelHi;
      } else if (lx === tile - 1 || ly === tile - 1) {
        col = speck;
      } else {
        const r = hash(x, y);
        if (r > 0.965) col = speck;
        else if (r < 0.014 && (tx === 1 || ty === 2)) col = moss;
        // Subtle corner rivets
        if ((lx === 3 || lx === tile - 4) && (ly === 3 || ly === tile - 4)) {
          col = grout;
        }
      }
      px[y * size + x] = col;
    }
  }

  ctx.putImageData(img, 0, 0);
  return c;
}

// ============================================================================
// SPRITE ATLAS SINGLETON (Baked once in ~30ms at startup!)
// ============================================================================

export interface PixelSpriteAtlas {
  survivors: Record<SurvivorId, DirectionalSpriteSet>;
  enemies: Record<EnemyType, DirectionalSpriteSet[]>; // array of animation frames
  barrel: BakedSprite;
  barrelDamaged: BakedSprite;
  barricade: BakedSprite;
  questionBlock: BakedSprite;
  questionBlockSpent: BakedSprite;
  warpPipe: BakedSprite;
  crystalRed: BakedSprite;
  crystalGold: BakedSprite;
  crystalCyan: BakedSprite;
  floorTile: HTMLCanvasElement;
}

let cachedAtlas: PixelSpriteAtlas | null = null;

export function getPixelAtlas(): PixelSpriteAtlas {
  if (cachedAtlas) return cachedAtlas;

  const survivors: Record<SurvivorId, DirectionalSpriteSet> = {
    vanguard: bakeDirectional(buildSurvivorGrid('#d7263d', '#00f3ff', '#ffe066'), 24, 0.85),
    phantom: bakeDirectional(buildSurvivorGrid('#246a44', '#39ff14', '#9fffa0'), 24, 0.85),
    huntress: bakeDirectional(buildSurvivorGrid('#6b289c', '#ff2bd6', '#ffb8f0'), 24, 0.85),
  };

  const enemies: Record<EnemyType, DirectionalSpriteSet[]> = {
    goomba: [
      bakeDirectional(buildGoombaZombieGrid(0), 24, 0.85),
      bakeDirectional(buildGoombaZombieGrid(1), 24, 0.85),
    ],
    koopa: [
      bakeDirectional(buildKoopaRunnerGrid(0), 24, 0.85),
      bakeDirectional(buildKoopaRunnerGrid(1), 24, 0.85),
    ],
    wisp: [bakeDirectional(buildWispDevilGrid(), 16, 0.85)],
    piranha: [bakeDirectional(buildPiranhaGrid(), 24, 0.85)],
    bowser_boss: [bakeDirectional(buildBowserBossGrid(), 24, 1.05)],
  };

  cachedAtlas = {
    survivors,
    enemies,
    barrel: bakeStackAngle(buildBarrelGrid(false), 0, 0.9, true),
    barrelDamaged: bakeStackAngle(buildBarrelGrid(true), 0, 0.9, true),
    barricade: bakeStackAngle(buildBarricadeGrid(), 0, 0.9, true),
    questionBlock: bakeStackAngle(buildQuestionBlockGrid(false), 0, 0.9, true),
    questionBlockSpent: bakeStackAngle(buildQuestionBlockGrid(true), 0, 0.9, true),
    warpPipe: bakeStackAngle(buildWarpPipeGrid(), 0, 0.85, true),
    crystalRed: bakeStackAngle(buildMonolithCrystalGrid('#ff4455'), 0.4, 0.95, true),
    crystalGold: bakeStackAngle(buildMonolithCrystalGrid('#ffbe0b'), 0.4, 0.95, true),
    crystalCyan: bakeStackAngle(buildMonolithCrystalGrid('#2eeeff'), 0.4, 0.95, true),
    floorTile: buildFloorTileCanvas(),
  };

  return cachedAtlas;
}
