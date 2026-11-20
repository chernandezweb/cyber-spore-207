// CYBER-SPORE 207 // Dead Cells-Style 3-Card Upgrade & Affix Drafting System
// Clean, scannable, big-number cards designed to be read in <0.5s mid-combat.
import { ALL_RELIC_ITEMS } from './items';
import type { UpgradeCard, UpgradeRarity, UpgradeStat, WeaponType } from './types';

export type DraftSource = 'levelup' | 'relic' | 'boss_relic' | 'stage_clear';

/** Progressive Weapon Unlock cards offered in the draft while weapons are locked */
const WEAPON_UNLOCK_META: Record<Exclude<WeaponType, 'pistol' | 'barrel'>, {
  title: string;
  rarity: UpgradeRarity;
  icon: string;
  stats: UpgradeStat[];
  perk: string;
  minLevel: number;
}> = {
  shotgun: {
    title: 'UNLOCK: SHOTGUN',
    rarity: 'uncommon',
    icon: '💥',
    stats: [{ value: '6x13', label: 'PELLETS' }, { value: '30', label: 'SHELLS' }],
    perk: '★ Pierces crowds at close range',
    minLevel: 1,
  },
  smg: {
    title: 'UNLOCK: CYBER-SMG',
    rarity: 'uncommon',
    icon: '⚡',
    stats: [{ value: '10.5/s', label: 'FIRE RATE' }, { value: '120', label: 'ROUNDS' }],
    perk: '★ Rapid-fire swarm shredder',
    minLevel: 1,
  },
  grenade: {
    title: 'UNLOCK: GRENADES',
    rarity: 'rare',
    icon: '💣',
    stats: [{ value: '155', label: 'BLAST DMG' }, { value: '13', label: 'CHARGES' }],
    perk: '★ Bounces off walls into swarms',
    minLevel: 2,
  },
  barricade: {
    title: 'UNLOCK: BARRICADE',
    rarity: 'uncommon',
    icon: '🛡️',
    stats: [{ value: '150', label: 'WALL HP' }, { value: '10', label: 'UNITS' }],
    perk: '★ Fortify chokes with [F]',
    minLevel: 2,
  },
  rocket: {
    title: 'UNLOCK: ROCKETS',
    rarity: 'legendary',
    icon: '🚀',
    stats: [{ value: '230', label: 'AOE DMG' }, { value: '10', label: 'ROCKETS' }],
    perk: '★ Heavy anti-boss shockwave',
    minLevel: 3,
  },
};

function createWeaponUnlockCards(player: any): UpgradeCard[] {
  const cards: UpgradeCard[] = [];
  const order: Exclude<WeaponType, 'pistol' | 'barrel'>[] = ['shotgun', 'smg', 'grenade', 'barricade', 'rocket'];
  for (const wType of order) {
    const w = player.weapons?.[wType];
    if (!w || w.unlocked) continue;
    const meta = WEAPON_UNLOCK_META[wType];
    if (player.level < meta.minLevel && cards.length > 0) continue;
    cards.push({
      id: `unlock_${wType}`,
      title: meta.title,
      category: 'TACTICS',
      rarity: meta.rarity,
      icon: meta.icon,
      stats: meta.stats,
      perk: meta.perk,
      apply: (p) => {
        p.unlockWeapon(wType);
      },
    });
  }
  return cards;
}

interface AffixDef {
  id: string;
  label: string;
  apply: (player: any) => void;
}

const BONUS_AFFIX_POOL: AffixDef[] = [
  { id: 'bleed_bonus', label: '★ +50% DMG vs Bleeding', apply: (p) => { p.affixes.bonusVsBleeding = Math.min(2.0, p.affixes.bonusVsBleeding + 0.50); } },
  { id: 'burn_bonus', label: '★ +50% DMG vs Burning', apply: (p) => { p.affixes.bonusVsBurning = Math.min(2.0, p.affixes.bonusVsBurning + 0.50); } },
  { id: 'burn_death', label: '★ Victims burn on death', apply: (p) => { p.affixes.burnOnDeath += 1; } },
  { id: 'crit_zap', label: '★ Crits chain lightning', apply: (p) => { p.affixes.critLightning += 1; } },
  { id: 'vamp_kill', label: '★ +4 HP on every kill', apply: (p) => { p.affixes.vampOnKill += 4; } },
  { id: 'pierce_plus', label: '★ +1 Projectile Pierce', apply: (p) => { p.affixes.pierceBonus += 1; } },
  { id: 'blast_radius', label: '★ +30% Blast Radius', apply: (p) => { p.affixes.blastRadiusMult = Math.min(2.2, p.affixes.blastRadiusMult + 0.30); } },
  { id: 'combo_surge', label: '★ 2x Faster Combo', apply: (p) => { p.affixes.comboGainBonus += 1; } },
  { id: 'execute', label: '★ Execute foes <15% HP', apply: (p) => { p.affixes.executeThreshold = Math.min(0.25, p.affixes.executeThreshold + 0.12); } },
];

/** Dedicated Dead Cells-style Mutation Cards with huge scannable stats */
function createMutationPool(): UpgradeCard[] {
  return [
    {
      id: 'mut_hemorrhage',
      title: 'HEMORRHAGE',
      category: 'BRUTALITY',
      rarity: 'rare',
      icon: '🩸',
      stats: [
        { value: '+30%', label: 'DAMAGE' },
        { value: '+10%', label: 'CRIT' },
      ],
      perk: '★ +70% DMG vs Bleeding + Bleed',
      apply: (p) => {
        p.stats.damageMult += 0.25;
        p.stats.critRate += 0.10;
        p.affixes.bonusVsBleeding = Math.min(2.0, p.affixes.bonusVsBleeding + 0.50);
        const dagger = ALL_RELIC_ITEMS.find(i => i.id === 'tri_tip_dagger');
        if (dagger) p.addItem({ ...dagger, count: 1 });
      },
    },
    {
      id: 'mut_pyro_corpse',
      title: 'THERMITE BLAST',
      category: 'BRUTALITY',
      rarity: 'rare',
      icon: '🔥',
      stats: [
        { value: '+25%', label: 'DAMAGE' },
        { value: '+35%', label: 'BLAST AOE' },
      ],
      perk: '★ Victims burn on death (+65% vs Burn)',
      apply: (p) => {
        p.stats.damageMult += 0.22;
        p.affixes.blastRadiusMult = Math.min(2.2, p.affixes.blastRadiusMult + 0.30);
        p.affixes.burnOnDeath += 1;
        p.affixes.bonusVsBurning = Math.min(2.0, p.affixes.bonusVsBurning + 0.50);
      },
    },
    {
      id: 'mut_rail_piercer',
      title: 'HYPER-RAIL',
      category: 'TACTICS',
      rarity: 'uncommon',
      icon: '⚡',
      stats: [
        { value: '+22%', label: 'FIRE RATE' },
        { value: '+1', label: 'PIERCE' },
      ],
      perk: '★ Crits fire chain lightning',
      apply: (p) => {
        p.stats.attackSpeed *= 1.22;
        p.stats.critRate += 0.10;
        p.affixes.pierceBonus += 1;
        p.affixes.critLightning += 1;
        p.addAmmoToAll(0.4);
      },
    },
    {
      id: 'mut_vamp_adrenaline',
      title: 'VAMPIRIC SHELL',
      category: 'SURVIVAL',
      rarity: 'uncommon',
      icon: '💚',
      stats: [
        { value: '+45', label: 'MAX HP' },
        { value: '+10', label: 'ARMOR' },
      ],
      perk: '★ +4 HP & faster Dash per kill',
      apply: (p) => {
        p.maxHp += 45;
        p.armor += 10;
        p.heal(p.maxHp * 0.5);
        p.affixes.vampOnKill += 4;
      },
    },
    {
      id: 'mut_combo_frenzy',
      title: 'KILL FRENZY',
      category: 'BRUTALITY',
      rarity: 'uncommon',
      icon: '💀',
      stats: [
        { value: '+20%', label: 'DAMAGE' },
        { value: '+8%', label: 'SPEED' },
      ],
      perk: '★ 2x Combo speed + 4 Barrels',
      apply: (p) => {
        p.stats.damageMult += 0.20;
        p.def.speed = Math.min(460, p.def.speed + 24);
        p.maxComboTimer += 1.2;
        p.affixes.comboGainBonus += 1;
        p.addAmmo('barrel', 4);
      },
    },
    {
      id: 'mut_executioner',
      title: 'VOID GUILLOTINE',
      category: 'TACTICS',
      rarity: 'legendary',
      icon: '⚔️',
      stats: [
        { value: '+35%', label: 'DAMAGE' },
        { value: '+15%', label: 'CRIT' },
      ],
      perk: '★ Execute foes <16% HP + Crit Zap',
      apply: (p) => {
        p.stats.damageMult += 0.35;
        p.stats.critRate += 0.15;
        p.stats.attackSpeed *= 1.15;
        p.affixes.executeThreshold = Math.min(0.32, p.affixes.executeThreshold + 0.16);
        p.affixes.critLightning += 1;
      },
    },
    {
      id: 'mut_demolition',
      title: 'ORDNANCE DROP',
      category: 'SURVIVAL',
      rarity: 'common',
      icon: '🛢️',
      stats: [
        { value: '+60%', label: 'ALL AMMO' },
        { value: '+35%', label: 'BLAST AOE' },
      ],
      perk: '★ +5 Barrels · +4 Rockets · +25 HP',
      apply: (p) => {
        p.maxHp += 25;
        p.heal(25);
        p.addAmmoToAll(0.6);
        p.addAmmo('barrel', 5);
        p.addAmmo('rocket', 4);
        p.affixes.blastRadiusMult += 0.35;
      },
    },
    {
      id: 'mut_glass_cannon',
      title: 'OPTICS OVERCLOCK',
      category: 'TACTICS',
      rarity: 'common',
      icon: '🎯',
      stats: [
        { value: '+24%', label: 'DAMAGE' },
        { value: '+14%', label: 'CRIT' },
      ],
      perk: '★ +1 Projectile Pierce',
      apply: (p) => {
        p.stats.damageMult += 0.24;
        p.stats.critRate += 0.14;
        p.affixes.pierceBonus += 1;
      },
    },
    {
      id: 'mut_juggernaut',
      title: 'BUNKER FRAME',
      category: 'SURVIVAL',
      rarity: 'common',
      icon: '🛡️',
      stats: [
        { value: '+55', label: 'MAX HP' },
        { value: '+15', label: 'ARMOR' },
      ],
      perk: '★ Full Heal + 5 Barricades',
      apply: (p) => {
        p.maxHp += 55;
        p.armor += 15;
        p.hp = p.maxHp;
        p.addAmmo('barricade', 5);
      },
    },
  ];
}

const RELIC_HERO_STATS: Record<string, { stats: UpgradeStat[]; perk: string }> = {
  super_shroom: {
    stats: [{ value: '+25', label: 'MAX HP' }, { value: '+4/s', label: 'REGEN' }],
    perk: '★ Heals fast while standing still',
  },
  fire_flower: {
    stats: [{ value: '140%', label: 'BURN DMG' }, { value: '3s', label: 'IGNITE' }],
    perk: '★ All hits ignite enemies',
  },
  starman_core: {
    stats: [{ value: '8%', label: 'ON KILL' }, { value: '5s', label: 'INVINCIBLE' }],
    perk: '★ Contact vaporizes swarms',
  },
  hopoo_feather: {
    stats: [{ value: '-25%', label: 'DASH CD' }, { value: '+15%', label: 'SPEED' }],
    perk: '★ Rapid dodge mobility',
  },
  soldiers_syringe: {
    stats: [{ value: '+15%', label: 'FIRE RATE' }, { value: '+8%', label: 'SPEED' }],
    perk: '★ Stacks infinitely',
  },
  ukulele_tesla: {
    stats: [{ value: '25%', label: 'ZAP PROC' }, { value: '4', label: 'TARGETS' }],
    perk: '★ Arcs chain lightning on hit',
  },
  tough_times_shell: {
    stats: [{ value: '+15%', label: 'BLOCK' }, { value: '0', label: 'DMG TAKEN' }],
    perk: '★ Deflects incoming hits',
  },
  tri_tip_dagger: {
    stats: [{ value: '+15%', label: 'BLEED' }, { value: '240%', label: 'DOT DMG' }],
    perk: '★ Stacks bleed damage',
  },
  lens_makers_glasses: {
    stats: [{ value: '+10%', label: 'CRIT' }, { value: '2.0x', label: 'CRIT DMG' }],
    perk: '★ Double damage on crits',
  },
  behemoth_core: {
    stats: [{ value: '+60%', label: 'AOE DMG' }, { value: 'ALL', label: 'EXPLOSIVE' }],
    perk: '★ Every shot explodes on hit',
  },
};

function createRelicCards(player: any, boostRarity: boolean): UpgradeCard[] {
  return ALL_RELIC_ITEMS.map((item) => {
    const owned = player.getItemCount(item.id);
    const rarity: UpgradeRarity =
      item.rarity === 'rare'
        ? (boostRarity ? 'legendary' : 'rare')
        : item.rarity === 'uncommon'
        ? 'uncommon'
        : 'common';

    const meta = RELIC_HERO_STATS[item.id] || {
      stats: [{ value: '+1', label: 'RELIC' }],
      perk: `★ ${item.stackText}`,
    };

    let bonusAffix: AffixDef | null = null;
    let perk = meta.perk;
    if (rarity === 'rare' || rarity === 'legendary' || boostRarity) {
      bonusAffix = BONUS_AFFIX_POOL[Math.floor(Math.random() * BONUS_AFFIX_POOL.length)];
      perk = bonusAffix.label;
    }

    return {
      id: `relic_${item.id}`,
      title: item.name.toUpperCase(),
      category: 'RELIC',
      rarity,
      icon: item.icon,
      stats: meta.stats,
      perk,
      stackBadge: owned > 0 ? `x${owned} → x${owned + 1}` : undefined,
      relicId: item.id,
      apply: (p) => {
        p.addItem({ ...item, count: 1 });
        if (bonusAffix) bonusAffix.apply(p);
      },
    };
  });
}

export function rollUpgradeChoices(player: any, source: DraftSource): UpgradeCard[] {
  const boostRarity = source === 'boss_relic' || source === 'stage_clear';
  const mutations = createMutationPool();
  const relics = createRelicCards(player, boostRarity);
  const weaponUnlocks = createWeaponUnlockCards(player);

  const pickWeighted = (pool: UpgradeCard[], exclude: Set<string>): UpgradeCard => {
    const avail = pool.filter(c => !exclude.has(c.id));
    if (avail.length === 0) return pool[0];
    const weights = avail.map(c => {
      if (boostRarity) {
        return c.rarity === 'legendary' ? 4 : c.rarity === 'rare' ? 5 : c.rarity === 'uncommon' ? 3 : 1;
      }
      return c.rarity === 'legendary' ? 1.0 : c.rarity === 'rare' ? 2.2 : c.rarity === 'uncommon' ? 4 : 4.8;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < avail.length; i++) {
      r -= weights[i];
      if (r <= 0) return avail[i];
    }
    return avail[avail.length - 1];
  };

  const chosen: UpgradeCard[] = [];
  const used = new Set<string>();

  // Offer 1 locked weapon unlock card whenever the player still has locked weapons!
  if (weaponUnlocks.length > 0 && (source === 'levelup' || source === 'stage_clear' || Math.random() < 0.55)) {
    const wCard = weaponUnlocks[Math.floor(Math.random() * Math.min(2, weaponUnlocks.length))];
    used.add(wCard.id);
    chosen.push(wCard);
  }

  if (source === 'relic' || source === 'boss_relic') {
    while (chosen.length < 2) {
      const c = pickWeighted(relics, used);
      used.add(c.id);
      chosen.push(c);
    }
    while (chosen.length < 3) {
      const m = pickWeighted(mutations, used);
      used.add(m.id);
      chosen.push(m);
    }
  } else {
    while (chosen.length < 2) {
      const m = pickWeighted(mutations, used);
      used.add(m.id);
      chosen.push(m);
    }
    while (chosen.length < 3) {
      const r = pickWeighted(relics, used);
      used.add(r.id);
      chosen.push(r);
    }
  }

  return chosen;
}

export function getDraftHeader(source: DraftSource, level: number, stage: number): { title: string; subtitle: string } {
  switch (source) {
    case 'levelup':
      return { title: `LEVEL ${level} UPGRADE`, subtitle: 'PRESS [1] [2] [3] OR CLICK' };
    case 'boss_relic':
      return { title: 'BOSS RELIC VAULT', subtitle: 'PRESS [1] [2] [3] OR CLICK' };
    case 'stage_clear':
      return { title: `STAGE ${String(stage).padStart(2, '0')} CLEAR`, subtitle: 'PICK BOUNTY BEFORE WARP' };
    default:
      return { title: 'RELIC CACHE', subtitle: 'PRESS [1] [2] [3] OR CLICK' };
  }
}
