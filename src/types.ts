export type SurvivorId = 'vanguard' | 'phantom' | 'huntress';

export type WeaponType = 'pistol' | 'shotgun' | 'smg' | 'grenade' | 'rocket' | 'barrel' | 'barricade';

export interface WeaponDef {
  type: WeaponType;
  name: string;
  icon: string;
  slot: number; // 1-7
  maxAmmo: number; // -1 = infinite
  ammo: number;
  fireRate: number; // shots per sec
  damage: number;
  spread: number; // radians
  pellets: number;
  range: number;
  projSpeed: number;
  unlocked: boolean;
  desc: string;
}

export interface SurvivorDef {
  id: SurvivorId;
  name: string;
  role: string;
  subtitle: string;
  color: string;
  accentColor: string;
  maxHp: number;
  armor: number;
  speed: number;
  baseDamage: number;
  critRate: number;
  dashCooldown: number;
  specialSkill: { name: string; icon: string; cd: number; desc: string };
}

export type RelicRarity = 'common' | 'uncommon' | 'rare' | 'lunar' | 'boss';

export interface RelicItem {
  id: string;
  name: string;
  rarity: RelicRarity;
  icon: string;
  desc: string;
  stackText: string;
  count: number;
  onApply?: (player: any) => void;
  onHit?: (player: any, enemy: any, damage: number, engine: any) => void;
  onKill?: (player: any, enemy: any, engine: any) => void;
  onTick?: (player: any, dt: number, engine: any) => void;
}

/** Dead Cells-style combat affixes & build synergies */
export interface PlayerAffixes {
  bonusVsBleeding: number;   // e.g. 0.70 = +70% dmg to bleeding enemies
  bonusVsBurning: number;    // e.g. 0.65 = +65% dmg to burning enemies
  burnOnDeath: number;       // stacks of fiery corpse nova on kill
  critLightning: number;     // stacks of arc lightning on critical hits
  vampOnKill: number;        // HP restored per kill (+ dash CDR)
  pierceBonus: number;       // extra projectile pierce count
  blastRadiusMult: number;   // multiplier for explosion radius (barrels, rockets, grenades)
  comboGainBonus: number;    // extra combo points per kill
  executeThreshold: number;  // e.g. 0.15 = execute non-boss enemies below 15% HP
}

export type UpgradeRarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type UpgradeCategory = 'BRUTALITY' | 'TACTICS' | 'SURVIVAL' | 'RELIC';

export interface UpgradeStat {
  value: string;          // Big bold number, e.g. "+30%", "+1", "+45"
  label: string;          // Short uppercase label, e.g. "DAMAGE", "CRIT", "MAX HP"
}

export interface UpgradeCard {
  id: string;
  title: string;
  category: UpgradeCategory;
  rarity: UpgradeRarity;
  icon: string;
  stats: UpgradeStat[];   // 2 big bold scannable stats
  perk: string;           // 1 concise golden star synergy (<= 6 words)
  stackBadge?: string;    // Optional e.g. "x1 → x2"
  relicId?: string;
  apply: (player: any, engine: any) => void;
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface WallBlock {
  x: number;
  y: number;
  w: number;
  h: number;
  color?: string;
  destructible?: boolean;
  hp?: number;
  maxHp?: number;
}

export interface PlacedObject {
  id: number;
  type: 'barrel' | 'barricade';
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  fuse?: number; // countdown seconds for chain explosions (pause-safe!)
  color: string;
}

export type EnemyType = 'goomba' | 'koopa' | 'piranha' | 'wisp' | 'bowser_boss';

export interface DamageNumber {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  scale: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  glow?: boolean;
}

export interface BloodSplat {
  x: number;
  y: number;
  radius: number;
  color: string;
  alpha: number;
  seed: number;
}

export interface QuestionBlock {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  hit: boolean;
  itemType: 'ammo' | 'heal' | 'star' | 'relic';
  bumpOffset: number;
  glowPhase: number;
}

export interface WarpPipe {
  id: number;
  x: number;
  y: number;
  radius: number;
  targetPipeId: number;
  cooldown: number;
}

export interface Teleporter {
  x: number;
  y: number;
  radius: number;
  chargeProgress: number; // 0 to 100
  state: 'idle' | 'charging' | 'charged' | 'portal_open';
  bossSpawned: boolean;
  bossDefeated: boolean;
  pulsePhase: number;
}

export interface VortexEffect {
  x: number;
  y: number;
  radius: number;
  dps: number;
  life: number;
  maxLife: number;
  tickTimer: number;
}
