// CYBER-SPORE 207 // 2.5D Pixel-Art Sprite-Stacked Enemy Renderer
// Zero ctx.shadowBlur, zero ctx.filter — pure pre-baked 3D stacked pixel sprites!
import { getPixelAtlas, pickAngleSprite } from './pixelArt';

type Ctx = CanvasRenderingContext2D;

export function drawEnemyPixel(ctx: Ctx, en: any, px: number, py: number, t: number) {
  const atlas = getPixelAtlas();
  const animFrames = atlas.enemies[en.type as keyof typeof atlas.enemies] || atlas.enemies.goomba;
  const frameIdx = animFrames.length > 1 ? (Math.floor(en.anim * 0.9) % animFrames.length) : 0;
  const sprite = pickAngleSprite(animFrames[frameIdx], en.facingAngle);

  // Subtle hovering bob for flying wisps or heavy walk hop for ground units
  let bobY = 0;
  if (en.type === 'wisp') {
    bobY = -3 + Math.round(Math.sin(t * 6 + en.anim) * 2);
  } else if (en.type === 'bowser_boss') {
    bobY = en.state === 'stomp'
      ? -Math.round(Math.sin(Math.max(0, en.stateTimer) * Math.PI) * 7)
      : -Math.abs(Math.round(Math.sin(en.anim * 0.7) * 1.5));
  } else {
    bobY = -Math.abs(Math.round(Math.sin(en.anim * 1.4)));
  }

  const img = en.hitFlash > 0 ? sprite.flashCanvas : sprite.canvas;

  if (en.type === 'bowser_boss') {
    const w = Math.round(img.width * 1.45);
    const h = Math.round(img.height * 1.45);
    const dx = Math.round(px - sprite.pivotX * 1.45);
    const dy = Math.round(py - sprite.pivotY * 1.45 + bobY);
    ctx.drawImage(img, dx, dy, w, h);

    if (en.state === 'flamethrower') {
      const mx = Math.round(px + Math.cos(en.facingAngle) * 22);
      const my = Math.round(py + Math.sin(en.facingAngle) * 18 - 10);
      ctx.fillStyle = '#00f3ff';
      ctx.fillRect(mx - 4, my - 4, 8, 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(mx - 2, my - 2, 4, 4);
    }
  } else {
    const dx = Math.round(px - sprite.pivotX);
    const dy = Math.round(py - sprite.pivotY + bobY);
    ctx.drawImage(img, dx, dy);
  }

  // Status effect pixel indicators (Dead Cells burn / bleed readability!)
  if (en.burnTime > 0) {
    const fy = Math.round(py - 12 - ((t * 16 + en.x) % 6));
    const fx = Math.round(px + Math.sin(t * 12 + en.y) * 4);
    ctx.fillStyle = '#ff6a00';
    ctx.fillRect(fx - 2, fy, 3, 3);
    ctx.fillStyle = '#ffe066';
    ctx.fillRect(fx - 1, fy + 1, 1, 2);
  }
  if (en.bleedTime > 0) {
    const by = Math.round(py - 6 + ((t * 14 + en.y) % 6));
    ctx.fillStyle = '#ff1e56';
    ctx.fillRect(Math.round(px + 5), by, 2, 3);
    ctx.fillRect(Math.round(px - 6), by - 2, 2, 2);
  }

  // Crisp pixel-framed HP Bar above damaged enemies
  if (en.hp < en.maxHp) {
    const barW = en.isBoss ? 56 : Math.max(18, Math.round(en.radius));
    const barH = en.isBoss ? 4 : 3;
    const yOff = en.isBoss ? 44 : Math.round(en.radius * 0.65) + 12;
    const bx = Math.round(px - barW * 0.5);
    const by = Math.round(py - yOff);

    ctx.fillStyle = '#090d18';
    ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
    ctx.fillStyle = '#241422';
    ctx.fillRect(bx, by, barW, barH);
    const fillW = Math.max(1, Math.round(barW * Math.max(0, en.hp / en.maxHp)));
    ctx.fillStyle = en.isBoss ? '#ff2a7a' : '#ff3b3b';
    ctx.fillRect(bx, by, fillW, barH);
  }
}
