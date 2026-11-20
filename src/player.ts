import { SURVIVORS } from './survivors';
import { createDefaultWeapons } from './weapons';
import type { SurvivorDef, SurvivorId, WeaponDef, WeaponType, RelicItem, PlayerAffixes } from './types';
import { soundEngine } from './audio';

export class Player {
  def: SurvivorDef;
  engine: any;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  radius = 18;
  hp: number;
  maxHp: number;
  armor: number;
  aimAngle = 0;
  isDead = false;
  invuln = 0;
  starTime = 0;
  level = 1;
  xp = 0;
  xpToNext = 100;
  stats = { damageMult: 1, attackSpeed: 1, critRate: 0, damage: 16 };
  items: RelicItem[] = [];

  // Dead Cells-style active synergy affixes
  affixes: PlayerAffixes = {
    bonusVsBleeding: 0,
    bonusVsBurning: 0,
    burnOnDeath: 0,
    critLightning: 0,
    vampOnKill: 0,
    pierceBonus: 0,
    blastRadiusMult: 1.0,
    comboGainBonus: 0,
    executeThreshold: 0,
  };

  get damage(): number {
    return (this.def?.baseDamage || 16) * (this.stats.damageMult || 1);
  }

  // Boxhead Weapons
  weapons: Record<WeaponType, WeaponDef>;
  weaponOrder: WeaponType[] = ['pistol', 'shotgun', 'smg', 'grenade', 'rocket', 'barrel', 'barricade'];
  activeWeaponIndex = 0;
  fireCooldown = 0;

  // Dashing
  dashTime = 0;
  dashDirX = 0;
  dashDirY = 0;
  dashCooldownTimer = 0;

  // Special skill
  cdSpecial = 0;
  bladeStormTime = 0;
  bladeAngle = 0;
  bladeTickTimer = 0;

  // Boxhead Combo Multiplier
  comboCount = 0;
  comboTimer = 0;
  maxComboTimer = 3.8; // seconds to keep combo alive

  hurtFlash = 0;
  totalDamageDealt = 0;
  outOfCombat = 0;
  warpCooldown = 0;
  walkAnim = 0;

  constructor(id: SurvivorId, x: number, y: number, engine: any) {
    // Deep-clone survivor definition so per-run upgrades never mutate global SURVIVORS
    const base = SURVIVORS[id];
    this.def = { ...base, specialSkill: { ...base.specialSkill } };
    this.engine = engine;
    this.x = x;
    this.y = y;
    this.maxHp = this.def.maxHp;
    this.hp = this.maxHp;
    this.armor = this.def.armor;
    this.stats.critRate = this.def.critRate;
    this.weapons = createDefaultWeapons();
  }

  get currentWeapon(): WeaponDef {
    const type = this.weaponOrder[this.activeWeaponIndex];
    return this.weapons[type];
  }

  get comboMultiplier(): number {
    if (this.comboCount < 5) return 1.0;
    if (this.comboCount < 15) return 2.0;
    if (this.comboCount < 30) return 3.0;
    if (this.comboCount < 50) return 5.0;
    if (this.comboCount < 100) return 10.0;
    return 20.0;
  }

  get moveSpeed(): number {
    const base = this.def.speed * (1 + (this.comboMultiplier - 1) * 0.05);
    return this.starTime > 0 ? base * 1.45 : base;
  }

  selectWeapon(slotIndex: number) {
    if (slotIndex >= 0 && slotIndex < this.weaponOrder.length) {
      this.activeWeaponIndex = slotIndex;
      soundEngine.playJump(); // Quick click feedback
    }
  }

  cycleWeapon(dir: number) {
    const total = this.weaponOrder.length;
    this.activeWeaponIndex = (this.activeWeaponIndex + dir + total) % total;
    soundEngine.playJump();
  }

  addAmmo(type: WeaponType, amount: number) {
    const w = this.weapons[type];
    if (w && w.maxAmmo !== -1) {
      w.ammo = Math.min(w.maxAmmo, w.ammo + amount);
    }
  }

  addAmmoToAll(fraction = 0.4) {
    for (const key of this.weaponOrder) {
      const w = this.weapons[key];
      if (w.maxAmmo !== -1) {
        const amt = Math.max(1, Math.round(w.maxAmmo * fraction));
        w.ammo = Math.min(w.maxAmmo, w.ammo + amt);
      }
    }
    soundEngine.playCoin();
  }

  addCombo(n = 1) {
    const prevMult = this.comboMultiplier;
    this.comboCount += n + this.affixes.comboGainBonus;
    this.comboTimer = this.maxComboTimer;
    if (this.comboMultiplier > prevMult) {
      this.engine.addDamageNumber(this.x, this.y - 45, `COMBO x${this.comboMultiplier}!`, '#ffff00', 1.4);
      soundEngine.playRelicPickup();
      this.engine.shake = Math.max(this.engine.shake, 8);
    }
  }

  getItemCount(id: string): number {
    const it = this.items.find(i => i.id === id);
    return it ? it.count : 0;
  }

  addItem(item: RelicItem) {
    const existing = this.items.find(i => i.id === item.id);
    if (existing) existing.count++;
    else this.items.push({ ...item, count: 1 });
    item.onApply?.(this);
  }

  heal(amount: number, show = true) {
    if (this.isDead) return;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    if (show && this.hp - before >= 1) {
      this.engine.addDamageNumber(this.x, this.y - 30, `+${Math.round(this.hp - before)}`, '#39ff14', 1);
    }
  }

  takeDamage(amount: number): boolean {
    if (this.isDead || this.invuln > 0 || this.starTime > 0 || this.dashTime > 0) return false;
    const safeAmount = isNaN(amount) ? 10 : Math.max(0, amount);
    if (safeAmount <= 0) return false;

    const shells = this.getItemCount('tough_times_shell');
    if (shells > 0) {
      const blockChance = 1 - 1 / (1 + 0.15 * shells);
      if (Math.random() < blockChance) {
        this.engine.addDamageNumber(this.x, this.y - 35, 'DEFLECTED', '#00f3ff', 1);
        this.invuln = 0.3;
        return false;
      }
    }

    const armor = isNaN(this.armor) ? 0 : this.armor;
    const dmg = safeAmount * (100 / (100 + armor));
    if (isNaN(dmg) || dmg <= 0) return false;

    this.hp -= dmg;
    this.invuln = 0.45;
    this.hurtFlash = 0.2;
    this.outOfCombat = 0;
    this.engine.shake = Math.max(this.engine.shake, 9);
    this.engine.addDamageNumber(this.x, this.y - 35, `-${Math.round(dmg)}`, '#ff2a2a', 1.2);

    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
      this.engine.onPlayerDeath();
    }
    return true;
  }

  triggerInvincibility(dur: number) {
    this.starTime = Math.max(this.starTime, dur);
  }

  triggerDash(dirX: number, dirY: number) {
    if (this.dashCooldownTimer > 0 || this.isDead) return;
    let len = Math.hypot(dirX, dirY);
    if (len < 0.1) {
      dirX = Math.cos(this.aimAngle);
      dirY = Math.sin(this.aimAngle);
      len = 1;
    }
    this.dashDirX = dirX / len;
    this.dashDirY = dirY / len;
    this.dashTime = 0.22;
    this.dashCooldownTimer = this.def.dashCooldown;
    this.invuln = 0.3;
    soundEngine.playJump();
    this.engine.spawnBurst(this.x, this.y, this.def.accentColor, 14, 220);
  }

  gainXp(amount: number) {
    this.xp += amount;
    let leveled = 0;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      leveled++;
      this.xpToNext = Math.round(100 * Math.pow(1.35, this.level - 1));
      this.maxHp += Math.round(this.def.maxHp * 0.18);
      this.hp = Math.min(this.maxHp, this.hp + Math.round(this.maxHp * 0.4));
      this.stats.damageMult += 0.08;
      this.engine.addDamageNumber(this.x, this.y - 50, `LEVEL ${this.level}!`, '#ffbe0b', 1.6);
      this.engine.spawnBurst(this.x, this.y, '#ffbe0b', 28, 320);
      soundEngine.playRelicPickup();
    }
    for (let i = 0; i < leveled; i++) {
      this.engine.queueUpgradeDraft('levelup');
    }
  }

  tick(dt: number) {
    this.fireCooldown -= dt;
    this.invuln -= dt;
    this.starTime -= dt;
    this.dashTime -= dt;
    this.dashCooldownTimer -= dt;
    this.hurtFlash -= dt;
    this.cdSpecial -= dt;
    this.bladeStormTime -= dt;
    this.bladeTickTimer -= dt;
    this.warpCooldown -= dt;
    this.outOfCombat += dt;

    if (Math.hypot(this.vx, this.vy) > 10) {
      this.walkAnim += dt * 10;
    }

    // Relic onTick effects (e.g. Neon Super-Shroom regen)
    for (const it of this.items) {
      it.onTick?.(this, dt, this.engine);
    }

    // Combo timer decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
      }
    }

    // Passive regen
    this.heal((1.0 + this.level * 0.2) * dt * (this.outOfCombat > 4 ? 3 : 1), false);
  }
}
