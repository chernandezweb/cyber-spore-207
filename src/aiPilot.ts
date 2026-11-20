// Top-Down Boxhead AI Auto-Pilot & Automated Tester
export class AIPilot {
  public enabled: boolean = false;
  private actionTimer = 0;
  private weaponSwitchCooldown = 0;
  private dashCooldown = 0;

  public toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  public update(engine: any, dt: number) {
    if (!this.enabled || !engine.player || engine.player.isDead) return;

    const p = engine.player;
    this.actionTimer -= dt;
    this.weaponSwitchCooldown -= dt;
    this.dashCooldown -= dt;

    // Reset inputs
    engine.input.left = false;
    engine.input.right = false;
    engine.input.up = false;
    engine.input.down = false;
    engine.input.fire = false;
    engine.input.dash = false;
    engine.input.special = false;
    engine.input.interact = false;
    engine.input.placeBarrel = false;
    engine.input.placeBarricade = false;

    // Find nearest threat
    let nearestEnemy: any = null;
    let minDist = 999999;
    let clusterCount = 0;

    for (const en of engine.enemies) {
      if (en.isDead) continue;
      const d = Math.hypot(en.x - p.x, en.y - p.y);
      if (d < minDist) {
        minDist = d;
        nearestEnemy = en;
      }
      if (d < 300) clusterCount++;
    }

    if (nearestEnemy) {
      // Aim at nearest enemy
      engine.input.mouseX = nearestEnemy.x;
      engine.input.mouseY = nearestEnemy.y;

      // Always shoot
      engine.input.fire = true;

      // Weapon switching logic (respects unlocked arsenal)
      if (this.weaponSwitchCooldown <= 0) {
        if (clusterCount >= 5 && p.weapons.rocket.unlocked && p.weapons.rocket.ammo > 0 && minDist > 180) {
          p.selectWeapon(4); // Rockets
          this.weaponSwitchCooldown = 1.0;
        } else if (clusterCount >= 3 && p.weapons.shotgun.unlocked && p.weapons.shotgun.ammo > 0 && minDist < 240) {
          p.selectWeapon(1); // Shotgun
          this.weaponSwitchCooldown = 0.8;
        } else if (p.weapons.smg.unlocked && p.weapons.smg.ammo > 0) {
          p.selectWeapon(2); // SMG
          this.weaponSwitchCooldown = 0.6;
        } else {
          p.selectWeapon(0); // Pistols
          this.weaponSwitchCooldown = 0.5;
        }
      }

      // Kiting movement (move away from enemy if too close, or circle around)
      const dx = nearestEnemy.x - p.x;
      const dy = nearestEnemy.y - p.y;

      if (minDist < 180) {
        // Back away
        if (dx > 0) engine.input.left = true;
        else engine.input.right = true;
        if (dy > 0) engine.input.up = true;
        else engine.input.down = true;

        // Place a barrel to trap incoming swarm!
        if (Math.random() < 0.05 && p.weapons.barrel.ammo > 0) {
          engine.input.placeBarrel = true;
        }

        // Dodge dash if critically close
        if (minDist < 90 && this.dashCooldown <= 0) {
          engine.input.dash = true;
          this.dashCooldown = 2.0;
        }
      } else {
        // Strafe around
        if (Math.abs(dx) > Math.abs(dy)) {
          if (dy > 0) engine.input.up = true;
          else engine.input.down = true;
        } else {
          if (dx > 0) engine.input.left = true;
          else engine.input.right = true;
        }
      }

      // Use special skill if swarmed or boss active
      if (nearestEnemy.isBoss || clusterCount >= 6) {
        engine.input.special = true;
      }
    } else {
      // Seek Question Blocks or Teleporter
      let nearestBlock: any = null;
      let minBlockDist = 999999;
      for (const b of engine.blocks) {
        if (b.hit) continue;
        const d = Math.hypot(b.x - p.x, b.y - p.y);
        if (d < minBlockDist) {
          minBlockDist = d;
          nearestBlock = b;
        }
      }

      if (nearestBlock && minBlockDist < 500) {
        engine.input.mouseX = nearestBlock.x + 22;
        engine.input.mouseY = nearestBlock.y + 22;
        engine.input.fire = true;

        const bx = (nearestBlock.x + 22) - p.x;
        const by = (nearestBlock.y + 22) - p.y;
        if (Math.abs(bx) > 20) {
          if (bx > 0) engine.input.right = true;
          else engine.input.left = true;
        }
        if (Math.abs(by) > 20) {
          if (by > 0) engine.input.down = true;
          else engine.input.up = true;
        }
      } else if (engine.teleporter) {
        // Move toward Teleporter
        const tp = engine.teleporter;
        const tx = tp.x - p.x;
        const ty = tp.y - p.y;
        const td = Math.hypot(tx, ty);

        if (td > 80) {
          if (tx > 20) engine.input.right = true;
          else if (tx < -20) engine.input.left = true;
          if (ty > 20) engine.input.down = true;
          else if (ty < -20) engine.input.up = true;
        } else {
          engine.tryActivateTeleporter();
        }
      }
    }
  }
}
