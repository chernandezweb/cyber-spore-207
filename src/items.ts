import type { RelicItem, RelicRarity } from './types';

export const ALL_RELIC_ITEMS: Omit<RelicItem, 'count'>[] = [
  {
    id: 'super_shroom',
    name: 'Neon Super-Shroom',
    rarity: 'common',
    icon: '🍄',
    desc: '+25 Max HP. Regenerates +4.0 HP/sec when stationary.',
    stackText: '+25 HP & +3.0 HP/s regen per stack',
    onApply: (player) => {
      player.maxHp += 25;
      player.hp = Math.min(player.maxHp, player.hp + 25);
    },
    onTick: (player, dt, engine) => {
      if (Math.hypot(player.vx, player.vy) < 10) {
        const stacks = player.getItemCount('super_shroom');
        const heal = (2.5 + stacks * 3.0) * dt;
        player.heal(heal, false);
        if (Math.random() < 0.15) {
          engine.spawnParticle(player.x + (Math.random() - 0.5) * 30, player.y + (Math.random() - 0.5) * 30, {
            size: 3,
            color: '#00ffaa',
            vy: -30,
            life: 0.5,
          });
        }
      }
    }
  },
  {
    id: 'fire_flower',
    name: 'Pyro-Plasma Flower',
    rarity: 'uncommon',
    icon: '🔥',
    desc: 'Attacks ignite enemies for 140% total burn damage over 3 seconds.',
    stackText: '+70% burn damage per stack',
    onHit: (player, enemy, _dmg, engine) => {
      const stacks = player.getItemCount('fire_flower');
      const baseDmg = player.damage || player.def?.baseDamage || 16;
      enemy.applyBurn(baseDmg * (0.9 + stacks * 0.5), 3.0);
      engine.spawnSparks(enemy.x, enemy.y, '#ff4400', 4);
    }
  },
  {
    id: 'starman_core',
    name: 'Starman Singularity',
    rarity: 'rare',
    icon: '⭐',
    desc: 'On kill, 8% chance to enter Invincible Overdrive for 5 seconds (+50% speed, contact vaporizes enemies).',
    stackText: '+4% trigger chance and +1.5s duration',
    onKill: (player, _enemy, engine) => {
      const stacks = player.getItemCount('starman_core');
      const chance = 0.08 + stacks * 0.04;
      if (Math.random() < chance) {
        player.triggerInvincibility(5 + stacks * 1.5);
        engine.addDamageNumber(player.x, player.y - 40, '★ STAR OVERDRIVE! ★', '#ffff00', 1.5);
      }
    }
  },
  {
    id: 'hopoo_feather',
    name: 'Tanooki Dash-Feather',
    rarity: 'uncommon',
    icon: '🪶',
    desc: 'Reduces Dash cooldown by 25% and grants +15% move speed.',
    stackText: '+20% dash cooldown recovery per stack',
    onApply: (player) => {
      player.def.dashCooldown *= 0.75;
      player.def.speed *= 1.15;
    }
  },
  {
    id: 'soldiers_syringe',
    name: 'Cyber-Syringe',
    rarity: 'common',
    icon: '💉',
    desc: '+15% Attack Speed and +10% Movement Speed.',
    stackText: '+15% attack speed per stack',
    onApply: (player) => {
      player.stats.attackSpeed *= 1.15;
      player.def.speed *= 1.08;
    }
  },
  {
    id: 'ukulele_tesla',
    name: 'Tesla Ukulele',
    rarity: 'uncommon',
    icon: '⚡',
    desc: '25% chance on hit to fire Chain Lightning to up to 4 nearby enemies for 80% damage.',
    stackText: '+2 targets and +20% damage per stack',
    onHit: (player, enemy, _dmg, engine) => {
      if (Math.random() < 0.25) {
        const stacks = player.getItemCount('ukulele_tesla');
        const maxTargets = 3 + stacks;
        const baseDmg = player.damage || player.def?.baseDamage || 16;
        const chainDamage = baseDmg * (0.6 + stacks * 0.2);
        engine.triggerChainLightning(enemy, maxTargets, chainDamage);
      }
    }
  },
  {
    id: 'tough_times_shell',
    name: 'Koopa Carapace Armor',
    rarity: 'common',
    icon: '🛡️',
    desc: '15% chance to completely block incoming damage with an armored deflect sound.',
    stackText: 'Hyperbolic block chance increase (+15% initial)',
  },
  {
    id: 'tri_tip_dagger',
    name: 'Tri-Tip Spore Spike',
    rarity: 'common',
    icon: '🗡️',
    desc: '15% chance on hit to inflict Spore Bleed, dealing 240% base damage over 3 seconds.',
    stackText: '+15% bleed chance per stack (up to 100%)',
    onHit: (player, enemy, _dmg, engine) => {
      const stacks = player.getItemCount('tri_tip_dagger');
      const chance = Math.min(1.0, stacks * 0.15);
      if (Math.random() < chance) {
        const baseDmg = player.damage || player.def?.baseDamage || 16;
        enemy.applyBleed(baseDmg * 2.4, 3.0);
        engine.spawnSparks(enemy.x, enemy.y, '#ff0055', 4);
      }
    }
  },
  {
    id: 'lens_makers_glasses',
    name: "Lens-Maker's HUD",
    rarity: 'common',
    icon: '👓',
    desc: '+10% Critical Strike Chance (+100% damage on crits).',
    stackText: '+10% crit chance per stack',
    onApply: (player) => {
      player.stats.critRate += 0.10;
    }
  },
  {
    id: 'behemoth_core',
    name: 'Brilliant Behemoth Core',
    rarity: 'rare',
    icon: '💣',
    desc: 'All attacks explode on contact for an extra 60% area-of-effect damage.',
    stackText: '+40% AoE radius and +30% damage per stack',
    onHit: (player, enemy, _dmg, engine) => {
      const stacks = player.getItemCount('behemoth_core');
      const radius = (70 + stacks * 25) * (player.affixes?.blastRadiusMult || 1);
      const baseDmg = player.damage || player.def?.baseDamage || 16;
      const blastDamage = baseDmg * (0.6 + stacks * 0.3);
      // procs = false strictly prevents infinite explosion recursion chains!
      engine.createExplosion(enemy.x, enemy.y, radius, blastDamage, '#ff00aa', false, 'player');
    }
  }
];

export function getRandomRelic(rarityFilter?: RelicRarity): RelicItem {
  let pool = ALL_RELIC_ITEMS;
  if (rarityFilter) {
    pool = ALL_RELIC_ITEMS.filter(item => item.rarity === rarityFilter);
  }
  const item = pool[Math.floor(Math.random() * pool.length)];
  return {
    ...item,
    count: 1
  };
}
