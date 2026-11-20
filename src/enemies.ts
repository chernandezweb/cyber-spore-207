import type { EnemyType } from './types';
import { soundEngine } from './audio';

interface EnemyBase {
  radius: number;
  hp: number;
  damage: number;
  speed: number;
  xp: number;
  coins: number;
  flying: boolean;
}

const BASE: Record<EnemyType, EnemyBase> = {
  goomba: { radius: 18, hp: 42, damage: 12, speed: 110, xp: 12, coins: 4, flying: false },
  koopa: { radius: 22, hp: 95, damage: 16, speed: 175, xp: 24, coins: 8, flying: false },
  wisp: { radius: 18, hp: 60, damage: 14, speed: 130, xp: 20, coins: 6, flying: true },
  piranha: { radius: 24, hp: 130, damage: 18, speed: 70, xp: 30, coins: 10, flying: false },
  bowser_boss: { radius: 65, hp: 3200, damage: 32, speed: 100, xp: 600, coins: 150, flying: false },
};

export class Enemy {
  type: EnemyType;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  radius: number;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  xpValue: number;
  coinValue: number;
  flying: boolean;
  isBoss: boolean;
  isDead = false;

  facingAngle = 0;
  burnTime = 0;
  burnDps = 0;
  bleedTime = 0;
  bleedDps = 0;
  dotTick = 0;
  hitFlash = 0;
  anim = Math.random() * 10;
  state = 'chase';
  stateTimer = 0;
  attackTimer = 1.0 + Math.random();
  breathShots = 0;

  // Wall-avoidance steering state (prevents mobs getting stuck on bunkers/pillars)
  avoidTimer = 0;
  avoidVx = 0;
  avoidVy = 0;
  private lastBlockWall: any = null;

  constructor(type: EnemyType, x: number, y: number, coeff: number, stage = 1) {
    const b = BASE[type];
    this.type = type;
    this.x = x;
    this.y = y;
    this.radius = b.radius;
    // Exponential late-game scaling so Stage 3+ stays intense & challenging
    const c = Math.max(1, coeff);
    const hpScale = Math.pow(c, 1.48) * (1 + (stage - 1) * 0.35);
    const dmgScale = 1 + 0.32 * (c - 1) + (stage - 1) * 0.25;
    const speedScale = 1 + Math.min(0.60, (c - 1) * 0.065 + (stage - 1) * 0.05);
    this.maxHp = Math.round(b.hp * hpScale);
    this.hp = this.maxHp;
    this.damage = Math.round(b.damage * dmgScale);
    this.speed = b.speed * speedScale * (0.92 + Math.random() * 0.2);
    this.xpValue = Math.round(b.xp * (1 + 0.12 * (c - 1)));
    this.coinValue = Math.round(b.coins * (1 + 0.25 * (c - 1)));
    this.flying = b.flying;
    this.isBoss = type === 'bowser_boss';
  }

  /** Called by engine.moveCircle when a ground mob is blocked by a wall face */
  notifyWallBlock(wall: { x: number; y: number; w: number; h: number }, axis: 'x' | 'y') {
    // Keep committed direction if we're already rounding this same wall
    if (this.avoidTimer > 0.2 && this.lastBlockWall === wall) return;
    this.lastBlockWall = wall;
    this.avoidTimer = 0.65;

    if (axis === 'x') {
      // Blocked horizontally -> steer vertically toward the nearest open end of the wall
      const distTop = Math.abs(this.y - wall.y);
      const distBot = Math.abs(wall.y + wall.h - this.y);
      const dirY = distTop < distBot ? -1 : 1;
      this.avoidVx = 0;
      this.avoidVy = dirY * this.speed;
    } else {
      // Blocked vertically -> steer horizontally toward the nearest open end of the wall
      const distLeft = Math.abs(this.x - wall.x);
      const distRight = Math.abs(wall.x + wall.w - this.x);
      const dirX = distLeft < distRight ? -1 : 1;
      this.avoidVx = dirX * this.speed;
      this.avoidVy = 0;
    }
  }

  applyBurn(total: number, dur: number) {
    if (isNaN(total) || dur <= 0) return;
    this.burnDps = Math.max(this.burnDps, total / dur);
    this.burnTime = dur;
  }

  applyBleed(total: number, dur: number) {
    if (isNaN(total) || dur <= 0) return;
    this.bleedDps += total / dur;
    this.bleedTime = dur;
  }

  update(dt: number, engine: any) {
    const p = engine.player;
    this.anim += dt * 8;
    this.hitFlash -= dt;

    // DoT ticks with strict NaN safeguards
    if (this.burnTime > 0 || this.bleedTime > 0) {
      this.dotTick -= dt;
      if (this.dotTick <= 0) {
        this.dotTick = 0.5;
        let dot = 0;
        if (this.burnTime > 0 && !isNaN(this.burnDps)) dot += this.burnDps * 0.5;
        if (this.bleedTime > 0 && !isNaN(this.bleedDps)) dot += this.bleedDps * 0.5;
        if (!isNaN(dot) && dot > 0.5) {
          engine.damageEnemy(this, dot, { procs: false, canCrit: false, color: this.burnTime > 0 ? '#ff8800' : '#ff0055' });
          if (this.burnTime > 0) engine.spawnSparks(this.x, this.y, '#ff6600', 2);
        }
      }
      this.burnTime -= dt;
      this.bleedTime -= dt;
      if (this.bleedTime <= 0) this.bleedDps = 0;
    }

    if (this.isDead || !p) return;

    const dx = p.x - this.x;
    const dy = p.y - this.y;
    const dist = Math.hypot(dx, dy);
    this.facingAngle = Math.atan2(dy, dx);

    // Boxhead swarming pathfinding + wall-corner rounding when blocked
    let targetVx = (dx / (dist || 1)) * this.speed;
    let targetVy = (dy / (dist || 1)) * this.speed;

    if (this.avoidTimer > 0) {
      this.avoidTimer -= dt;
      // Strongly follow the wall tangent around the corner, with slight pull toward player
      targetVx = this.avoidVx * 0.9 + targetVx * 0.22;
      targetVy = this.avoidVy * 0.9 + targetVy * 0.22;
      const spd = Math.hypot(targetVx, targetVy) || 1;
      targetVx = (targetVx / spd) * this.speed;
      targetVy = (targetVy / spd) * this.speed;
    }

    // High-performance crowd separation (capped at 8 nearby checks to guarantee 144+ FPS)
    const enemies = engine.enemies;
    const len = enemies.length;
    let checks = 0;
    const startIdx = Math.floor(this.anim * 7) % Math.max(1, len);
    for (let i = 0; i < len && checks < 8; i++) {
      const idx = (startIdx + i) % len;
      const other = enemies[idx];
      if (!other || other === this || other.isDead) continue;
      checks++;
      const ox = this.x - other.x;
      const oy = this.y - other.y;
      if (Math.abs(ox) > 55 || Math.abs(oy) > 55) continue;
      const od = Math.hypot(ox, oy);
      const minD = this.radius + other.radius;
      if (od < minD && od > 0.01) {
        const push = (minD - od) / minD;
        targetVx += (ox / od) * push * 90;
        targetVy += (oy / od) * push * 90;
      }
    }

    // Specific enemy behaviors
    if (this.type === 'wisp') {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0 && dist < 650) {
        this.attackTimer = 2.2 + Math.random();
        const a = this.facingAngle;
        engine.spawnEnemyProjectile(this.x, this.y, Math.cos(a) * 320, Math.sin(a) * 320, this.damage, '#ff2bd6', 9);
      }
    } else if (this.type === 'piranha') {
      // Acid mortar spitter
      this.attackTimer -= dt;
      if (this.attackTimer <= 0 && dist < 700) {
        this.attackTimer = 2.5 + Math.random();
        for (let i = -1; i <= 1; i++) {
          const a = this.facingAngle + i * 0.2;
          engine.spawnEnemyProjectile(this.x, this.y, Math.cos(a) * 280, Math.sin(a) * 280, this.damage, '#39ff14', 10, false, 'acid');
        }
      }
    } else if (this.type === 'bowser_boss') {
      this.updateBoss(dt, engine, dist);
    }

    this.vx += (targetVx - this.vx) * Math.min(1, dt * 7);
    this.vy += (targetVy - this.vy) * Math.min(1, dt * 7);

    // Attack placed barricades and barrels if blocking path
    if (this.attackTimer <= 0) {
      for (const obj of engine.placedObjects) {
        const od = Math.hypot(this.x - (obj.x + obj.w / 2), this.y - (obj.y + obj.h / 2));
        if (od < this.radius + Math.max(obj.w, obj.h) * 0.6) {
          obj.hp -= this.damage;
          engine.spawnSparks(this.x, this.y, '#ff4400', 3);
          if (obj.hp <= 0) {
            engine.detonateObject(obj);
          }
          this.attackTimer = 0.8;
          break;
        }
      }
    }
  }

  private updateBoss(dt: number, engine: any, dist: number) {
    const p = engine.player;
    this.stateTimer -= dt;

    if (this.state === 'chase') {
      if (this.stateTimer <= 0) {
        const r = Math.random();
        if (r < 0.45) {
          this.state = 'flamethrower';
          this.stateTimer = 2.0;
          this.breathShots = 0;
          soundEngine.playBossRoar();
        } else if (r < 0.75) {
          this.state = 'stomp';
          this.stateTimer = 1.0;
        } else {
          // Summon minion swarm
          this.state = 'summon';
          this.stateTimer = 1.2;
          for (let i = 0; i < 4; i++) {
            const a = Math.random() * Math.PI * 2;
            engine.spawnEnemy(Math.random() < 0.6 ? 'goomba' : 'koopa', this.x + Math.cos(a) * 90, this.y + Math.sin(a) * 90);
          }
          engine.spawnBurst(this.x, this.y, '#ff0077', 35, 300);
        }
      }
    } else if (this.state === 'flamethrower') {
      this.vx *= 0.5;
      this.vy *= 0.5;
      const t = 2.0 - this.stateTimer;
      const targetCount = Math.floor(t / 0.07);
      while (this.breathShots < targetCount && this.breathShots < 25) {
        this.breathShots++;
        const a = this.facingAngle + (Math.random() - 0.5) * 0.45;
        const spd = 480 + Math.random() * 140;
        engine.spawnEnemyProjectile(this.x, this.y, Math.cos(a) * spd, Math.sin(a) * spd, this.damage * 0.6, '#00f3ff', 14, true, 'fire');
      }
      if (this.stateTimer <= 0) {
        this.state = 'chase';
        this.stateTimer = 2.5 + Math.random();
      }
    } else if (this.state === 'stomp') {
      this.vx *= 0.3;
      this.vy *= 0.3;
      if (this.stateTimer <= 0) {
        // Shockwave (enemy-owned so boss never damages itself or minions!)
        engine.shake = 22;
        engine.createExplosion(this.x, this.y, 220, this.damage * 1.5, '#ff2bd6', false, 'enemy');
        for (let i = 0; i < 12; i++) {
          const a = (i * Math.PI * 2) / 12;
          engine.spawnEnemyProjectile(this.x, this.y, Math.cos(a) * 400, Math.sin(a) * 400, this.damage * 0.7, '#ff0055', 12, false, 'wave');
        }
        this.state = 'chase';
        this.stateTimer = 2.0;
      }
    } else if (this.state === 'summon') {
      this.vx *= 0.4;
      this.vy *= 0.4;
      if (this.stateTimer <= 0) {
        this.state = 'chase';
        this.stateTimer = 2.0;
      }
    }
  }
}
