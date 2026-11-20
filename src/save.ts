// CYBER-SPORE 207 // Browser Save System (localStorage)
// Saves the run as a stage checkpoint + full player build. Continuing restarts the
// current stage with your exact build (level, stats, relics, perks, weapons, ammo).
// The save is wiped the moment the player dies.
import { ALL_RELIC_ITEMS } from './items';
import type { PlayerAffixes, SurvivorId, WeaponType } from './types';
import type { DraftSource } from './upgrades';

const SAVE_KEY = 'cs207_run_save_v1';

export interface RunSave {
  version: 1;
  savedAt: number;
  survivorId: SurvivorId;
  stage: number;
  time: number;
  kills: number;
  pendingDrafts: DraftSource[];
  pendingNextStage: boolean;
  player: {
    hp: number;
    maxHp: number;
    armor: number;
    level: number;
    xp: number;
    xpToNext: number;
    speed: number;
    dashCooldown: number;
    maxComboTimer: number;
    stats: { damageMult: number; attackSpeed: number; critRate: number; damage: number };
    affixes: PlayerAffixes;
    items: { id: string; count: number }[];
    weapons: Record<string, { ammo: number; unlocked: boolean }>;
    activeWeaponIndex: number;
    totalDamageDealt: number;
  };
}

export function hasRunSave(): boolean {
  return loadRunSave() !== null;
}

export function loadRunSave(): RunSave | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as RunSave;
    if (!data || data.version !== 1 || !data.player || !data.survivorId) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearRunSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

/** Snapshot the engine's current run. Never saves a dead player. */
export function writeRunSave(engine: any): void {
  const p = engine.player;
  if (!p || p.isDead || engine.deathTimer > 0) return;

  // Preserve any open/queued upgrade drafts so the player never loses a pick
  const pendingDrafts: DraftSource[] = [];
  if (engine.pausedForUpgrade && engine.activeDraftSource) pendingDrafts.push(engine.activeDraftSource);
  for (const q of engine.upgradeQueue || []) pendingDrafts.push(q);

  const weapons: Record<string, { ammo: number; unlocked: boolean }> = {};
  for (const key of p.weaponOrder as WeaponType[]) {
    const w = p.weapons[key];
    weapons[key] = { ammo: w.ammo, unlocked: !!w.unlocked };
  }

  const save: RunSave = {
    version: 1,
    savedAt: Date.now(),
    survivorId: engine.survivorId,
    stage: engine.stage,
    time: engine.time,
    kills: engine.kills,
    pendingDrafts,
    pendingNextStage: !!engine.pendingNextStage,
    player: {
      hp: p.hp,
      maxHp: p.maxHp,
      armor: p.armor,
      level: p.level,
      xp: p.xp,
      xpToNext: p.xpToNext,
      speed: p.def.speed,
      dashCooldown: p.def.dashCooldown,
      maxComboTimer: p.maxComboTimer,
      stats: { ...p.stats },
      affixes: { ...p.affixes },
      items: p.items.map((i: any) => ({ id: i.id, count: i.count })),
      weapons,
      activeWeaponIndex: p.activeWeaponIndex,
      totalDamageDealt: p.totalDamageDealt,
    },
  };

  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* storage full / disabled — ignore */
  }
}

/** Restore a saved build onto a freshly created player (does NOT re-run relic onApply). */
export function applyPlayerSave(p: any, s: RunSave['player']): void {
  p.maxHp = s.maxHp;
  p.hp = Math.max(1, Math.min(s.maxHp, s.hp));
  p.armor = s.armor;
  p.level = s.level;
  p.xp = s.xp;
  p.xpToNext = s.xpToNext;
  p.def.speed = s.speed;
  p.def.dashCooldown = s.dashCooldown;
  p.maxComboTimer = s.maxComboTimer;
  p.stats = { ...p.stats, ...s.stats };
  p.affixes = { ...p.affixes, ...s.affixes };
  p.totalDamageDealt = s.totalDamageDealt || 0;

  // Relic effects are already baked into the saved stats -> restore stacks directly
  p.items = [];
  for (const saved of s.items) {
    const def = ALL_RELIC_ITEMS.find((r) => r.id === saved.id);
    if (def) p.items.push({ ...def, count: saved.count });
  }

  for (const key of Object.keys(s.weapons)) {
    const w = p.weapons[key];
    if (!w) continue;
    w.unlocked = s.weapons[key].unlocked;
    w.ammo = s.weapons[key].ammo;
  }

  const idx = s.activeWeaponIndex;
  const type = p.weaponOrder[idx];
  p.activeWeaponIndex = type && p.weapons[type]?.unlocked ? idx : 0;
}

export function describeRunSave(s: RunSave): string {
  const names: Record<string, string> = { vanguard: 'VANGUARD', phantom: 'PHANTOM-X', huntress: 'HUNTRESS' };
  const mm = Math.floor(s.time / 60);
  const ss = Math.floor(s.time % 60);
  return `${names[s.survivorId] || s.survivorId} · STAGE ${String(s.stage).padStart(2, '0')} · LVL ${s.player.level} · ${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
