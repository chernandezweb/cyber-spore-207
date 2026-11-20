// CYBER-SPORE 207 // 2.5D Pixel-Art Sprite-Stacked Arena Renderer
// Renders onto a crisp 640x360 pixel framebuffer (scaled nearest-neighbor to viewport).
// ZERO ctx.shadowBlur, ZERO ctx.filter -> rock-solid 60-144+ FPS even under full swarms & boss!
import { drawSurvivorPixel, drawEnemyPixel } from './sprites';
import { getPixelAtlas, WORLD_PER_PIXEL } from './pixelArt';
import type { BloodSplat, PlacedObject, QuestionBlock, WallBlock, WarpPipe } from './types';

type Ctx = CanvasRenderingContext2D;

const INV_SCALE = 1 / WORLD_PER_PIXEL; // 0.5 (2 world units = 1 crisp pixel)

interface DepthItem {
  sortY: number;
  draw: () => void;
}

export function renderGame(e: any) {
  const ctx: Ctx = e.ctx;
  const pw: number = e.pixelW;
  const ph: number = e.pixelH;

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#090d17';
  ctx.fillRect(0, 0, pw, ph);

  if (!e.player) return;

  const atlas = getPixelAtlas();
  const shakeX = e.shake > 0.2 ? Math.round(((Math.random() - 0.5) * e.shake) * INV_SCALE) : 0;
  const shakeY = e.shake > 0.2 ? Math.round(((Math.random() - 0.5) * e.shake) * INV_SCALE) : 0;
  const ox = Math.round(e.camX * INV_SCALE) - shakeX;
  const oy = Math.round(e.camY * INV_SCALE) - shakeY;

  const toPx = (wx: number) => Math.round(wx * INV_SCALE) - ox;
  const toPy = (wy: number) => Math.round(wy * INV_SCALE) - oy;

  // 1. Tiled Pixel-Art Bunker Floor & Cyber Circuit Nodes
  drawPixelFloor(ctx, e, atlas.floorTile, ox, oy, pw, ph);

  // 2. Pixelated Organic Alien Spore Splats
  drawPixelSplats(ctx, e, toPx, toPy, pw, ph);

  // 3. Bio-Monolith Teleporter Ground Ring & Base Pad
  drawTeleporterBase(ctx, e, toPx, toPy);

  // 4. Corner Mario Warp Pipes (3D sprite-stacked)
  drawWarpPipes(ctx, e, atlas.warpPipe, toPx, toPy, pw, ph);

  // 5. Build Y-Sorted 2.5D Render List (Walls, [?] Blocks, Barrels, Barricades, Monolith Crystal, Pickups, Enemies, Player)
  const depthList: DepthItem[] = [];

  // Walls (2.5D extruded pixel-art bunker blocks)
  for (const w of e.walls as WallBlock[]) {
    const x0 = toPx(w.x);
    const y0 = toPy(w.y);
    const rw = Math.round(w.w * INV_SCALE);
    const rh = Math.round(w.h * INV_SCALE);
    if (x0 + rw < -8 || x0 > pw + 8 || y0 + rh < -24 || y0 - 20 > ph + 8) continue;
    depthList.push({
      sortY: w.y + w.h,
      draw: () => drawPixelWall(ctx, x0, y0, rw, rh, w.color, e.stage),
    });
  }

  // Question Blocks [?]
  for (const b of e.blocks as QuestionBlock[]) {
    const bx = toPx(b.x + b.w * 0.5);
    const by = toPy(b.y + b.h * 0.5);
    if (bx < -24 || bx > pw + 24 || by < -24 || by > ph + 24) continue;
    depthList.push({
      sortY: b.y + b.h,
      draw: () => {
        drawDitherShadow(ctx, bx, by + 3, 10, 6);
        const spr = b.hit ? atlas.questionBlockSpent : atlas.questionBlock;
        const bump = Math.round(b.bumpOffset * 5);
        ctx.drawImage(spr.canvas, Math.round(bx - spr.pivotX), Math.round(by - spr.pivotY - bump));
      },
    });
  }

  // Placed Objects (Explosive Barrels & Cyber Barricades)
  for (const obj of e.placedObjects as PlacedObject[]) {
    const cx = toPx(obj.x + obj.w * 0.5);
    const cy = toPy(obj.y + obj.h * 0.5);
    if (cx < -24 || cx > pw + 24 || cy < -24 || cy > ph + 24) continue;
    depthList.push({
      sortY: obj.y + obj.h,
      draw: () => {
        if (obj.type === 'barrel') {
          drawDitherShadow(ctx, cx, cy + 2, 8, 5);
          const flash = obj.fuse !== undefined || (obj.hp < obj.maxHp && Math.floor(e.globalTime * 16) % 2 === 0);
          const spr = flash ? atlas.barrelDamaged : atlas.barrel;
          ctx.drawImage(spr.canvas, Math.round(cx - spr.pivotX), Math.round(cy - spr.pivotY));
        } else {
          drawDitherShadow(ctx, cx, cy + 2, 10, 6);
          const spr = atlas.barricade;
          ctx.drawImage(spr.canvas, Math.round(cx - spr.pivotX), Math.round(cy - spr.pivotY));
          // Show damage crack pixels if barricade is hurt
          if (obj.hp < obj.maxHp * 0.6) {
            ctx.fillStyle = '#ffbe0b';
            ctx.fillRect(cx - 3, cy - 6, 2, 2);
            ctx.fillRect(cx + 2, cy - 4, 2, 2);
          }
        }
      },
    });
  }

  // Bio-Monolith Central Floating Crystal Spire
  if (e.teleporter) {
    const tp = e.teleporter;
    const tx = toPx(tp.x);
    const ty = toPy(tp.y);
    if (tx > -48 && tx < pw + 48 && ty > -48 && ty < ph + 48) {
      depthList.push({
        sortY: tp.y + 8,
        draw: () => {
          const bob = Math.round(Math.sin(tp.pulsePhase * 3.5) * 3);
          const spr =
            tp.state === 'idle'
              ? atlas.crystalRed
              : tp.state === 'portal_open'
              ? atlas.crystalCyan
              : atlas.crystalGold;
          drawDitherShadow(ctx, tx, ty + 2, 9, 5);
          ctx.drawImage(spr.canvas, Math.round(tx - spr.pivotX), Math.round(ty - spr.pivotY - 7 + bob));
        },
      });
    }
  }

  // Pickups (ammo, medkit, star, relic crystal)
  for (const pk of e.pickups) {
    const px = toPx(pk.x);
    const py = toPy(pk.y);
    if (px < -16 || px > pw + 16 || py < -16 || py > ph + 16) continue;
    depthList.push({
      sortY: pk.y,
      draw: () => drawPixelPickup(ctx, pk, px, py, e.globalTime),
    });
  }

  // Enemies (3D sprite-stacked)
  for (const en of e.enemies) {
    const ex = toPx(en.x);
    const ey = toPy(en.y);
    const pad = en.isBoss ? 56 : 26;
    if (ex < -pad || ex > pw + pad || ey < -pad || ey > ph + pad) continue;
    depthList.push({
      sortY: en.y + en.radius * 0.3,
      draw: () => {
        const sr = Math.max(5, Math.round(en.radius * INV_SCALE));
        drawDitherShadow(ctx, ex, ey + 2, sr, Math.max(3, Math.round(sr * 0.58)));
        drawEnemyPixel(ctx, en, ex, ey, e.globalTime);
      },
    });
  }

  // Player (3D sprite-stacked Boxhead survivor)
  const p = e.player;
  if (!p.isDead) {
    const px = toPx(p.x);
    const py = toPy(p.y);
    depthList.push({
      sortY: p.y + p.radius * 0.3,
      draw: () => {
        drawDitherShadow(ctx, px, py + 2, 9, 5);
        const blink = p.invuln > 0 && p.starTime <= 0 && Math.floor(e.globalTime * 20) % 2 === 0;
        if (!blink) drawSurvivorPixel(ctx, p, px, py, e.globalTime);
        if (p.bladeStormTime > 0) drawPixelBladeStorm(ctx, p, px, py);
      },
    });
  }

  // Sort back-to-front by ground Y baseline
  depthList.sort((a, b) => a.sortY - b.sortY);
  for (let i = 0; i < depthList.length; i++) {
    depthList[i].draw();
  }

  // 6. Projectiles (crisp pixel bullets, rockets, grenades, orbs)
  drawPixelProjectiles(ctx, e, toPx, toPy, pw, ph);

  // 7. Particles, Expanding Pixel Shockwave Rings & Jagged Lightning Arcs
  drawPixelFx(ctx, e, toPx, toPy, pw, ph);

  // 8. Drifting Subtle Overhead Pixel Canopy Cloud Shadows (echoing Stack Horizon!)
  drawDriftingCloudShadows(ctx, e.globalTime, ox, oy, pw, ph);

  // 9. Crisp Pixel Floating Damage Numbers
  drawPixelDamageNumbers(ctx, e, toPx, toPy);

  // 10. Pixel Aim Crosshair & Low-HP Border Pulse
  drawScreenOverlays(ctx, e, pw, ph);
}

function drawPixelFloor(ctx: Ctx, e: any, floorTile: HTMLCanvasElement, ox: number, oy: number, pw: number, ph: number) {
  const tw = floorTile.width;
  const th = floorTile.height;
  const worldPxW = Math.round(e.worldWidth * INV_SCALE);
  const worldPxH = Math.round(e.worldHeight * INV_SCALE);

  const startX = Math.max(0, Math.floor(ox / tw) * tw);
  const endX = Math.min(worldPxW, ox + pw + tw);
  const startY = Math.max(0, Math.floor(oy / th) * th);
  const endY = Math.min(worldPxH, oy + ph + th);

  for (let wy = startY; wy < endY; wy += th) {
    for (let wx = startX; wx < endX; wx += tw) {
      ctx.drawImage(floorTile, wx - ox, wy - oy);
    }
  }

  // Pulsing pixel cyber-conduit nodes every 300px (= 600 world units)
  const step = 300;
  const t = e.globalTime;
  for (let x = 150; x < worldPxW; x += step) {
    const sx = x - ox;
    if (sx < -36 || sx > pw + 36) continue;
    for (let y = 150; y < worldPxH; y += step) {
      const sy = y - oy;
      if (sy < -36 || sy > ph + 36) continue;
      const pulse = Math.sin(t * 3 + x * 0.01 + y * 0.01) > 0;
      ctx.fillStyle = '#0e1726';
      ctx.fillRect(sx, sy, 30, 30);
      ctx.fillStyle = pulse ? '#1b4764' : '#133047';
      ctx.fillRect(sx + 2, sy + 2, 26, 26);
      ctx.fillStyle = pulse ? '#38e8ff' : '#1f88a8';
      ctx.fillRect(sx + 11, sy + 11, 8, 8);
      ctx.fillStyle = '#d4fcff';
      ctx.fillRect(sx + 13, sy + 13, 4, 4);
    }
  }
}

function drawPixelSplats(ctx: Ctx, e: any, toPx: (x: number) => number, toPy: (y: number) => number, pw: number, ph: number) {
  for (const s of e.bloodSplats as BloodSplat[]) {
    const sx = toPx(s.x);
    const sy = toPy(s.y);
    if (sx < -20 || sx > pw + 20 || sy < -20 || sy > ph + 20) continue;

    const r = Math.max(3, Math.round(s.radius * INV_SCALE * 0.65));
    ctx.globalAlpha = s.alpha;
    ctx.fillStyle = s.color;
    // Chunky stepped cross-core pixel splat
    ctx.fillRect(sx - r, sy - Math.floor(r * 0.6), r * 2, Math.max(2, Math.round(r * 1.2)));
    ctx.fillRect(sx - Math.floor(r * 0.6), sy - r, Math.max(2, Math.round(r * 1.2)), r * 2);

    // Deterministic pixel droplets around splat
    const seed = s.seed || 13;
    for (let i = 0; i < 4; i++) {
      const h = ((seed * (i + 3) * 16807) % 997) / 997;
      const ang = h * Math.PI * 2 + i * 1.6;
      const dist = r + 2 + ((seed + i * 7) % 4);
      const dx = Math.round(sx + Math.cos(ang) * dist);
      const dy = Math.round(sy + Math.sin(ang) * dist);
      ctx.fillRect(dx, dy, 2, 2);
    }
  }
  ctx.globalAlpha = 1;
}

/** Signature Stack-Horizon checkerboard dithered ground shadow */
function drawDitherShadow(ctx: Ctx, cx: number, cy: number, rx: number, ry: number) {
  ctx.fillStyle = 'rgba(6, 10, 18, 0.55)';
  const rxi = Math.max(2, Math.round(rx));
  const ryi = Math.max(1, Math.round(ry));
  for (let dy = -ryi; dy <= ryi; dy++) {
    const ny = dy / (ryi + 0.5);
    const halfSpan = Math.floor(rxi * Math.sqrt(Math.max(0, 1 - ny * ny)));
    const py = cy + dy;
    // Crisp horizontal span with dithered outer rim pixels
    if (halfSpan > 1) {
      ctx.fillRect(cx - halfSpan + 1, py, (halfSpan - 1) * 2, 1);
    }
    if (((cx + halfSpan + py) & 1) === 0) {
      ctx.fillRect(cx - halfSpan, py, 1, 1);
      ctx.fillRect(cx + halfSpan, py, 1, 1);
    }
  }
}

/** 2.5D Extruded Pixel-Art Bunker Wall with masonry face, top rivets, & cyber LED trim */
function drawPixelWall(ctx: Ctx, x: number, y: number, w: number, h: number, baseColor: string | undefined, stage: number) {
  const depth = 14; // 14 crisp pixels tall extrusion (= 28 world units)
  const topY = y - depth;

  // Stage-tinted cyber accent trim
  const trimCol = stage % 3 === 2 ? '#39ff7a' : stage % 3 === 0 ? '#ff4da6' : '#38e8ff';
  const topCol = baseColor || '#243352';

  // 1. Floor ambient occlusion shadow beneath front wall
  ctx.fillStyle = 'rgba(4, 7, 14, 0.55)';
  ctx.fillRect(x + 2, y + h, w, 4);

  // 2. Extruded 3D Front Masonry Face
  ctx.fillStyle = '#090d18';
  ctx.fillRect(x - 1, topY - 1, w + 2, h + depth + 2);

  ctx.fillStyle = '#141d30';
  ctx.fillRect(x, y + h - depth, w, depth);
  ctx.fillStyle = '#0e1524';
  ctx.fillRect(x, y + h - 4, w, 4);

  // Recessed pixel vertical ribs along front face
  ctx.fillStyle = '#1e2c48';
  for (let rx = x + 6; rx < x + w - 4; rx += 16) {
    ctx.fillRect(rx, y + h - depth + 2, 2, depth - 4);
  }
  // Glowing pixel LED strip across front face
  ctx.fillStyle = trimCol;
  ctx.fillRect(x + 2, y + h - 6, w - 4, 2);

  // 3. Raised 2.5D Top Plate
  ctx.fillStyle = topCol;
  ctx.fillRect(x, topY, w, h);

  // Crisp pixel highlight bevel (top & left) and shadow bevel (bottom & right)
  ctx.fillStyle = '#47618f';
  ctx.fillRect(x, topY, w, 2);
  ctx.fillRect(x, topY, 2, h);

  ctx.fillStyle = '#151f34';
  ctx.fillRect(x, topY + h - 2, w, 2);
  ctx.fillRect(x + w - 2, topY, 2, h);

  // Inner armor plate seam + corner bolts on wide bunker blocks
  if (w >= 28 && h >= 28) {
    ctx.fillStyle = '#19253d';
    ctx.fillRect(x + 5, topY + 5, w - 10, 1);
    ctx.fillRect(x + 5, topY + h - 6, w - 10, 1);
    ctx.fillRect(x + 5, topY + 5, 1, h - 10);
    ctx.fillRect(x + w - 6, topY + 5, 1, h - 10);

    ctx.fillStyle = '#6f8bb8';
    ctx.fillRect(x + 3, topY + 3, 2, 2);
    ctx.fillRect(x + w - 5, topY + 3, 2, 2);
    ctx.fillRect(x + 3, topY + h - 5, 2, 2);
    ctx.fillRect(x + w - 5, topY + h - 5, 2, 2);
  }

  // Crisp top cyan edge highlight on front lip
  ctx.fillStyle = trimCol;
  ctx.fillRect(x + 1, topY + h - 2, w - 2, 1);
}

function drawWarpPipes(ctx: Ctx, e: any, pipeSprite: any, toPx: (x: number) => number, toPy: (y: number) => number, pw: number, ph: number) {
  const t = e.globalTime;
  for (const pipe of e.pipes as WarpPipe[]) {
    const px = toPx(pipe.x);
    const py = toPy(pipe.y);
    if (px < -30 || px > pw + 30 || py < -30 || py > ph + 30) continue;

    drawDitherShadow(ctx, px, py + 3, 18, 12);
    ctx.drawImage(pipeSprite.canvas, Math.round(px - pipeSprite.pivotX), Math.round(py - pipeSprite.pivotY));

    // Rotating pixel vortex sparkles inside warp pipe mouth
    ctx.fillStyle = '#5dffad';
    for (let i = 0; i < 4; i++) {
      const a = t * 3.5 + (i * Math.PI) / 2;
      const vx = Math.round(px + Math.cos(a) * 6);
      const vy = Math.round(py - 8 + Math.sin(a) * 4);
      ctx.fillRect(vx, vy, 2, 2);
    }
  }
}

function drawTeleporterBase(ctx: Ctx, e: any, toPx: (x: number) => number, toPy: (y: number) => number) {
  const tp = e.teleporter;
  if (!tp) return;
  const tx = toPx(tp.x);
  const ty = toPy(tp.y);
  const col = tp.state === 'idle' ? '#ff4455' : tp.state === 'portal_open' ? '#38e8ff' : '#ffbe0b';

  // Pixelated charging boundary ring (stepped pixel dots around radius!)
  if (tp.state !== 'idle') {
    const r = Math.round(tp.radius * INV_SCALE);
    const dotCount = 48;
    ctx.fillStyle = col;
    for (let i = 0; i < dotCount; i++) {
      const a = tp.pulsePhase * 0.6 + (i * Math.PI * 2) / dotCount;
      const rx = Math.round(tx + Math.cos(a) * r);
      const ry = Math.round(ty + Math.sin(a) * r);
      ctx.fillRect(rx - 1, ry - 1, 3, 3);
    }
  }

  // Stepped 2.5D octagonal altar pad on the bunker floor
  ctx.fillStyle = '#090d18';
  ctx.fillRect(tx - 24, ty - 18, 48, 36);
  ctx.fillStyle = '#1b2640';
  ctx.fillRect(tx - 22, ty - 16, 44, 32);
  ctx.fillStyle = '#28385c';
  ctx.fillRect(tx - 18, ty - 12, 36, 24);
  // Crisp glowing monolith trim frame
  ctx.fillStyle = col;
  ctx.fillRect(tx - 22, ty - 16, 44, 2);
  ctx.fillRect(tx - 22, ty + 14, 44, 2);
  ctx.fillRect(tx - 22, ty - 16, 2, 32);
  ctx.fillRect(tx + 20, ty - 16, 2, 32);

  // [E] prompt pixel badge when player is near idle/open monolith
  if (e.player && Math.hypot(e.player.x - tp.x, e.player.y - tp.y) < 155) {
    if (tp.state === 'idle' || tp.state === 'portal_open') {
      const label = tp.state === 'idle' ? '[E] ACTIVATE MONOLITH' : '[E] ENTER PORTAL';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      const w = label.length * 5 + 10;
      ctx.fillStyle = '#090d18';
      ctx.fillRect(Math.round(tx - w / 2), ty - 38, w, 12);
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(tx - w / 2), ty - 38, w, 1);
      ctx.fillRect(Math.round(tx - w / 2), ty - 27, w, 1);
      ctx.fillText(label, tx, ty - 29);
    }
  }
}

function drawPixelPickup(ctx: Ctx, pk: any, px: number, py: number, t: number) {
  const bob = Math.round(Math.sin(t * 5 + pk.x * 0.05) * 2);
  const y = py - 3 + bob;
  drawDitherShadow(ctx, px, py + 2, 6, 3);

  if (pk.kind === 'ammo') {
    // Golden pixel ammo crate
    ctx.fillStyle = '#090d18';
    ctx.fillRect(px - 6, y - 5, 12, 10);
    ctx.fillStyle = '#e89a14';
    ctx.fillRect(px - 5, y - 4, 10, 8);
    ctx.fillStyle = '#ffe066';
    ctx.fillRect(px - 5, y - 4, 10, 3);
    ctx.fillStyle = '#241a08';
    ctx.fillRect(px - 1, y - 2, 2, 4);
  } else if (pk.kind === 'heal') {
    // Crisp pixel medkit with bright green cross
    ctx.fillStyle = '#090d18';
    ctx.fillRect(px - 6, y - 5, 12, 10);
    ctx.fillStyle = '#eff6ff';
    ctx.fillRect(px - 5, y - 4, 10, 8);
    ctx.fillStyle = '#18d868';
    ctx.fillRect(px - 1, y - 3, 2, 6);
    ctx.fillRect(px - 3, y - 1, 6, 2);
  } else if (pk.kind === 'star') {
    // Flashing pixel Starman
    const col = Math.floor(t * 14) % 2 === 0 ? '#ffe844' : '#ffffff';
    ctx.fillStyle = '#090d18';
    ctx.fillRect(px - 5, y - 5, 10, 10);
    ctx.fillStyle = col;
    ctx.fillRect(px - 1, y - 5, 2, 10);
    ctx.fillRect(px - 5, y - 1, 10, 2);
    ctx.fillRect(px - 3, y - 3, 6, 6);
  } else {
    // Floating Relic Cache Crystal + vertical pixel beacon beam (just like Stack Horizon!)
    const isBoss = pk.kind === 'boss_relic';
    const col = isBoss ? '#ff3385' : '#48f5d6';
    const core = isBoss ? '#ffe066' : '#e0fffb';
    // Shimmering vertical pixel beacon
    ctx.fillStyle = col;
    for (let by = y - 36; by < y - 6; by += 3) {
      ctx.fillRect(px, by, 1, 2);
    }
    ctx.fillStyle = '#090d18';
    ctx.fillRect(px - 5, y - 7, 10, 14);
    ctx.fillStyle = col;
    ctx.fillRect(px - 4, y - 5, 8, 10);
    ctx.fillRect(px - 2, y - 6, 4, 12);
    ctx.fillStyle = core;
    ctx.fillRect(px - 2, y - 2, 4, 4);
  }
}

function drawPixelProjectiles(ctx: Ctx, e: any, toPx: (x: number) => number, toPy: (y: number) => number, pw: number, ph: number) {
  for (const pr of e.projectiles) {
    const px = toPx(pr.x);
    const py = toPy(pr.y);
    if (px < -16 || px > pw + 16 || py < -16 || py > ph + 16) continue;

    if (pr.kind === 'bolt') {
      // Crisp 2-tone pixel laser bolt
      const len = 7;
      const spd = Math.hypot(pr.vx, pr.vy) || 1;
      const dx = pr.vx / spd;
      const dy = pr.vy / spd;
      ctx.fillStyle = pr.color;
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(Math.round(px + dx * i * 1.4) - 1, Math.round(py + dy * i * 1.4) - 1, 3, 3);
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px - 1, py - 1, 2, 2);
      void len;
    } else if (pr.kind === 'pellet') {
      ctx.fillStyle = '#090d18';
      ctx.fillRect(px - 2, py - 2, 5, 5);
      ctx.fillStyle = '#ff8a24';
      ctx.fillRect(px - 1, py - 1, 3, 3);
      ctx.fillStyle = '#fff2a6';
      ctx.fillRect(px, py, 1, 1);
    } else if (pr.kind === 'rocket') {
      ctx.fillStyle = '#090d18';
      ctx.fillRect(px - 4, py - 4, 9, 9);
      ctx.fillStyle = '#ef2b2b';
      ctx.fillRect(px - 3, py - 3, 7, 7);
      ctx.fillStyle = '#ffde59';
      ctx.fillRect(px - 1, py - 1, 3, 3);
    } else if (pr.kind === 'grenade') {
      ctx.fillStyle = '#090d18';
      ctx.fillRect(px - 4, py - 4, 8, 8);
      ctx.fillStyle = '#39ff14';
      ctx.fillRect(px - 3, py - 3, 6, 6);
      ctx.fillStyle = '#e5ffdb';
      ctx.fillRect(px - 1, py - 2, 2, 2);
    } else {
      // Enemy plasma / acid / boss fire orb
      const r = Math.max(3, Math.round((pr.r || 8) * INV_SCALE));
      ctx.fillStyle = '#090d18';
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
      ctx.fillStyle = pr.color;
      ctx.fillRect(px - r + 1, py - r + 1, r * 2 - 2, r * 2 - 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px - 1, py - 1, 2, 2);
    }
  }
}

function drawPixelFx(ctx: Ctx, e: any, toPx: (x: number) => number, toPy: (y: number) => number, pw: number, ph: number) {
  // Crisp square pixel particles
  for (const pt of e.particles) {
    const px = toPx(pt.x);
    const py = toPy(pt.y);
    if (px < -8 || px > pw + 8 || py < -8 || py > ph + 8) continue;
    const sz = Math.max(1, Math.round(pt.size * INV_SCALE));
    ctx.globalAlpha = pt.alpha;
    ctx.fillStyle = pt.color;
    ctx.fillRect(px - (sz >> 1), py - (sz >> 1), sz, sz);
  }
  ctx.globalAlpha = 1;

  // Expanding pixel-stepped shockwave rings (no smooth blurry arcs!)
  for (const r of e.rings) {
    const cx = toPx(r.x);
    const cy = toPy(r.y);
    const rad = Math.max(2, Math.round(r.r * INV_SCALE));
    if (cx + rad < 0 || cx - rad > pw || cy + rad < 0 || cy - rad > ph) continue;

    ctx.globalAlpha = Math.max(0.15, r.life / r.maxLife);
    ctx.fillStyle = r.color;
    const steps = Math.max(16, Math.min(48, rad * 2));
    for (let i = 0; i < steps; i++) {
      const a = (i * Math.PI * 2) / steps;
      ctx.fillRect(Math.round(cx + Math.cos(a) * rad) - 1, Math.round(cy + Math.sin(a) * rad) - 1, 2, 2);
    }
  }
  ctx.globalAlpha = 1;

  // Jagged pixel lightning arcs (Bresenham-style pixel steps)
  for (const a of e.arcs) {
    ctx.fillStyle = a.color;
    for (let i = 0; i < a.pts.length - 1; i++) {
      const x0 = toPx(a.pts[i].x);
      const y0 = toPy(a.pts[i].y);
      const x1 = toPx(a.pts[i + 1].x);
      const y1 = toPy(a.pts[i + 1].y);
      const dist = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
      for (let s = 0; s <= dist; s += 2) {
        const t = s / dist;
        ctx.fillRect(Math.round(x0 + (x1 - x0) * t) - 1, Math.round(y0 + (y1 - y0) * t) - 1, 2, 2);
      }
    }
  }
}

function drawPixelBladeStorm(ctx: Ctx, p: any, px: number, py: number) {
  for (let i = 0; i < 12; i++) {
    const a = p.bladeAngle + (i * Math.PI * 2) / 12;
    const bx = Math.round(px + Math.cos(a) * 46);
    const by = Math.round(py - 4 + Math.sin(a) * 38);
    ctx.fillStyle = '#090d18';
    ctx.fillRect(bx - 4, by - 4, 8, 8);
    ctx.fillStyle = '#ff2bd6';
    ctx.fillRect(bx - 3, by - 3, 6, 6);
    ctx.fillStyle = '#ffd6f7';
    ctx.fillRect(bx - 1, by - 1, 2, 2);
  }
}

/** Subtle drifting overhead canopy/cloud shadows tying atmosphere to Stack Horizon */
function drawDriftingCloudShadows(ctx: Ctx, t: number, ox: number, oy: number, pw: number, ph: number) {
  ctx.fillStyle = 'rgba(6, 12, 24, 0.14)';
  const driftX = t * 14;
  const driftY = t * 5;
  for (let i = 0; i < 6; i++) {
    const wx = ((i * 290 + driftX) % 1400) - 100 - ox;
    const wy = ((i * 210 + driftY) % 1000) - 80 - oy;
    if (wx < -120 || wx > pw + 120 || wy < -80 || wy > ph + 80) continue;
    const cx = Math.round(wx);
    const cy = Math.round(wy);
    ctx.fillRect(cx - 32, cy - 12, 64, 24);
    ctx.fillRect(cx - 20, cy - 20, 40, 40);
  }
}

function drawPixelDamageNumbers(ctx: Ctx, e: any, toPx: (x: number) => number, toPy: (y: number) => number) {
  ctx.textAlign = 'center';
  for (const dn of e.damageNumbers) {
    if (!dn.text || dn.text === 'NaN' || dn.text.includes('NaN')) continue;
    const px = toPx(dn.x);
    const py = toPy(dn.y);
    const size = Math.max(7, Math.min(14, Math.round(8 * dn.scale)));
    ctx.globalAlpha = Math.min(1, (dn.life / dn.maxLife) * 1.6);
    ctx.font = `900 ${size}px monospace`;
    // Crisp 1px hard retro pixel drop shadow (no blurry stroke)
    ctx.fillStyle = '#060911';
    ctx.fillText(dn.text, px + 1, py + 1);
    ctx.fillText(dn.text, px - 1, py);
    ctx.fillStyle = dn.color;
    ctx.fillText(dn.text, px, py);
  }
  ctx.globalAlpha = 1;
}

function drawScreenOverlays(ctx: Ctx, e: any, pw: number, ph: number) {
  const p = e.player;
  // Low-HP crisp pulsing pixel frame border
  if (p && !p.isDead && p.hp / p.maxHp < 0.3) {
    const thick = Math.sin(e.globalTime * 10) > 0 ? 4 : 2;
    ctx.fillStyle = 'rgba(255, 32, 64, 0.55)';
    ctx.fillRect(0, 0, pw, thick);
    ctx.fillRect(0, ph - thick, pw, thick);
    ctx.fillRect(0, 0, thick, ph);
    ctx.fillRect(pw - thick, 0, thick, ph);
  }

  // Crisp pixel aiming crosshair in manual mode
  if (e.running && !e.pausedForUpgrade && !e.ai.enabled) {
    const rect = e.canvas.getBoundingClientRect();
    const mx = Math.round(((e.mouseScreen.x - rect.left) / Math.max(1, rect.width)) * pw);
    const my = Math.round(((e.mouseScreen.y - rect.top) / Math.max(1, rect.height)) * ph);
    if (mx >= 0 && mx < pw && my >= 0 && my < ph) {
      ctx.fillStyle = '#090d18';
      ctx.fillRect(mx - 6, my - 1, 4, 3);
      ctx.fillRect(mx + 3, my - 1, 4, 3);
      ctx.fillRect(mx - 1, my - 6, 3, 4);
      ctx.fillRect(mx - 1, my + 3, 3, 4);
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(mx - 5, my, 3, 1);
      ctx.fillRect(mx + 3, my, 3, 1);
      ctx.fillRect(mx, my - 5, 1, 3);
      ctx.fillRect(mx, my + 3, 1, 3);
      ctx.fillStyle = '#00f3ff';
      ctx.fillRect(mx, my, 1, 1);
    }
  }

  // AI Auto-Pilot indicator banner
  if (e.ai.enabled && e.running) {
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    const msg = 'AI AUTO-PILOT ACTIVE  [F4] MANUAL CONTROL';
    const bw = msg.length * 5 + 14;
    ctx.fillStyle = 'rgba(10, 14, 24, 0.85)';
    ctx.fillRect(Math.round(pw / 2 - bw / 2), ph - 58, bw, 12);
    ctx.fillStyle = '#ff4de1';
    ctx.fillText(msg, Math.round(pw / 2), ph - 49);
  }
}
