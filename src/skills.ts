import { soundEngine } from './audio';

export function castSpecialSkill(engine: any): boolean {
  const p = engine.player;
  if (!p || p.isDead || p.cdSpecial > 0) return false;

  const id = p.def.id;
  const sk = p.def.specialSkill;

  if (id === 'vanguard') {
    // Starman Overdrive
    p.triggerInvincibility(5);
    engine.addDamageNumber(p.x, p.y - 40, '★ STAR OVERDRIVE! ★', '#ffff00', 1.6);
    engine.spawnBurst(p.x, p.y, '#ffff00', 30, 320);
    soundEngine.playRelicPickup();
  } else if (id === 'phantom') {
    // Tesla Singularity Vortex
    const targetX = p.x + Math.cos(p.aimAngle) * 250;
    const targetY = p.y + Math.sin(p.aimAngle) * 250;
    engine.createVortex(targetX, targetY, 260, p.def.baseDamage * 2.2, 4.0);
    soundEngine.playBossRoar();
  } else if (id === 'huntress') {
    // Blade Storm
    p.bladeStormTime = 5.0;
    engine.spawnBurst(p.x, p.y, '#ff2bd6', 25, 260);
    soundEngine.playRelicPickup();
  }

  p.cdSpecial = sk.cd;
  return true;
}
