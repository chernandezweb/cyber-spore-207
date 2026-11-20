// CYBER-SPORE 207 // 2.5D Pixel-Art Boxhead Top-Down Arena Engine
import { Player } from './player';
import { Enemy } from './enemies';
import { generateTopDownArena, STAGE_NAMES } from './level';
import type {
  WallBlock,
  QuestionBlock,
  WarpPipe,
  Teleporter,
  PlacedObject,
  BloodSplat,
  Particle,
  DamageNumber,
  SurvivorId,
  RelicItem,
  UpgradeCard,
  VortexEffect,
} from './types';
import { getRandomRelic } from './items';
import { soundEngine } from './audio';
import { castSpecialSkill } from './skills';
import { AIPilot } from './aiPilot';
import { renderGame } from './render';
import { updateHUD, showToast } from './hud';
import { getPixelAtlas, WORLD_PER_PIXEL } from './pixelArt';
import { DraftSource, getDraftHeader, rollUpgradeChoices } from './upgrades';
import { FlowField } from './pathfinding';

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  damage: number;
  owner: 'player' | 'enemy';
  life: number;
  maxLife: number;
  pierce: number;
  color: string;
  kind: string; // 'bolt' | 'pellet' | 'smg' | 'grenade' | 'rocket' | 'fire' | 'acid' | 'wave'
  bounces?: number;
  hit: Set<any>;
  procs: boolean;
}

export interface Pickup {
  x: number;
  y: number;
  kind: 'ammo' | 'heal' | 'star' | 'relic' | 'boss_relic' | 'coin';
  value: number;
  relic?: RelicItem;
  life: number;
}

export interface Arc { pts: { x: number; y: number }[]; life: number; maxLife: number; color: string; }
export interface Ring { x: number; y: number; r: number; maxR: number; life: number; maxLife: number; color: string; }

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  pixelW = 640;
  pixelH = 360;
  viewW = 1280;
  viewH = 720;
  fps = 60;

  player: Player | null = null;
  survivorId: SurvivorId = 'vanguard';
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  damageNumbers: DamageNumber[] = [];
  pickups: Pickup[] = [];
  bloodSplats: BloodSplat[] = [];
  arcs: Arc[] = [];
  rings: Ring[] = [];
  vortices: VortexEffect[] = [];

  walls: WallBlock[] = [];
  blocks: QuestionBlock[] = [];
  pipes: WarpPipe[] = [];
  placedObjects: PlacedObject[] = [];
  teleporter: Teleporter | null = null;
  spawnPoints: { x: number; y: number }[] = [];
  flowField: FlowField | null = null;

  worldWidth = 2400;
  worldHeight = 1800;

  stage = 1;
  time = 0;
  kills = 0;
  coins = 0;
  lunarStored = 0;
  camX = 0;
  camY = 0;
  shake = 0;
  running = false;
  pausedForUpgrade = false;
  deathTimer = -1;
  directorCredits = 25;
  spawnTimer = 1.5;
  hudTimer = 0;
  globalTime = 0;
  placedObjectIdCounter = 1;
  bosses: Enemy[] = [];

  get boss(): Enemy | null {
    return this.bosses.find(b => !b.isDead) || null;
  }

  // Dead Cells-style 3-card Upgrade Draft state
  upgradeQueue: DraftSource[] = [];
  activeUpgradeCards: UpgradeCard[] | null = null;
  activeDraftSource: DraftSource | null = null;
  pendingNextStage = false;
  private aiAutoPickTimer = 0;

  // Recursion & audio flood guards
  private inExplosionDepth = 0;
  private explosionSfxCooldown = 0;
  private hitSfxCooldown = 0;
  private fpsAccum = 0;
  private fpsFrames = 0;

  input = {
    left: false, right: false, up: false, down: false,
    fire: false, dash: false, special: false, interact: false,
    placeBarrel: false, placeBarricade: false,
    mouseX: 0, mouseY: 0,
  };
  prevInput = { dash: false, special: false, interact: false };
  keys = new Set<string>();
  mouseScreen = { x: 0, y: 0, left: false, right: false };
  ai = new AIPilot();

  onGameOver: ((stats: Record<string, string>) => void) | null = null;
  onUpgradeDraftOpen: ((cards: UpgradeCard[], title: string, subtitle: string) => void) | null = null;
  onUpgradeDraftClose: (() => void) | null = null;
  private lastTs = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.ctx.imageSmoothingEnabled = false;
    this.lunarStored = Number(localStorage.getItem('cs207_lunar') || '0');

    // Warm up the 2.5D pixel-art sprite-stack atlas once (~30ms)
    getPixelAtlas();

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
    requestAnimationFrame(ts => this.loop(ts));
  }

  resize() {
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    const aspect = this.viewW / Math.max(1, this.viewH);
    this.pixelH = 360;
    this.pixelW = Math.max(480, Math.min(820, Math.round(this.pixelH * aspect)));
    this.canvas.width = this.pixelW;
    this.canvas.height = this.pixelH;
    this.ctx.imageSmoothingEnabled = false;
  }

  bindInput() {
    window.addEventListener('keydown', ev => {
      // Intercept [1] [2] [3] when Dead Cells Upgrade Draft modal is open
      if (this.pausedForUpgrade && this.activeUpgradeCards) {
        if (ev.code === 'Digit1') { ev.preventDefault(); this.selectUpgradeCard(0); return; }
        if (ev.code === 'Digit2') { ev.preventDefault(); this.selectUpgradeCard(1); return; }
        if (ev.code === 'Digit3') { ev.preventDefault(); this.selectUpgradeCard(2); return; }
        return;
      }

      this.keys.add(ev.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(ev.code)) {
        ev.preventDefault();
      }
      if (ev.code === 'F4') { ev.preventDefault(); this.toggleAI(); }
      if (ev.code === 'KeyM') this.toggleAudio();

      // Boxhead Weapon selection keys 1-7
      if (ev.code === 'Digit1') this.player?.selectWeapon(0);
      if (ev.code === 'Digit2') this.player?.selectWeapon(1);
      if (ev.code === 'Digit3') this.player?.selectWeapon(2);
      if (ev.code === 'Digit4') this.player?.selectWeapon(3);
      if (ev.code === 'Digit5') this.player?.selectWeapon(4);
      if (ev.code === 'Digit6') this.player?.selectWeapon(5);
      if (ev.code === 'Digit7') this.player?.selectWeapon(6);

      // Quick-cycle with Q
      if (ev.code === 'KeyQ') this.player?.cycleWeapon(-1);
    });

    window.addEventListener('keyup', ev => this.keys.delete(ev.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseScreen.left = false;
      this.mouseScreen.right = false;
    });

    this.canvas.addEventListener('mousemove', ev => {
      this.mouseScreen.x = ev.clientX;
      this.mouseScreen.y = ev.clientY;
    });

    this.canvas.addEventListener('mousedown', ev => {
      if (this.pausedForUpgrade) return;
      if (ev.button === 0) this.mouseScreen.left = true;
      if (ev.button === 2) {
        this.mouseScreen.right = true;
        if (this.player) {
          if (this.player.currentWeapon.type === 'barrel') this.placeBarrelAtAim();
          else if (this.player.currentWeapon.type === 'barricade') this.placeBarricadeAtAim();
          else this.player.triggerDash(Math.cos(this.player.aimAngle), Math.sin(this.player.aimAngle));
        }
      }
    });

    window.addEventListener('mouseup', ev => {
      if (ev.button === 0) this.mouseScreen.left = false;
      if (ev.button === 2) this.mouseScreen.right = false;
    });

    this.canvas.addEventListener('wheel', ev => {
      if (this.player && !this.pausedForUpgrade) {
        this.player.cycleWeapon(ev.deltaY > 0 ? 1 : -1);
      }
    });

    this.canvas.addEventListener('contextmenu', ev => ev.preventDefault());
  }

  toggleAI(): boolean {
    const on = this.ai.toggle();
    const el = document.getElementById('ai-status-text');
    if (el) el.textContent = on ? 'ON' : 'OFF';
    return on;
  }

  toggleAudio(): boolean {
    const on = soundEngine.toggle();
    const el = document.getElementById('audio-status-text');
    if (el) el.textContent = on ? 'ON' : 'OFF';
    return on;
  }

  get coeff(): number {
    // True Risk of Rain 2-style accelerating time + stage difficulty coefficient
    return (1 + (this.time / 60) * 0.48) * Math.pow(1.26, this.stage - 1);
  }

  startRun(survivor: SurvivorId, aiEnabled: boolean) {
    this.survivorId = survivor;
    this.stage = 1;
    this.time = 0;
    this.kills = 0;
    this.coins = 0;
    this.deathTimer = -1;
    this.player = null; // Fresh player every run!
    this.upgradeQueue = [];
    this.activeUpgradeCards = null;
    this.activeDraftSource = null;
    this.pausedForUpgrade = false;
    this.pendingNextStage = false;
    this.onUpgradeDraftClose?.();

    if (this.ai.enabled !== aiEnabled) this.toggleAI();
    this.loadStage();
    this.running = true;
  }

  loadStage() {
    const lvl = generateTopDownArena(this.stage);
    this.worldWidth = lvl.width;
    this.worldHeight = lvl.height;
    this.walls = lvl.walls;
    this.blocks = lvl.blocks;
    this.pipes = lvl.pipes;
    this.placedObjects = [...lvl.barrels];
    this.teleporter = lvl.teleporter;
    this.spawnPoints = lvl.spawnPoints;
    this.flowField = new FlowField(lvl.width, lvl.height, lvl.walls);

    // BUG FIX: Clear ALL floor splats, lingering damage numbers, effects, and vortices on stage change!
    this.bloodSplats = [];
    this.damageNumbers = [];
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.particles = [];
    this.arcs = [];
    this.rings = [];
    this.vortices = [];
    this.bosses = [];
    this.directorCredits = 30 + this.stage * 20;
    this.spawnTimer = 2.0;

    if (!this.player) {
      this.player = new Player(this.survivorId, lvl.playerSpawn.x, lvl.playerSpawn.y, this);
    } else {
      this.player.x = lvl.playerSpawn.x;
      this.player.y = lvl.playerSpawn.y;
      this.player.vx = 0;
      this.player.vy = 0;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.round(this.player.maxHp * 0.35));
    }

    const viewWorldW = this.pixelW * WORLD_PER_PIXEL;
    const viewWorldH = this.pixelH * WORLD_PER_PIXEL;
    this.camX = this.player.x - viewWorldW / 2;
    this.camY = this.player.y - viewWorldH / 2;

    const name = STAGE_NAMES[(this.stage - 1) % STAGE_NAMES.length];
    setText('hud-stage-num', `STAGE ${String(this.stage).padStart(2, '0')}`);
    setText('hud-stage-name', name);
    setText('hud-obj-text', '[E] ACTIVATE BIO-MONOLITH');
    document.getElementById('hud-tp-bar-wrap')?.classList.add('hidden');
    document.getElementById('hud-boss-bar')?.classList.add('hidden');
    this.spawnBurst(this.player.x, this.player.y, '#00f3ff', 36, 300);
    updateHUD(this);
  }

  // ==========================================================================
  // DEAD CELLS-STYLE 3-CARD UPGRADE SELECTION DRAFT
  // ==========================================================================

  queueUpgradeDraft(source: DraftSource) {
    if (!this.player || this.player.isDead) return;
    if (this.pausedForUpgrade) {
      this.upgradeQueue.push(source);
      return;
    }
    this.openUpgradeDraft(source);
  }

  private openUpgradeDraft(source: DraftSource) {
    if (!this.player) return;
    const cards = rollUpgradeChoices(this.player, source);
    const header = getDraftHeader(source, this.player.level, this.stage);
    this.activeUpgradeCards = cards;
    this.activeDraftSource = source;
    this.pausedForUpgrade = true;
    this.mouseScreen.left = false;
    this.keys.clear();
    this.aiAutoPickTimer = 0.9; // In AI Pilot mode, showcase modal briefly then auto-pick
    this.onUpgradeDraftOpen?.(cards, header.title, header.subtitle);
  }

  selectUpgradeCard(index: number) {
    if (!this.pausedForUpgrade || !this.activeUpgradeCards || !this.player) return;
    const card = this.activeUpgradeCards[index];
    if (!card) return;

    card.apply(this.player, this);
    soundEngine.playRelicPickup();
    this.spawnBurst(this.player.x, this.player.y, '#ffbe0b', 28, 300);
    this.addDamageNumber(this.player.x, this.player.y - 44, card.title, '#ffbe0b', 1.25);

    this.activeUpgradeCards = null;
    this.activeDraftSource = null;
    this.pausedForUpgrade = false;
    this.onUpgradeDraftClose?.();
    updateHUD(this);

    // Process next queued draft if multiple triggered at once
    if (this.upgradeQueue.length > 0) {
      const next = this.upgradeQueue.shift()!;
      this.openUpgradeDraft(next);
      return;
    }

    // If this draft was the Stage-Clear Bounty, now warp to the next stage!
    if (this.pendingNextStage) {
      this.pendingNextStage = false;
      this.stage++;
      soundEngine.playPipeWarp();
      this.loadStage();
    }
  }

  loop(ts: number) {
    const dt = Math.min(0.05, Math.max(0.001, (ts - (this.lastTs || ts)) / 1000));
    this.lastTs = ts;
    this.globalTime += dt;

    // Track FPS
    this.fpsAccum += dt;
    this.fpsFrames++;
    if (this.fpsAccum >= 0.4) {
      this.fps = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }

    if (this.running) {
      if (this.pausedForUpgrade) {
        // AI auto-pilot picks highest-rarity card after a brief preview so AI Demo never stalls
        if (this.ai.enabled && this.activeUpgradeCards) {
          this.aiAutoPickTimer -= dt;
          if (this.aiAutoPickTimer <= 0) {
            const rank: Record<string, number> = { legendary: 4, rare: 3, uncommon: 2, common: 1 };
            let bestIdx = 0;
            let bestScore = -1;
            this.activeUpgradeCards.forEach((c, idx) => {
              const s = rank[c.rarity] || 1;
              if (s > bestScore) { bestScore = s; bestIdx = idx; }
            });
            this.selectUpgradeCard(bestIdx);
          }
        }
      } else {
        this.update(dt);
      }
    }

    renderGame(this);
    requestAnimationFrame(t => this.loop(t));
  }

  update(dt: number) {
    const p = this.player!;
    this.time += p.isDead ? 0 : dt;
    this.explosionSfxCooldown = Math.max(0, this.explosionSfxCooldown - dt);
    this.hitSfxCooldown = Math.max(0, this.hitSfxCooldown - dt);

    this.readInput();
    if (this.ai.enabled && !p.isDead) this.ai.update(this, dt);

    if (!p.isDead) this.updatePlayer(dt);
    if (this.flowField && !p.isDead) this.flowField.update(p.x, p.y);
    this.updateEnemies(dt);
    if (!p.isDead) this.handlePlayerEnemyCollisions();
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.updatePlacedObjects(dt);
    this.updateVortices(dt);
    this.updateWarpPipes(dt);
    this.updateEffects(dt);
    this.updateDirector(dt);
    this.updateTeleporter(dt);
    this.updateCamera(dt);

    if (this.deathTimer > 0) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) this.finishRun(false);
    }

    this.prevInput.dash = this.input.dash;
    this.prevInput.special = this.input.special;
    this.prevInput.interact = this.input.interact;

    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.08;
      updateHUD(this);
    }
  }

  readInput() {
    const k = this.keys;
    const inp = this.input;
    if (!this.ai.enabled) {
      inp.left = k.has('KeyA') || k.has('ArrowLeft');
      inp.right = k.has('KeyD') || k.has('ArrowRight');
      inp.up = k.has('KeyW') || k.has('ArrowUp');
      inp.down = k.has('KeyS') || k.has('ArrowDown');
      inp.fire = this.mouseScreen.left || k.has('KeyJ');
      inp.dash = k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyL');
      inp.special = k.has('KeyR');
      inp.interact = k.has('KeyE');
      inp.placeBarrel = k.has('Space');
      inp.placeBarricade = k.has('KeyF');

      const rect = this.canvas.getBoundingClientRect();
      const nx = (this.mouseScreen.x - rect.left) / Math.max(1, rect.width);
      const ny = (this.mouseScreen.y - rect.top) / Math.max(1, rect.height);
      inp.mouseX = this.camX + nx * (this.pixelW * WORLD_PER_PIXEL);
      inp.mouseY = this.camY + ny * (this.pixelH * WORLD_PER_PIXEL);
    }
  }

  updatePlayer(dt: number) {
    const p = this.player!;
    const inp = this.input;
    p.tick(dt);

    // 360 degree aiming toward mouse
    p.aimAngle = Math.atan2(inp.mouseY - p.y, inp.mouseX - p.x);

    // Dashing
    if (p.dashTime > 0) {
      this.moveCircle(p, p.radius, p.dashDirX * 780 * dt, p.dashDirY * 780 * dt);
      this.spawnParticle(p.x, p.y, { color: p.def.accentColor, size: 4, life: 0.22 });
    } else {
      let mx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      let my = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
      if (mx !== 0 && my !== 0) {
        mx *= 0.7071;
        my *= 0.7071;
      }
      p.vx = mx * p.moveSpeed;
      p.vy = my * p.moveSpeed;
      this.moveCircle(p, p.radius, p.vx * dt, p.vy * dt);
    }

    if (inp.dash && !this.prevInput.dash) {
      const mx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      const my = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
      p.triggerDash(mx, my);
    }

    if (inp.placeBarrel) {
      this.placeBarrelAtAim();
      inp.placeBarrel = false;
      this.keys.delete('Space');
    }
    if (inp.placeBarricade) {
      this.placeBarricadeAtAim();
      inp.placeBarricade = false;
      this.keys.delete('KeyF');
    }

    if (inp.fire && p.fireCooldown <= 0) {
      this.firePlayerWeapon();
    }

    if (inp.special && !this.prevInput.special) {
      castSpecialSkill(this);
    }

    // Blade Storm ticking (FIXED: rate-limited to 8 ticks/sec so it never causes proc-storm lag!)
    if (p.bladeStormTime > 0) {
      p.bladeAngle += dt * 8;
      if (p.bladeTickTimer <= 0) {
        p.bladeTickTimer = 0.12;
        for (const en of this.enemies) {
          if (en.isDead) continue;
          if (Math.hypot(en.x - p.x, en.y - p.y) < 115 + en.radius) {
            this.damageEnemy(en, p.damage * 1.4, { procs: true, canCrit: true, color: '#ff2bd6' });
          }
        }
      }
    }

    if (inp.interact && !this.prevInput.interact) {
      this.tryActivateTeleporter();
    }
  }

  firePlayerWeapon() {
    const p = this.player!;
    const w = p.currentWeapon;

    if (w.maxAmmo !== -1 && w.ammo <= 0) {
      p.selectWeapon(0);
      return;
    }

    if (w.type === 'barrel') {
      p.fireCooldown = 1 / w.fireRate;
      this.placeBarrelAtAim();
      return;
    }
    if (w.type === 'barricade') {
      p.fireCooldown = 1 / w.fireRate;
      this.placeBarricadeAtAim();
      return;
    }

    p.fireCooldown = 1 / (w.fireRate * p.stats.attackSpeed);
    if (w.maxAmmo !== -1) w.ammo--;

    const baseDmg = w.damage * p.stats.damageMult * (1 + (p.comboMultiplier - 1) * 0.1);
    const speed = w.projSpeed;
    const extraPierce = p.affixes.pierceBonus;

    if (w.type === 'pistol') {
      const a = p.aimAngle + (Math.random() - 0.5) * w.spread;
      this.spawnProjectile({
        x: p.x + Math.cos(p.aimAngle) * 20,
        y: p.y + Math.sin(p.aimAngle) * 20,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        r: 6,
        damage: baseDmg,
        color: '#00f3ff',
        kind: 'bolt',
        life: 0.8,
        pierce: extraPierce,
      });
      soundEngine.playPistol();
      this.shake = Math.max(this.shake, 2);
    } else if (w.type === 'shotgun') {
      for (let i = 0; i < w.pellets; i++) {
        const a = p.aimAngle + (Math.random() - 0.5) * w.spread;
        this.spawnProjectile({
          x: p.x + Math.cos(p.aimAngle) * 24,
          y: p.y + Math.sin(p.aimAngle) * 24,
          vx: Math.cos(a) * (speed * (0.85 + Math.random() * 0.3)),
          vy: Math.sin(a) * (speed * (0.85 + Math.random() * 0.3)),
          r: 5,
          damage: baseDmg,
          color: '#ff8a24',
          kind: 'pellet',
          life: 0.55,
          pierce: 1 + extraPierce,
        });
      }
      soundEngine.playShotgun();
      this.shake = Math.max(this.shake, 6);
    } else if (w.type === 'smg') {
      const a = p.aimAngle + (Math.random() - 0.5) * w.spread;
      this.spawnProjectile({
        x: p.x + Math.cos(p.aimAngle) * 22,
        y: p.y + Math.sin(p.aimAngle) * 22,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        r: 5,
        damage: baseDmg,
        color: '#7df9ff',
        kind: 'bolt',
        life: 0.7,
        pierce: extraPierce,
      });
      soundEngine.playSMG();
      this.shake = Math.max(this.shake, 1.5);
    } else if (w.type === 'grenade') {
      const a = p.aimAngle + (Math.random() - 0.5) * w.spread;
      this.spawnProjectile({
        x: p.x + Math.cos(p.aimAngle) * 20,
        y: p.y + Math.sin(p.aimAngle) * 20,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        r: 8,
        damage: baseDmg,
        color: '#39ff14',
        kind: 'grenade',
        life: 1.2,
        bounces: 3,
        pierce: 99,
      });
      soundEngine.playDash();
    } else if (w.type === 'rocket') {
      const a = p.aimAngle;
      this.spawnProjectile({
        x: p.x + Math.cos(p.aimAngle) * 24,
        y: p.y + Math.sin(p.aimAngle) * 24,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        r: 10,
        damage: baseDmg,
        color: '#ff2a2a',
        kind: 'rocket',
        life: 1.6,
        pierce: 0,
      });
      soundEngine.playRocketLaunch();
      this.shake = Math.max(this.shake, 7);
    }
  }

  placeBarrelAtAim() {
    const p = this.player!;
    const w = p.weapons.barrel;
    if (!w.unlocked || w.ammo <= 0) return;
    w.ammo--;
    const dist = 55;
    const bx = p.x + Math.cos(p.aimAngle) * dist - 18;
    const by = p.y + Math.sin(p.aimAngle) * dist - 18;
    this.placedObjects.push({
      id: this.placedObjectIdCounter++,
      type: 'barrel',
      x: bx,
      y: by,
      w: 36,
      h: 36,
      hp: 40,
      maxHp: 40,
      color: '#ff2a2a',
    });
    soundEngine.playBlockBump();
    this.spawnBurst(bx + 18, by + 18, '#ffbe0b', 8, 120);
  }

  placeBarricadeAtAim() {
    const p = this.player!;
    const w = p.weapons.barricade;
    if (!w.unlocked || w.ammo <= 0) return;
    w.ammo--;
    const dist = 55;
    const bx = p.x + Math.cos(p.aimAngle) * dist - 20;
    const by = p.y + Math.sin(p.aimAngle) * dist - 20;
    this.placedObjects.push({
      id: this.placedObjectIdCounter++,
      type: 'barricade',
      x: bx,
      y: by,
      w: 40,
      h: 40,
      hp: 150,
      maxHp: 150,
      color: '#00f3ff',
    });
    soundEngine.playBlockBump();
    this.spawnBurst(bx + 20, by + 20, '#00f3ff', 8, 120);
  }

  detonateObject(obj: PlacedObject) {
    const idx = this.placedObjects.indexOf(obj);
    if (idx === -1) return;
    this.placedObjects.splice(idx, 1);
    obj.hp = 0;

    if (obj.type === 'barrel') {
      const cx = obj.x + obj.w / 2;
      const cy = obj.y + obj.h / 2;
      const blastMult = this.player?.affixes.blastRadiusMult || 1;
      const rad = 210 * blastMult;
      this.createExplosion(cx, cy, rad, 320, '#ff4400', false, 'player');
      this.shake = Math.max(this.shake, 16);

      // Pause-safe dt-driven chain reaction fuse on nearby barrels
      for (const other of this.placedObjects) {
        if (other.type === 'barrel' && other.fuse === undefined) {
          const d = Math.hypot(cx - (other.x + other.w / 2), cy - (other.y + other.h / 2));
          if (d < 185 * blastMult) {
            other.fuse = 0.09;
          }
        }
      }
    } else {
      this.spawnBurst(obj.x + obj.w / 2, obj.y + obj.h / 2, '#00f3ff', 18, 200);
    }
  }

  updatePlacedObjects(dt: number) {
    const toDetonate: PlacedObject[] = [];
    for (const obj of this.placedObjects) {
      if (obj.fuse !== undefined) {
        obj.fuse -= dt;
        if (obj.fuse <= 0) toDetonate.push(obj);
      } else if (obj.hp <= 0) {
        toDetonate.push(obj);
      }
    }
    for (const obj of toDetonate) {
      this.detonateObject(obj);
    }
  }

  updateVortices(dt: number) {
    for (const v of this.vortices) {
      v.life -= dt;
      v.tickTimer -= dt;
      if (v.tickTimer <= 0) {
        v.tickTimer = 0.18;
        for (const en of this.enemies) {
          if (en.isDead || en.isBoss) continue;
          const dx = v.x - en.x;
          const dy = v.y - en.y;
          const d = Math.hypot(dx, dy);
          if (d < v.radius && d > 10) {
            en.vx += (dx / d) * 340;
            en.vy += (dy / d) * 340;
            this.damageEnemy(en, v.dps * 0.22, { procs: false, canCrit: false, color: '#c58bff' });
          }
        }
      }
    }
    this.vortices = this.vortices.filter(v => v.life > 0);
  }

  updateWarpPipes(dt: number) {
    const p = this.player!;
    for (const pipe of this.pipes) {
      pipe.cooldown -= dt;
      if (pipe.cooldown <= 0 && p.warpCooldown <= 0) {
        const d = Math.hypot(p.x - pipe.x, p.y - pipe.y);
        if (d < pipe.radius + p.radius) {
          const target = this.pipes.find(pp => pp.id === pipe.targetPipeId);
          if (target) {
            p.x = target.x;
            p.y = target.y;
            p.warpCooldown = 1.0;
            target.cooldown = 1.0;
            pipe.cooldown = 1.0;
            p.invuln = 0.5;
            soundEngine.playPipeWarp();
            this.spawnBurst(pipe.x, pipe.y, '#00ff88', 22, 240);
            this.spawnBurst(target.x, target.y, '#00ff88', 22, 240);
            this.addDamageNumber(p.x, p.y - 40, 'WARP!', '#00ff88', 1.2);
            break;
          }
        }
      }
    }
  }

  moveCircle(entity: { x: number; y: number; notifyWallBlock?: (w: WallBlock, axis: 'x' | 'y') => void }, r: number, dx: number, dy: number) {
    entity.x += dx;
    for (const w of this.walls) {
      if (this.circleRectOverlap(entity.x, entity.y, r, w.x, w.y, w.w, w.h)) {
        if (dx > 0) entity.x = w.x - r;
        else if (dx < 0) entity.x = w.x + w.w + r;
        entity.notifyWallBlock?.(w, 'x');
      }
    }
    for (const o of this.placedObjects) {
      if (this.circleRectOverlap(entity.x, entity.y, r, o.x, o.y, o.w, o.h)) {
        if (dx > 0) entity.x = o.x - r;
        else if (dx < 0) entity.x = o.x + o.w + r;
      }
    }
    for (const b of this.blocks) {
      if (!b.hit && this.circleRectOverlap(entity.x, entity.y, r, b.x, b.y, b.w, b.h)) {
        if (dx > 0) entity.x = b.x - r;
        else if (dx < 0) entity.x = b.x + b.w + r;
      }
    }

    entity.y += dy;
    for (const w of this.walls) {
      if (this.circleRectOverlap(entity.x, entity.y, r, w.x, w.y, w.w, w.h)) {
        if (dy > 0) entity.y = w.y - r;
        else if (dy < 0) entity.y = w.y + w.h + r;
        entity.notifyWallBlock?.(w, 'y');
      }
    }
    for (const o of this.placedObjects) {
      if (this.circleRectOverlap(entity.x, entity.y, r, o.x, o.y, o.w, o.h)) {
        if (dy > 0) entity.y = o.y - r;
        else if (dy < 0) entity.y = o.y + o.h + r;
      }
    }
    for (const b of this.blocks) {
      if (!b.hit && this.circleRectOverlap(entity.x, entity.y, r, b.x, b.y, b.w, b.h)) {
        if (dy > 0) entity.y = b.y - r;
        else if (dy < 0) entity.y = b.y + b.h + r;
      }
    }

    entity.x = Math.max(r + 20, Math.min(this.worldWidth - r - 20, entity.x));
    entity.y = Math.max(r + 20, Math.min(this.worldHeight - r - 20, entity.y));
  }

  circleRectOverlap(cx: number, cy: number, cr: number, rx: number, ry: number, rw: number, rh: number): boolean {
    if (cx + cr < rx || cx - cr > rx + rw || cy + cr < ry || cy - cr > ry + rh) return false;
    const closestX = Math.max(rx, Math.min(cx, rx + rw));
    const closestY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) < (cr * cr);
  }

  updateEnemies(dt: number) {
    for (const en of this.enemies) {
      en.update(dt, this);
      if (en.isDead) continue;
      if (!en.flying) {
        this.moveCircle(en, en.radius, en.vx * dt, en.vy * dt);
      } else {
        en.x += en.vx * dt;
        en.y += en.vy * dt;
      }
    }
    this.enemies = this.enemies.filter(e => !e.isDead);
  }

  handlePlayerEnemyCollisions() {
    const p = this.player!;
    for (const en of this.enemies) {
      if (en.isDead) continue;
      const d = Math.hypot(p.x - en.x, p.y - en.y);
      if (d < p.radius + en.radius) {
        if (p.starTime > 0) {
          this.damageEnemy(en, p.damage * 8, { procs: false, canCrit: true, color: '#ffee44' });
        } else {
          p.takeDamage(en.damage);
        }
      }
    }
  }

  updateProjectiles(dt: number) {
    const p = this.player!;
    const blastMult = p.affixes.blastRadiusMult || 1;

    for (const pr of this.projectiles) {
      pr.life -= dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;

      if (pr.kind === 'rocket' && Math.random() < 0.55) {
        this.spawnParticle(pr.x, pr.y, { color: '#ffaa33', size: 4, life: 0.18 });
      }

      // Wall collision
      let hitWall = false;
      for (const w of this.walls) {
        if (this.circleRectOverlap(pr.x, pr.y, pr.r, w.x, w.y, w.w, w.h)) {
          hitWall = true;
          break;
        }
      }

      if (hitWall) {
        if (pr.kind === 'grenade' && (pr.bounces ?? 0) > 0) {
          pr.bounces!--;
          pr.vx = -pr.vx * 0.7;
          pr.vy = -pr.vy * 0.7;
          soundEngine.playBlockBump();
        } else if (pr.kind === 'rocket' || pr.kind === 'grenade') {
          pr.life = 0;
          this.createExplosion(pr.x, pr.y, 160 * blastMult, pr.damage, '#ff4400', true, 'player');
        } else {
          pr.life = 0;
          this.spawnSparks(pr.x, pr.y, pr.color, 3);
        }
      }

      // Question block hit
      if (pr.owner === 'player' && pr.life > 0) {
        for (const b of this.blocks) {
          if (!b.hit && this.circleRectOverlap(pr.x, pr.y, pr.r, b.x, b.y, b.w, b.h)) {
            b.hp -= pr.damage;
            b.bumpOffset = 1;
            this.spawnSparks(pr.x, pr.y, '#ffbe0b', 4);
            pr.life = 0;
            if (b.hp <= 0) {
              this.breakQuestionBlock(b);
            }
            break;
          }
        }
      }

      // Placed object hit
      if (pr.life > 0) {
        for (const obj of this.placedObjects) {
          if (this.circleRectOverlap(pr.x, pr.y, pr.r, obj.x, obj.y, obj.w, obj.h)) {
            obj.hp -= pr.damage;
            this.spawnSparks(pr.x, pr.y, '#ff4400', 4);
            if (pr.kind === 'rocket') {
              this.createExplosion(pr.x, pr.y, 160 * blastMult, pr.damage, '#ff4400', true, 'player');
            }
            pr.life = 0;
            if (obj.hp <= 0) this.detonateObject(obj);
            break;
          }
        }
      }

      // Enemy hit
      if (pr.owner === 'player' && pr.life > 0) {
        for (const en of this.enemies) {
          if (en.isDead || pr.hit.has(en) || pr.life <= 0) continue;
          const pdx = pr.x - en.x;
          const pdy = pr.y - en.y;
          const rSum = en.radius + pr.r;
          if (Math.abs(pdx) <= rSum && Math.abs(pdy) <= rSum && (pdx * pdx + pdy * pdy) <= rSum * rSum) {
            pr.hit.add(en);
            if (pr.kind === 'rocket') {
              pr.life = 0;
              this.createExplosion(pr.x, pr.y, 180 * blastMult, pr.damage, '#ff2a2a', true, 'player');
            } else {
              this.damageEnemy(en, pr.damage, { procs: pr.procs, canCrit: true, color: pr.color });
              this.spawnSparks(pr.x, pr.y, pr.color, 3);
              if (pr.pierce > 0) pr.pierce--;
              else pr.life = 0;
            }
            break;
          }
        }
      } else if (pr.owner === 'enemy' && !p.isDead && pr.life > 0) {
        const pdx = pr.x - p.x;
        const pdy = pr.y - p.y;
        const rSum = p.radius + pr.r;
        if (Math.abs(pdx) <= rSum && Math.abs(pdy) <= rSum && (pdx * pdx + pdy * pdy) <= rSum * rSum) {
          p.takeDamage(pr.damage);
          pr.life = 0;
          this.spawnSparks(p.x, p.y, pr.color, 4);
        }
      }

      // Grenade explosion on fuse expiration
      if (pr.kind === 'grenade' && pr.life <= 0) {
        this.createExplosion(pr.x, pr.y, 160 * blastMult, pr.damage, '#39ff14', true, 'player');
      }
    }

    this.projectiles = this.projectiles.filter(pr => pr.life > 0);
  }

  breakQuestionBlock(b: QuestionBlock) {
    b.hit = true;
    soundEngine.playBlockBump();
    soundEngine.playCoin();
    this.spawnBurst(b.x + b.w / 2, b.y + b.h / 2, '#ffbe0b', 18, 250);

    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;

    if (b.itemType === 'ammo') {
      this.spawnPickup('ammo', cx, cy, 30);
    } else if (b.itemType === 'heal') {
      this.spawnPickup('heal', cx, cy, 50);
    } else if (b.itemType === 'star') {
      this.spawnPickup('star', cx, cy, 1);
    } else {
      this.spawnPickup('relic', cx, cy, 0, getRandomRelic('common'));
    }
  }

  /** Safe chain lightning (Tesla Ukulele & Crit Lightning Affix) — NEVER recurses */
  triggerChainLightning(source: Enemy, maxTargets: number, damage: number) {
    if (this.arcs.length > 28) return;
    const hitSet = new Set<Enemy>([source]);
    let currX = source.x;
    let currY = source.y;

    for (let hop = 0; hop < maxTargets; hop++) {
      let best: Enemy | null = null;
      let bestD = 260;
      for (const en of this.enemies) {
        if (en.isDead || hitSet.has(en)) continue;
        const d = Math.hypot(en.x - currX, en.y - currY);
        if (d < bestD) {
          bestD = d;
          best = en;
        }
      }
      if (!best) break;
      hitSet.add(best);

      // Build jagged pixel lightning arc polyline
      const pts: { x: number; y: number }[] = [{ x: currX, y: currY }];
      const segs = 4;
      for (let s = 1; s < segs; s++) {
        const t = s / segs;
        pts.push({
          x: currX + (best.x - currX) * t + (Math.random() - 0.5) * 26,
          y: currY + (best.y - currY) * t + (Math.random() - 0.5) * 26,
        });
      }
      pts.push({ x: best.x, y: best.y });
      this.arcs.push({ pts, life: 0.16, maxLife: 0.16, color: '#5cecff' });

      // procs: false prevents infinite chain lightning loops!
      this.damageEnemy(best, damage, { procs: false, canCrit: false, color: '#5cecff' });
      currX = best.x;
      currY = best.y;
    }
  }

  damageEnemy(en: Enemy, amount: number, opts: { procs?: boolean; canCrit?: boolean; color?: string } = {}) {
    if (en.isDead) return;
    const p = this.player!;
    let dmg = isNaN(amount) ? (p.damage || 15) : amount;
    if (dmg <= 0) return;

    // Dead Cells status synergy multipliers!
    let synergyBoost = 1.0;
    if (en.bleedTime > 0 && p.affixes.bonusVsBleeding > 0) {
      synergyBoost += p.affixes.bonusVsBleeding;
    }
    if (en.burnTime > 0 && p.affixes.bonusVsBurning > 0) {
      synergyBoost += p.affixes.bonusVsBurning;
    }
    dmg *= synergyBoost;

    let crit = false;
    if (opts.canCrit !== false && Math.random() < p.stats.critRate) {
      dmg *= 2;
      crit = true;
    }

    en.hp -= dmg;
    en.hitFlash = 0.09;
    p.totalDamageDealt += dmg;
    p.outOfCombat = 0;

    // Dead Cells Execute threshold affix
    if (!en.isBoss && en.hp > 0 && p.affixes.executeThreshold > 0 && en.hp / en.maxHp <= p.affixes.executeThreshold) {
      en.hp = 0;
      this.addDamageNumber(en.x, en.y - en.radius - 20, 'EXECUTE!', '#ffbe0b', 1.2);
    }

    if (this.hitSfxCooldown <= 0) {
      soundEngine.playHitmarker();
      this.hitSfxCooldown = 0.045;
    }

    const rounded = Math.round(dmg);
    if (!isNaN(rounded) && rounded > 0) {
      const col = crit ? '#ff3366' : synergyBoost > 1 ? '#ffbe0b' : opts.color || '#ffffff';
      this.addDamageNumber(en.x, en.y - en.radius - 8, crit ? `${rounded}!` : String(rounded), col, crit ? 1.3 : 0.9);
    }

    if (opts.procs !== false) {
      if (crit && p.affixes.critLightning > 0) {
        this.triggerChainLightning(en, 2 + p.affixes.critLightning, p.damage * 0.75);
      }
      for (const it of p.items) {
        if (en.isDead) break;
        it.onHit?.(p, en, dmg, this);
      }
    }

    if (en.hp <= 0) {
      this.killEnemy(en);
    }
  }

  killEnemy(en: Enemy) {
    if (en.isDead) return;
    en.isDead = true;
    this.kills++;
    const p = this.player!;

    p.addCombo(1);

    // Dead Cells Vampiric Kill affix
    if (p.affixes.vampOnKill > 0) {
      p.heal(p.affixes.vampOnKill, false);
      p.dashCooldownTimer = Math.max(0, p.dashCooldownTimer - 0.25);
    }

    // Dead Cells Burn-on-Death affix (ignites nearby zombies cleanly without recursion)
    if (p.affixes.burnOnDeath > 0) {
      const fireRad = 120 * (p.affixes.blastRadiusMult || 1);
      if (this.rings.length < 36) {
        this.rings.push({ x: en.x, y: en.y, r: 10, maxR: fireRad, life: 0.28, maxLife: 0.28, color: '#ff6a00' });
      }
      for (const other of this.enemies) {
        if (other.isDead || other === en) continue;
        if (Math.hypot(other.x - en.x, other.y - en.y) < fireRad + other.radius) {
          other.applyBurn(p.damage * (1.2 + p.affixes.burnOnDeath * 0.6), 3.0);
        }
      }
    }

    // Pixelated alien spore splat on the floor (cleared cleanly on stage change!)
    this.bloodSplats.push({
      x: en.x,
      y: en.y,
      radius: en.radius * (0.75 + Math.random() * 0.5),
      color: en.type === 'goomba' ? '#1ac8db' : en.type === 'koopa' ? '#39e64c' : '#e62e88',
      alpha: 0.55,
      seed: Math.floor(Math.random() * 10000),
    });
    if (this.bloodSplats.length > 180) this.bloodSplats.shift();

    p.gainXp(en.xpValue);
    for (const it of p.items) it.onKill?.(p, en, this);

    // Random pickups (tighter RoR2 economy so ammo & healing feel earned)
    if (Math.random() < 0.19) this.spawnPickup('ammo', en.x, en.y, 25);
    else if (Math.random() < 0.045) this.spawnPickup('heal', en.x, en.y, 30);

    const col = en.isBoss ? '#ff0077' : en.type === 'goomba' ? '#00f3ff' : en.type === 'koopa' ? '#39ff14' : '#ff2bd6';
    this.spawnBurst(en.x, en.y, col, en.isBoss ? 75 : 14, en.isBoss ? 520 : 210);

    if (en.isBoss) {
      this.shake = 26;
      this.bosses = this.bosses.filter(b => !b.isDead);
      this.spawnPickup('boss_relic', en.x - 24, en.y, 0, getRandomRelic('rare'));
      this.spawnPickup('ammo', en.x + 28, en.y, 60);
      soundEngine.playRelicPickup();

      if (this.bosses.length === 0) {
        if (this.teleporter) this.teleporter.bossDefeated = true;
        document.getElementById('hud-boss-bar')?.classList.add('hidden');
        this.addDamageNumber(en.x, en.y - 40, 'ALL TITANS SLAIN!', '#ffbe0b', 2.0);
      } else {
        this.addDamageNumber(en.x, en.y - 40, `TITAN DOWN! (${this.bosses.length} LEFT)`, '#ffbe0b', 1.7);
      }
    }
  }

  /**
   * Explosion handler with strict recursion-depth guard, owner separation, and particle/SFX throttling
   * so swarms + Behemoth Core + Boss Stomps NEVER cause lag or freezes!
   */
  createExplosion(
    x: number,
    y: number,
    radius: number,
    damage: number,
    color: string,
    procs = false,
    owner: 'player' | 'enemy' = 'player'
  ) {
    if (this.inExplosionDepth >= 2) return;
    this.inExplosionDepth++;
    try {
      if (this.rings.length < 36) {
        this.rings.push({ x, y, r: 10, maxR: radius, life: 0.32, maxLife: 0.32, color });
      }
      this.spawnBurst(x, y, color, Math.min(18, Math.round(radius / 10)), radius * 1.9);

      if (this.explosionSfxCooldown <= 0) {
        soundEngine.playExplosion();
        this.explosionSfxCooldown = 0.065;
      }

      // Only allow on-hit procs on top-level non-nested player explosions
      const allowProcs = procs && this.inExplosionDepth === 1 && owner === 'player';

      if (owner === 'player') {
        for (const en of this.enemies) {
          if (en.isDead) continue;
          const d = Math.hypot(en.x - x, en.y - y);
          if (d < radius + en.radius) {
            this.damageEnemy(en, damage, { procs: allowProcs, canCrit: true, color });
          }
        }
      }

      // Damage placed barrels/barricades in blast zone
      for (const obj of this.placedObjects) {
        const d = Math.hypot(x - (obj.x + obj.w / 2), y - (obj.y + obj.h / 2));
        if (d < radius) {
          obj.hp -= damage;
        }
      }

      // Damage player if close (full damage for enemy boss stomp, reduced self-damage for player blasts)
      if (this.player && !this.player.isDead) {
        const pd = Math.hypot(x - this.player.x, y - this.player.y);
        if (pd < radius * (owner === 'enemy' ? 0.95 : 0.7)) {
          this.player.takeDamage(owner === 'enemy' ? damage : damage * 0.3);
        }
      }
    } finally {
      this.inExplosionDepth--;
    }
  }

  createVortex(x: number, y: number, radius: number, dps: number, duration: number) {
    if (this.rings.length < 36) {
      this.rings.push({ x, y, r: 20, maxR: radius, life: duration, maxLife: duration, color: '#9d4dff' });
    }
    this.vortices.push({ x, y, radius, dps, life: duration, maxLife: duration, tickTimer: 0.1 });
  }

  spawnPickup(kind: Pickup['kind'], x: number, y: number, value: number, relic?: RelicItem) {
    this.pickups.push({ x, y, kind, value, relic, life: 50 });
  }

  updatePickups(dt: number) {
    const p = this.player!;
    for (const pk of this.pickups) {
      pk.life -= dt;
      const d = Math.hypot(p.x - pk.x, p.y - pk.y);
      if (d < p.radius + 18 && !p.isDead) {
        pk.life = 0;
        if (pk.kind === 'ammo') {
          p.addAmmoToAll(0.25);
          this.addDamageNumber(p.x, p.y - 30, '+AMMO', '#ffbe0b', 1.1);
        } else if (pk.kind === 'heal') {
          p.heal(p.maxHp * 0.30);
          soundEngine.playCoin();
          this.addDamageNumber(p.x, p.y - 30, '+HEALTH', '#39ff14', 1.2);
        } else if (pk.kind === 'star') {
          p.triggerInvincibility(7);
          soundEngine.playRelicPickup();
          this.addDamageNumber(p.x, p.y - 30, '★ STARMAN ★', '#ffff00', 1.5);
        } else if (pk.kind === 'boss_relic') {
          soundEngine.playRelicPickup();
          this.queueUpgradeDraft('boss_relic');
        } else if (pk.kind === 'relic') {
          soundEngine.playRelicPickup();
          this.queueUpgradeDraft('relic');
        } else if (pk.relic) {
          p.addItem(pk.relic);
          soundEngine.playRelicPickup();
          showToast(pk.relic);
        }
      }
    }
    this.pickups = this.pickups.filter(pk => pk.life > 0);
  }

  updateDirector(dt: number) {
    const p = this.player!;
    if (p.isDead) return;
    const tp = this.teleporter;
    const charging = tp?.state === 'charging';
    if (tp?.state === 'portal_open') return;

    this.directorCredits += dt * (2.0 + 1.05 * this.coeff) * (charging ? 2.6 : 1);
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;

    this.spawnTimer = charging ? 0.75 + Math.random() * 0.6 : 1.3 + Math.random() * 1.2;
    const alive = this.enemies.filter(e => !e.isDead).length;
    const max = Math.min(75, 22 + this.stage * 6 + Math.floor(this.coeff * 2.5));

    // Higher stages spawn more elite Koopas, Wisps, and Piranha Spitters
    const goombaChance = Math.max(0.22, 0.56 - (this.stage - 1) * 0.08);
    const koopaChance = goombaChance + 0.30;
    const wispChance = koopaChance + 0.14;

    let spawned = 0;
    while (this.directorCredits >= 8 && alive + spawned < max && spawned < 8) {
      const sp = this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];
      const r = Math.random();
      const type = r < goombaChance ? 'goomba' : r < koopaChance ? 'koopa' : r < wispChance ? 'wisp' : 'piranha';
      this.spawnEnemy(type, sp.x, sp.y);
      this.directorCredits -= 8;
      spawned++;
    }
  }

  spawnEnemy(type: Enemy['type'], x: number, y: number): Enemy {
    const en = new Enemy(type, x, y, this.coeff, this.stage);
    this.enemies.push(en);
    if (this.rings.length < 36) {
      this.rings.push({ x, y, r: 5, maxR: en.radius * 2, life: 0.36, maxLife: 0.36, color: '#ff0077' });
    }
    return en;
  }

  tryActivateTeleporter() {
    const tp = this.teleporter;
    const p = this.player;
    if (!tp || !p) return;
    const d = Math.hypot(p.x - tp.x, p.y - tp.y);

    if (tp.state === 'idle' && d < 120) {
      tp.state = 'charging';
      tp.bossSpawned = true;

      // Stage 1-2: 1 boss | Stage 3-5: 2 Twin Bosses | Stage 6+: 2-3 Bosses!
      const bossCount = this.stage >= 6 && this.stage % 3 === 0 ? 3 : this.stage >= 3 ? 2 : 1;
      const baseAngle = Math.atan2(tp.y - p.y, tp.x - p.x);
      this.bosses = [];
      for (let i = 0; i < bossCount; i++) {
        const ang = baseAngle + (i * Math.PI * 2) / bossCount;
        const bx = Math.max(120, Math.min(this.worldWidth - 120, tp.x + Math.cos(ang) * 340));
        const by = Math.max(120, Math.min(this.worldHeight - 120, tp.y + Math.sin(ang) * 340));
        this.bosses.push(this.spawnEnemy('bowser_boss', bx, by));
      }

      soundEngine.playBossRoar();
      this.shake = 24;
      const alertText = bossCount >= 3 ? 'TRIPLE TITAN ALERT!' : bossCount === 2 ? 'TWIN TITANS SPAWNED!' : 'DEFEND RING & SLAY BOSS!';
      setText('hud-obj-text', alertText);
      if (bossCount >= 2) {
        this.addDamageNumber(tp.x, tp.y - 50, alertText, '#ff2a7a', 2.0);
      }
      document.getElementById('hud-tp-bar-wrap')?.classList.remove('hidden');
      document.getElementById('hud-boss-bar')?.classList.remove('hidden');
    } else if (tp.state === 'portal_open' && d < 140) {
      this.nextStage();
    }
  }

  nextStage() {
    // Open Dead Cells Stage-Clear Bounty draft before warping to the next stage!
    this.pendingNextStage = true;
    this.queueUpgradeDraft('stage_clear');
  }

  updateTeleporter(dt: number) {
    const tp = this.teleporter;
    const p = this.player!;
    if (!tp) return;
    tp.pulsePhase += dt;

    if (tp.state === 'charging') {
      const d = Math.hypot(p.x - tp.x, p.y - tp.y);
      if (d < tp.radius && !p.isDead) {
        tp.chargeProgress = Math.min(100, tp.chargeProgress + dt * (100 / 40));
      }
      if (tp.chargeProgress >= 100) {
        tp.state = 'charged';
        setText('hud-obj-text', tp.bossDefeated ? '' : 'Monolith charged — slay Bowser-Leviathan!');
      }
    }

    if (tp.state === 'charged' && tp.bossDefeated) {
      tp.state = 'portal_open';
      for (const en of this.enemies) if (!en.isDead) this.killEnemy(en);
      this.shake = 16;
      soundEngine.playRelicPickup();
      setText('hud-obj-text', 'PORTAL OPEN — PRESS [E] TO WARP!');
      this.addDamageNumber(tp.x, tp.y - 40, 'PORTAL OPEN', '#00f3ff', 2);
    }
  }

  updateEffects(dt: number) {
    for (const pt of this.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.alpha = Math.max(0, pt.life / pt.maxLife);
    }
    this.particles = this.particles.filter(pt => pt.life > 0);

    for (const dn of this.damageNumbers) {
      dn.life -= dt;
      dn.x += dn.vx * dt;
      dn.y += dn.vy * dt;
    }
    this.damageNumbers = this.damageNumbers.filter(dn => dn.life > 0);

    for (const a of this.arcs) a.life -= dt;
    this.arcs = this.arcs.filter(a => a.life > 0);

    for (const r of this.rings) {
      r.life -= dt;
      r.r += (r.maxR - r.r) * Math.min(1, dt * 12);
    }
    this.rings = this.rings.filter(r => r.life > 0);

    for (const b of this.blocks) b.bumpOffset = Math.max(0, b.bumpOffset - dt * 6);
    this.shake = Math.max(0, this.shake - dt * 35);
  }

  updateCamera(dt: number) {
    const p = this.player!;
    const vw = this.pixelW * WORLD_PER_PIXEL;
    const vh = this.pixelH * WORLD_PER_PIXEL;
    const tx = p.x - vw / 2 + Math.cos(p.aimAngle) * 60;
    const ty = p.y - vh / 2 + Math.sin(p.aimAngle) * 60;

    this.camX += (tx - this.camX) * Math.min(1, dt * 6.5);
    this.camY += (ty - this.camY) * Math.min(1, dt * 6.5);

    this.camX = Math.max(0, Math.min(this.worldWidth - vw, this.camX));
    this.camY = Math.max(0, Math.min(this.worldHeight - vh, this.camY));
  }

  onPlayerDeath() {
    const p = this.player!;
    this.spawnBurst(p.x, p.y, p.def.accentColor, 65, 450);
    this.shake = 24;
    soundEngine.playBossRoar();
    this.deathTimer = 1.8;
  }

  finishRun(victory: boolean) {
    this.running = false;
    this.pausedForUpgrade = false;
    this.onUpgradeDraftClose?.();
    const p = this.player!;
    const earned = Math.floor(this.kills / 6) + (this.stage - 1) * 6;
    this.lunarStored += earned;
    localStorage.setItem('cs207_lunar', String(this.lunarStored));
    const mm = Math.floor(this.time / 60), ss = Math.floor(this.time % 60);

    this.onGameOver?.({
      victory: victory ? '1' : '0',
      'Survivor': p.def.name,
      'Time Survived': `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`,
      'Zombies Vaporized': String(this.kills),
      'Peak Combo': `x${p.comboMultiplier}`,
      'Stages Cleared': String(this.stage - 1),
      'Level Reached': String(p.level),
      'Damage Dealt': String(Math.round(p.totalDamageDealt)),
      'Lunar Spores': `+${earned} ✦`,
    });
  }

  spawnProjectile(o: Partial<Projectile> & { x: number; y: number; vx: number; vy: number }) {
    if (this.projectiles.length > 220) return;
    this.projectiles.push({
      r: 6,
      damage: 15,
      owner: 'player',
      life: 1,
      maxLife: o.life ?? 1,
      pierce: 0,
      color: '#fff',
      kind: 'bolt',
      hit: new Set(),
      procs: true,
      ...o,
    } as Projectile);
  }

  spawnEnemyProjectile(x: number, y: number, vx: number, vy: number, damage: number, color: string, r = 8, fire = false, kind = 'orb') {
    if (this.projectiles.length > 220) return;
    this.projectiles.push({
      x, y, vx, vy, r, damage, owner: 'enemy', life: 3.5, maxLife: 3.5, pierce: 0, color,
      kind: fire ? 'fire' : kind, hit: new Set(), procs: false,
    });
  }

  spawnParticle(x: number, y: number, o: Partial<Particle> = {}) {
    if (this.particles.length >= 260) return;
    const life = o.life ?? 0.45;
    this.particles.push({ x, y, vx: 0, vy: 0, size: 4, color: '#fff', alpha: 1, life, maxLife: life, glow: false, ...o });
  }

  spawnSparks(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 70 + Math.random() * 170;
      this.spawnParticle(x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, size: 2 + Math.floor(Math.random() * 3) * 2, life: 0.24 });
    }
  }

  spawnBurst(x: number, y: number, color: string, n: number, speed: number) {
    const count = Math.min(n, 260 - this.particles.length);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.spawnParticle(x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, size: 4 + Math.floor(Math.random() * 2) * 2, life: 0.32 + Math.random() * 0.28 });
    }
  }

  addDamageNumber(x: number, y: number, text: string, color: string, scale = 1) {
    if (!text || text === 'NaN' || text.includes('NaN')) return;
    this.damageNumbers.push({ x, y, text, color, life: 0.8, maxLife: 0.8, vx: (Math.random() - 0.5) * 45, vy: -110, scale });
    if (this.damageNumbers.length > 42) this.damageNumbers.shift();
  }
}

export function setText(id: string, text: string) {
  const el = document.getElementById(id);
  if (el && el.textContent !== text) el.textContent = text;
}
