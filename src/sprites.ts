// CYBER-SPORE 207 // 2.5D Pixel-Art Sprite-Stacked Boxhead Survivor & Weapons Renderer
// Zero ctx.shadowBlur, zero ctx.filter — crisp integer-snapped pixel art!
import { getPixelAtlas, pickAngleSprite } from './pixelArt';
import type { SurvivorId } from './types';

type Ctx = CanvasRenderingContext2D;

export function drawSurvivorPixel(ctx: Ctx, p: any, px: number, py: number, t: number) {
  const atlas = getPixelAtlas();
  const id = (p.def?.id || 'vanguard') as SurvivorId;
  const sprite = pickAngleSprite(atlas.survivors[id] || atlas.survivors.vanguard, p.aimAngle);
  const star = p.starTime > 0;

  // Subtle laser-dot sight line (crisp pixel steps, no blurry lines)
  const cosA = Math.cos(p.aimAngle);
  const sinA = Math.sin(p.aimAngle);
  ctx.fillStyle = 'rgba(0, 243, 255, 0.35)';
  for (let d = 14; d < 120; d += 8) {
    ctx.fillRect(Math.round(px + cosA * d), Math.round(py - 5 + sinA * d), 1, 1);
  }

  // Starman Overdrive rainbow pixel ring beneath feet
  if (star) {
    const hue = Math.floor((t * 420) % 360);
    ctx.fillStyle = `hsl(${hue}, 95%, 60%)`;
    for (let i = 0; i < 12; i++) {
      const a = t * 6 + (i * Math.PI * 2) / 12;
      ctx.fillRect(Math.round(px + Math.cos(a) * 14) - 1, Math.round(py + Math.sin(a) * 10) - 1, 2, 2);
    }
  }

  // Subtle walk bounce
  const bobY = Math.hypot(p.vx, p.vy) > 12 ? -Math.abs(Math.round(Math.sin(p.walkAnim) * 1.5)) : 0;

  // Draw pre-baked 3D stacked Boxhead survivor (white flash on hurt / star flicker)
  const useFlash = p.hurtFlash > 0 || (star && Math.floor(t * 18) % 2 === 0);
  const img = useFlash ? sprite.flashCanvas : sprite.canvas;
  ctx.drawImage(img, Math.round(px - sprite.pivotX), Math.round(py - sprite.pivotY + bobY));

  // Draw crisp pixel-art active weapon in survivor's hands
  drawPixelWeapon(ctx, p.currentWeapon, px, py - 5 + bobY, p.aimAngle, p.fireCooldown);
}

function drawPixelWeapon(ctx: Ctx, weapon: any, cx: number, cy: number, angle: number, cd: number) {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const perpX = -sinA;
  const perpY = cosA;
  const isFiring = cd > 0.02;

  const plotBarrel = (fwdStart: number, fwdEnd: number, sideOffset: number, thickness: number, col: string) => {
    ctx.fillStyle = col;
    const steps = Math.max(2, Math.ceil((fwdEnd - fwdStart) * 1.5));
    for (let i = 0; i <= steps; i++) {
      const f = fwdStart + ((fwdEnd - fwdStart) * i) / steps;
      const x = Math.round(cx + cosA * f + perpX * sideOffset - thickness * 0.5);
      const y = Math.round(cy + sinA * f + perpY * sideOffset - thickness * 0.5);
      ctx.fillRect(x, y, thickness, thickness);
    }
  };

  const drawMuzzleFlash = (fwd: number, side: number, size: number, outerCol: string, innerCol: string) => {
    const mx = Math.round(cx + cosA * fwd + perpX * side);
    const my = Math.round(cy + sinA * fwd + perpY * side);
    ctx.fillStyle = outerCol;
    ctx.fillRect(mx - size, my - 1, size * 2 + 1, 3);
    ctx.fillRect(mx - 1, my - size, 3, size * 2 + 1);
    ctx.fillStyle = innerCol;
    const inner = Math.max(1, size - 2);
    ctx.fillRect(mx - inner, my - inner, inner * 2 + 1, inner * 2 + 1);
  };

  switch (weapon.type) {
    case 'pistol': {
      plotBarrel(5, 13, -5, 2, '#94a8c4');
      plotBarrel(5, 13, 5, 2, '#94a8c4');
      plotBarrel(11, 13, -5, 2, '#00f3ff');
      plotBarrel(11, 13, 5, 2, '#00f3ff');
      if (isFiring) {
        drawMuzzleFlash(15, -5, 3, '#00f3ff', '#ffffff');
        drawMuzzleFlash(15, 5, 3, '#00f3ff', '#ffffff');
      }
      break;
    }
    case 'shotgun': {
      plotBarrel(4, 16, 1, 3, '#3b4860');
      plotBarrel(12, 16, 1, 3, '#ff7a1a');
      if (isFiring) {
        drawMuzzleFlash(19, 1, 5, '#ff6a00', '#ffee66');
      }
      break;
    }
    case 'smg': {
      plotBarrel(4, 14, 1, 2, '#647996');
      plotBarrel(9, 14, 1, 2, '#4eefff');
      if (isFiring) {
        drawMuzzleFlash(16, 1, 3, '#38e8ff', '#ffffff');
      }
      break;
    }
    case 'grenade': {
      const gx = Math.round(cx + cosA * 10);
      const gy = Math.round(cy + sinA * 10);
      ctx.fillStyle = '#090d18';
      ctx.fillRect(gx - 3, gy - 3, 6, 6);
      ctx.fillStyle = '#39ff14';
      ctx.fillRect(gx - 2, gy - 2, 4, 4);
      ctx.fillStyle = '#d4ffbf';
      ctx.fillRect(gx - 1, gy - 1, 2, 2);
      break;
    }
    case 'rocket': {
      plotBarrel(-2, 17, -5, 4, '#2d374c');
      plotBarrel(14, 18, -5, 4, '#ef3b3b');
      if (isFiring) {
        drawMuzzleFlash(21, -5, 6, '#ff4400', '#ffee55');
      }
      break;
    }
    case 'barrel': {
      const bx = Math.round(cx + cosA * 12);
      const by = Math.round(cy + sinA * 12);
      ctx.fillStyle = '#090d18';
      ctx.fillRect(bx - 5, by - 5, 10, 10);
      ctx.fillStyle = '#e02c2c';
      ctx.fillRect(bx - 4, by - 4, 8, 8);
      ctx.fillStyle = '#ffbe0b';
      ctx.fillRect(bx - 4, by - 1, 8, 2);
      break;
    }
    case 'barricade': {
      const bx = Math.round(cx + cosA * 12);
      const by = Math.round(cy + sinA * 12);
      ctx.fillStyle = '#090d18';
      ctx.fillRect(bx - 5, by - 5, 10, 10);
      ctx.fillStyle = '#2eeeff';
      ctx.fillRect(bx - 4, by - 4, 8, 8);
      ctx.fillStyle = '#15253d';
      ctx.fillRect(bx - 2, by - 2, 4, 4);
      break;
    }
  }
}

export { drawEnemyPixel } from './enemySprites';
