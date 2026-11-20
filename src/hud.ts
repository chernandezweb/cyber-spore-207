// CYBER-SPORE 207 // Pixel-Art HUD Controller
import type { RelicItem } from './types';

const DIFF_LABELS = [
  'EASY',
  'MEDIUM',
  'HARD',
  'VERY HARD',
  'INSANE',
  'HAHAHA 207',
];
const DIFF_COLORS = ['#22e58a', '#a6ff33', '#ffd23f', '#ff8528', '#ff3355', '#ff4de1'];

let lastItemSig = '';
let toastTimer: number | undefined;

function set(id: string, text: string) {
  const el = document.getElementById(id);
  if (el && el.textContent !== text) el.textContent = text;
}

function width(id: string, pct: number) {
  const el = document.getElementById(id) as HTMLElement | null;
  if (el) el.style.width = `${Math.max(0, Math.min(100, pct)).toFixed(1)}%`;
}

export function updateHUD(e: any) {
  const p = e.player;
  if (!p) return;

  // Currencies & Boxhead Combo
  set('hud-coins', String(e.kills));
  set('hud-lunar', String(e.lunarStored));
  set('hud-stomp-combo', `x${p.comboMultiplier.toFixed(0)} (${p.comboCount})`);

  // RoR2 Escalating Timer & FPS
  const mm = Math.floor(e.time / 60), ss = Math.floor(e.time % 60);
  set('hud-timer', `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`);
  set('hud-fps', `${e.fps || 60} FPS`);
  const c = e.coeff;
  set('hud-coeff', `${c.toFixed(2)}x`);

  const tier = Math.min(5, Math.floor((c - 1) / 0.55));
  const marker = document.getElementById('hud-diff-marker') as HTMLElement | null;
  if (marker) marker.style.left = `${Math.min(99, ((c - 1) / 3.3) * 100)}%`;
  const lbl = document.getElementById('hud-diff-label') as HTMLElement | null;
  if (lbl) {
    set('hud-diff-label', DIFF_LABELS[tier]);
    lbl.style.color = DIFF_COLORS[tier];
  }

  // Health & XP
  width('hud-hp-fill', (p.hp / p.maxHp) * 100);
  set('hud-hp-text', `${Math.ceil(p.hp)} / ${p.maxHp} HP`);
  const hpFill = document.getElementById('hud-hp-fill') as HTMLElement | null;
  if (hpFill) {
    hpFill.style.background = p.hp / p.maxHp < 0.3 ? '#ef3b3b' : '#22d972';
  }

  width('hud-xp-fill', (p.xp / p.xpToNext) * 100);
  set('hud-level', String(p.level));
  set('hud-stats-summary', `DMG x${p.stats.damageMult.toFixed(2)} · CRIT ${Math.round(p.stats.critRate * 100)}% · SPD ${Math.round(p.moveSpeed)}`);

  // Boxhead Weapon Hotbar (1-7) — dims locked weapons with 🔒
  for (let i = 0; i < p.weaponOrder.length; i++) {
    const wType = p.weaponOrder[i];
    const w = p.weapons[wType];
    const slot = document.getElementById(`weapon-slot-${i}`);
    if (slot) {
      slot.classList.toggle('active', w.unlocked && i === p.activeWeaponIndex);
      slot.classList.toggle('locked', !w.unlocked);
      const ammoEl = document.getElementById(`weapon-ammo-${i}`);
      if (ammoEl) {
        if (!w.unlocked) {
          ammoEl.textContent = '🔒';
          ammoEl.style.color = '#64748b';
        } else {
          ammoEl.textContent = w.maxAmmo === -1 ? '∞' : String(w.ammo);
          ammoEl.style.color = w.maxAmmo !== -1 && w.ammo <= 3 ? '#ff4455' : '#ffe066';
        }
      }
    }
  }

  // Special skill cooldown
  const specialCd = document.getElementById('skill-cd-3');
  if (specialCd) {
    if (p.cdSpecial > 0.1) {
      specialCd.classList.remove('hidden');
      specialCd.textContent = p.cdSpecial.toFixed(1);
    } else {
      specialCd.classList.add('hidden');
    }
  }

  // Teleporter Progress
  const tp = e.teleporter;
  if (tp && tp.state !== 'idle') {
    width('hud-tp-bar-fill', tp.chargeProgress);
    set('hud-tp-label', tp.state === 'portal_open' ? 'PORTAL OPEN' : `CHARGING CONDUIT: ${Math.floor(tp.chargeProgress)}%`);
  }

  // Boss HP (supports single, Twin, and Triple Titan encounters!)
  const livingBosses = (e.bosses || []).filter((b: any) => !b.isDead);
  if (livingBosses.length > 0) {
    let curHp = 0;
    let maxHp = 0;
    for (const b of livingBosses) {
      curHp += Math.max(0, b.hp);
      maxHp += b.maxHp;
    }
    const pct = maxHp > 0 ? (curHp / maxHp) * 100 : 0;
    width('boss-hp-fill', pct);
    width('boss-hp-lag', pct);
    set('boss-name', livingBosses.length > 1 ? `${livingBosses.length}x BOWSER-LEVIATHAN 207` : 'BOWSER-LEVIATHAN 207');
    set('boss-hp-numbers', `${Math.ceil(curHp)} / ${maxHp}`);
  }

  // Relic + Active Dead Cells Affix Ribbon
  const aff = p.affixes;
  const affixChips: { icon: string; title: string; count: string; cls: string }[] = [];
  if (aff.bonusVsBleeding > 0) affixChips.push({ icon: '🩸', title: `+${Math.round(aff.bonusVsBleeding * 100)}% DMG vs Bleeding`, count: `+${Math.round(aff.bonusVsBleeding * 100)}%`, cls: 'rare' });
  if (aff.bonusVsBurning > 0) affixChips.push({ icon: '🔥', title: `+${Math.round(aff.bonusVsBurning * 100)}% DMG vs Burning`, count: `+${Math.round(aff.bonusVsBurning * 100)}%`, cls: 'rare' });
  if (aff.burnOnDeath > 0) affixChips.push({ icon: '💥', title: 'Victims ignite nearby foes on death', count: `x${aff.burnOnDeath}`, cls: 'rare' });
  if (aff.critLightning > 0) affixChips.push({ icon: '⚡', title: 'Crits unleash chain lightning', count: `x${aff.critLightning}`, cls: 'lunar' });
  if (aff.pierceBonus > 0) affixChips.push({ icon: '🏹', title: `+${aff.pierceBonus} Projectile Pierce`, count: `+${aff.pierceBonus}`, cls: 'lunar' });
  if (aff.vampOnKill > 0) affixChips.push({ icon: '💚', title: `+${aff.vampOnKill} HP on kill`, count: `+${aff.vampOnKill}`, cls: 'uncommon' });
  if (aff.executeThreshold > 0) affixChips.push({ icon: '⚔️', title: `Execute below ${Math.round(aff.executeThreshold * 100)}% HP`, count: `${Math.round(aff.executeThreshold * 100)}%`, cls: 'rare' });

  const sig =
    p.items.map((i: RelicItem) => `${i.id}:${i.count}`).join('|') +
    '||' +
    affixChips.map(a => `${a.icon}:${a.count}`).join('|');

  if (sig !== lastItemSig) {
    lastItemSig = sig;
    const list = document.getElementById('hud-items-list');
    if (list) {
      const relicHtml = p.items
        .map((i: RelicItem) => `<div class="item-badge ${i.rarity}" title="${i.name}: ${i.desc}">${i.icon}${i.count > 1 ? `<span class="item-count-pip">x${i.count}</span>` : ''}</div>`)
        .join('');
      const affixHtml = affixChips
        .map(a => `<div class="item-badge ${a.cls}" title="${a.title}">${a.icon}<span class="item-count-pip">${a.count}</span></div>`)
        .join('');
      list.innerHTML = relicHtml + affixHtml;
    }
    document.getElementById('hud-item-ribbon')?.classList.toggle('hidden', p.items.length === 0 && affixChips.length === 0);
  }
}

export function resetHUDCache() {
  lastItemSig = '#';
}

export function showToast(item: RelicItem) {
  const t = document.getElementById('pickup-toast');
  if (!t) return;
  set('toast-icon', item.icon);
  set('toast-title', item.name.toUpperCase());
  set('toast-desc', item.desc);
  const col = item.rarity === 'rare' ? '#ff3377' : item.rarity === 'uncommon' ? '#22e58a' : item.rarity === 'lunar' ? '#38e8ff' : '#f1f5f9';
  (t as HTMLElement).style.borderColor = col;
  (document.getElementById('toast-title') as HTMLElement).style.color = col;
  t.classList.add('hidden');
  void (t as HTMLElement).offsetWidth;
  t.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.add('hidden'), 3000);
}
