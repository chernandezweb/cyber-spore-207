// CYBER-SPORE 207 // Dead Cells-Style 3-Card Upgrade & Affix Drafting System
import { ALL_RELIC_ITEMS } from './items';
import type { UpgradeCard, UpgradeRarity } from './types';

export type DraftSource = 'levelup' | 'relic' | 'boss_relic' | 'stage_clear';

interface AffixDef {
  id: string;
  label: string;
  apply: (player: any) => void;
}

const BONUS_AFFIX_POOL: AffixDef[] = [
  {
    id: 'bleed_bonus',
    label: '★ +70% bonus damage to bleeding targets',
    apply: (p) => { p.affixes.bonusVsBleeding += 0.70; },
  },
  {
    id: 'burn_bonus',
    label: '★ +65% bonus damage to burning targets',
    apply: (p) => { p.affixes.bonusVsBurning += 0.65; },
  },
  {
    id: 'burn_death',
    label: '★ Victims explode into flames when they die',
    apply: (p) => { p.affixes.burnOnDeath += 1; },
  },
  {
    id: 'crit_zap',
    label: '★ Critical hits fire chain-lightning arcs',
    apply: (p) => { p.affixes.critLightning += 1; },
  },
  {
    id: 'vamp_kill',
    label: '★ Kills restore +4 HP & shave 0.25s off Dash CD',
    apply: (p) => { p.affixes.vampOnKill += 4; },
  },
  {
    id: 'pierce_plus',
    label: '★ All projectiles gain +1 pierce through swarms',
    apply: (p) => { p.affixes.pierceBonus += 1; },
  },
  {
    id: 'blast_radius',
    label: '★ Barrels, rockets & blasts gain +35% radius',
    apply: (p) => { p.affixes.blastRadiusMult += 0.35; },
  },
  {
    id: 'combo_surge',
    label: '★ Kills grant +1 extra Boxhead Combo stack',
    apply: (p) => { p.affixes.comboGainBonus += 1; },
  },
  {
    id: 'execute',
    label: '★ Instantly execute non-boss zombies below 16% HP',
    apply: (p) => { p.affixes.executeThreshold = Math.min(0.32, p.affixes.executeThreshold + 0.16); },
  },
];

/** Dedicated Dead Cells-style Mutation Cards (Brutality / Tactics / Survival) */
function createMutationPool(player: any): UpgradeCard[] {
  const curDps = Math.round(player.damage * player.stats.attackSpeed * 4.5);
  return [
    {
      id: 'mut_hemorrhage',
      title: 'HEMORRHAGE OVERCLOCK',
      category: 'BRUTALITY',
      rarity: 'rare',
      icon: '🩸',
      stats: ['+30% WEAPON DPS', '+10% CRIT CHANCE', `EST. BASE DPS ${Math.round(curDps * 1.3)}`],
      affixes: [
        '★ +70% bonus damage to bleeding targets',
        '★ Attacks gain +20% Spore Bleed proc',
      ],
      flavor: 'Serrated bio-alloy ammunition engineered for crimson chains.',
      apply: (p) => {
        p.stats.damageMult += 0.30;
        p.stats.critRate += 0.10;
        p.affixes.bonusVsBleeding += 0.70;
        const dagger = ALL_RELIC_ITEMS.find(i => i.id === 'tri_tip_dagger');
        if (dagger) p.addItem({ ...dagger, count: 1 });
      },
    },
    {
      id: 'mut_pyro_corpse',
      title: 'THERMITE NECROSIS',
      category: 'BRUTALITY',
      rarity: 'rare',
      icon: '🔥',
      stats: ['+25% WEAPON DPS', '+35% BLAST RADIUS'],
      affixes: [
        '★ Victims explode into flames when they die',
        '★ +65% bonus damage to burning targets',
      ],
      flavor: 'Turn every fallen swarm cluster into a chain-detonating inferno.',
      apply: (p) => {
        p.stats.damageMult += 0.25;
        p.affixes.blastRadiusMult += 0.35;
        p.affixes.burnOnDeath += 1;
        p.affixes.bonusVsBurning += 0.65;
      },
    },
    {
      id: 'mut_rail_piercer',
      title: 'HYPER-RAIL CAPACITOR',
      category: 'TACTICS',
      rarity: 'uncommon',
      icon: '⚡',
      stats: ['+22% FIRE RATE', '+12% CRIT CHANCE', '+40% ALL AMMO'],
      affixes: [
        '★ All projectiles gain +1 pierce through swarms',
        '★ Critical hits fire chain-lightning arcs',
      ],
      flavor: 'Overvolted rails punch straight through entire zombie corridors.',
      apply: (p) => {
        p.stats.attackSpeed *= 1.22;
        p.stats.critRate += 0.12;
        p.affixes.pierceBonus += 1;
        p.affixes.critLightning += 1;
        p.addAmmoToAll(0.4);
      },
    },
    {
      id: 'mut_vamp_adrenaline',
      title: 'CARAPACE VAMPIRISM',
      category: 'SURVIVAL',
      rarity: 'uncommon',
      icon: '💚',
      stats: ['+45 MAX HP', '+10 ARMOR', 'HEAL +50% HP'],
      affixes: [
        '★ Kills restore +4 HP & shave 0.25s off Dash CD',
      ],
      flavor: 'Siphon bio-spore vitality from every corpse to stay immortal.',
      apply: (p) => {
        p.maxHp += 45;
        p.armor += 10;
        p.heal(p.maxHp * 0.5);
        p.affixes.vampOnKill += 4;
      },
    },
    {
      id: 'mut_combo_frenzy',
      title: 'BOXHEAD KILL-FRENZY',
      category: 'BRUTALITY',
      rarity: 'uncommon',
      icon: '💀',
      stats: ['+20% WEAPON DPS', '+15% MOVE SPEED', '+4 BARRELS'],
      affixes: [
        '★ Kills grant +1 extra Boxhead Combo stack',
        '★ Combo timer extended +1.2s',
      ],
      flavor: 'Keep the classic x10 multiplier roaring through the bunker.',
      apply: (p) => {
        p.stats.damageMult += 0.20;
        p.def.speed *= 1.15;
        p.maxComboTimer += 1.2;
        p.affixes.comboGainBonus += 1;
        p.addAmmo('barrel', 4);
      },
    },
    {
      id: 'mut_executioner',
      title: 'VOID GUILLOTINE PROTOCOL',
      category: 'TACTICS',
      rarity: 'legendary',
      icon: '⚔️',
      stats: ['+35% WEAPON DPS', '+15% CRIT CHANCE', '+15% FIRE RATE'],
      affixes: [
        '★ Instantly execute non-boss zombies below 16% HP',
        '★ Critical hits fire chain-lightning arcs',
      ],
      flavor: 'Zero mercy. Wounded targets dissolve instantly into neon ash.',
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
      title: 'ORDNANCE STOCKPILE',
      category: 'SURVIVAL',
      rarity: 'common',
      icon: '🛢️',
      stats: ['+60% ALL AMMO', '+5 BARRELS', '+4 ROCKETS', '+25 MAX HP'],
      affixes: [
        '★ Barrels, rockets & blasts gain +35% radius',
      ],
      flavor: 'Refill every launcher and rig the entire sector to blow.',
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
      title: 'OVERCLOCKED OPTICS',
      category: 'TACTICS',
      rarity: 'common',
      icon: '🎯',
      stats: ['+24% WEAPON DPS', '+14% CRIT CHANCE'],
      affixes: [
        '★ All projectiles gain +1 pierce through swarms',
      ],
      flavor: 'Precision tactical targeting firmware tuned for maximum DPS.',
      apply: (p) => {
        p.stats.damageMult += 0.24;
        p.stats.critRate += 0.14;
        p.affixes.pierceBonus += 1;
      },
    },
    {
      id: 'mut_juggernaut',
      title: 'TITANIUM BUNKER FRAME',
      category: 'SURVIVAL',
      rarity: 'common',
      icon: '🛡️',
      stats: ['+55 MAX HP', '+15 ARMOR', '+5 BARRICADES'],
      affixes: [
        '★ Full HP restoration on selection',
      ],
      flavor: 'Fortify your armor plating and lock down choke points.',
      apply: (p) => {
        p.maxHp += 55;
        p.armor += 15;
        p.hp = p.maxHp;
        p.addAmmo('barricade', 5);
      },
    },
  ];
}

/** Wraps each Risk of Rain 2 RelicItem into a rich Dead Cells-style draft card (with optional bonus affix!) */
function createRelicCards(player: any, boostRarity: boolean): UpgradeCard[] {
  return ALL_RELIC_ITEMS.map((item) => {
    const owned = player.getItemCount(item.id);
    const rarity: UpgradeRarity =
      item.rarity === 'rare'
        ? (boostRarity ? 'legendary' : 'rare')
        : item.rarity === 'uncommon'
        ? 'uncommon'
        : 'common';

    const stats: string[] = [];
    if (item.id === 'super_shroom') stats.push('+25 MAX HP', '+4.0 HP/S REGEN');
    else if (item.id === 'fire_flower') stats.push('+140% BURN DMG', 'IGNITE ON HIT');
    else if (item.id === 'starman_core') stats.push('8% STARMAN ON KILL', '+50% SPEED OVERDRIVE');
    else if (item.id === 'hopoo_feather') stats.push('-25% DASH CD', '+15% MOVE SPEED');
    else if (item.id === 'soldiers_syringe') stats.push('+15% FIRE RATE', '+8% MOVE SPEED');
    else if (item.id === 'ukulele_tesla') stats.push('25% CHAIN LIGHTNING', 'UP TO 4 TARGETS');
    else if (item.id === 'tough_times_shell') stats.push('+15% BLOCK CHANCE', 'FULL DMG DEFLECT');
    else if (item.id === 'tri_tip_dagger') stats.push('+15% BLEED CHANCE', '240% BLEED DOT');
    else if (item.id === 'lens_makers_glasses') stats.push('+10% CRIT CHANCE', '2.0x CRIT DAMAGE');
    else if (item.id === 'behemoth_core') stats.push('+60% AOE BLAST', 'EXPLOSIVE ROUNDS');

    if (owned > 0) {
      stats.push(`STACK x${owned} → x${owned + 1}`);
    }

    const affixes: string[] = [`★ ${item.stackText}`];

    // Roll a bonus Dead Cells synergy affix on rare/legendary/boosted relic cards!
    let bonusAffix: AffixDef | null = null;
    if (rarity === 'rare' || rarity === 'legendary' || boostRarity) {
      bonusAffix = BONUS_AFFIX_POOL[Math.floor(Math.random() * BONUS_AFFIX_POOL.length)];
      affixes.push(bonusAffix.label);
    }

    return {
      id: `relic_${item.id}`,
      title: item.name.toUpperCase(),
      category: 'RELIC',
      rarity,
      icon: item.icon,
      stats,
      affixes,
      flavor: item.desc,
      relicId: item.id,
      apply: (p) => {
        p.addItem({ ...item, count: 1 });
        if (bonusAffix) bonusAffix.apply(p);
      },
    };
  });
}

/** Rolls 3 distinct Dead Cells-style cards with balanced archetypes & rarity weighting */
export function rollUpgradeChoices(player: any, source: DraftSource): UpgradeCard[] {
  const boostRarity = source === 'boss_relic' || source === 'stage_clear';
  const mutations = createMutationPool(player);
  const relics = createRelicCards(player, boostRarity);

  const pickWeighted = (pool: UpgradeCard[], exclude: Set<string>): UpgradeCard => {
    const avail = pool.filter(c => !exclude.has(c.id));
    if (avail.length === 0) return pool[0];
    const weights = avail.map(c => {
      if (boostRarity) {
        return c.rarity === 'legendary' ? 4 : c.rarity === 'rare' ? 5 : c.rarity === 'uncommon' ? 3 : 1;
      }
      return c.rarity === 'legendary' ? 1.2 : c.rarity === 'rare' ? 2.5 : c.rarity === 'uncommon' ? 4 : 4.5;
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

  if (source === 'relic' || source === 'boss_relic') {
    // 2 Relic cards + 1 Dead Cells Mutation card
    for (let i = 0; i < 2; i++) {
      const c = pickWeighted(relics, used);
      used.add(c.id);
      chosen.push(c);
    }
    const m = pickWeighted(mutations, used);
    used.add(m.id);
    chosen.push(m);
  } else {
    // Level-Up / Stage Clear: 2 Dead Cells Mutations + 1 RoR2 Relic card
    for (let i = 0; i < 2; i++) {
      const m = pickWeighted(mutations, used);
      used.add(m.id);
      chosen.push(m);
    }
    const r = pickWeighted(relics, used);
    used.add(r.id);
    chosen.push(r);
  }

  return chosen;
}

export function getDraftHeader(source: DraftSource, level: number, stage: number): { title: string; subtitle: string } {
  switch (source) {
    case 'levelup':
      return {
        title: `LEVEL ${level} MUTATION DRAFT`,
        subtitle: 'CHOOSE 1 COMBAT UPGRADE — PRESS [1] [2] [3] OR CLICK A CARD',
      };
    case 'boss_relic':
      return {
        title: 'APEX TITAN RELIC VAULT',
        subtitle: 'HIGH-TIER SYNERGY DROP — PRESS [1] [2] [3] OR CLICK A CARD',
      };
    case 'stage_clear':
      return {
        title: `SECTOR ${String(stage).padStart(2, '0')} CLEARED // BOUNTY`,
        subtitle: 'SELECT YOUR NEXT-STAGE MUTATION BEFORE WARPING',
      };
    default:
      return {
        title: 'RELIC CACHE DISCOVERED',
        subtitle: 'SELECT 1 SYNERGY RELIC — PRESS [1] [2] [3] OR CLICK A CARD',
      };
  }
}
