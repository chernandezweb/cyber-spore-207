// CYBER-SPORE 207 // Main Entry Point & Dead Cells Upgrade Modal Wiring
import { GameEngine } from './engine';
import { ALL_RELIC_ITEMS } from './items';
import { resetHUDCache } from './hud';
import type { SurvivorId, UpgradeCard } from './types';

let selectedSurvivor: SurvivorId = 'vanguard';
let engine: GameEngine | null = null;

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  engine = new GameEngine(canvas);

  detectPlatform();
  populateCodex();
  setupMenuBindings();

  // Wire Dead Cells-style 3-Card Upgrade Selection Modal
  engine.onUpgradeDraftOpen = (cards, title, subtitle) => {
    renderUpgradeDraftModal(cards, title, subtitle);
  };
  engine.onUpgradeDraftClose = () => {
    document.getElementById('upgrade-draft-modal')?.classList.add('hidden');
  };

  engine.onGameOver = (stats) => {
    showGameOverScreen(stats);
  };
});

function renderUpgradeDraftModal(cards: UpgradeCard[], title: string, subtitle: string) {
  const modal = document.getElementById('upgrade-draft-modal');
  const titleEl = document.getElementById('draft-title');
  const subEl = document.getElementById('draft-subtitle');
  const row = document.getElementById('draft-cards-row');
  if (!modal || !row) return;

  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.textContent = subtitle;

  row.innerHTML = cards
    .map((card, idx) => {
      const statsHtml = card.stats
        .map((st) => `<div class="draft-stat-pill">${st}</div>`)
        .join('');
      const affixesHtml = card.affixes
        .map((af) => `<div class="draft-affix-line">${af}</div>`)
        .join('');

      return `
        <button class="draft-card rarity-${card.rarity} cat-${card.category.toLowerCase()}" data-card-index="${idx}" type="button">
          <div class="draft-card-top">
            <span class="draft-key-badge">[${idx + 1}]</span>
            <span class="draft-rarity-tag">${card.rarity.toUpperCase()} // ${card.category}</span>
          </div>
          <div class="draft-card-icon-wrap">
            <span class="draft-card-icon">${card.icon}</span>
          </div>
          <h3 class="draft-card-title">${card.title}</h3>
          <div class="draft-stats-list">${statsHtml}</div>
          <div class="draft-affixes-box">${affixesHtml}</div>
          <p class="draft-flavor">${card.flavor}</p>
          <div class="draft-select-cta">SELECT [${idx + 1}]</div>
        </button>
      `;
    })
    .join('');

  row.querySelectorAll<HTMLButtonElement>('.draft-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-card-index') || '0');
      engine?.selectUpgradeCard(idx);
    });
  });

  modal.classList.remove('hidden');
}

function detectPlatform() {
  const badge = document.getElementById('runtime-badge');
  if (!badge) return;

  const isTauri = !!(window as any).__TAURI__ || !!(window as any).__TAURI_INTERNALS__;
  if (isTauri) {
    badge.textContent = 'STEAM / TAURI PIXEL RUNTIME v0.207';
    badge.className = 'p-badge lime';
  } else {
    badge.textContent = '2.5D PIXEL-ART WEB BUILD v0.207';
    badge.className = 'p-badge cyan';
  }
}

function setupMenuBindings() {
  for (let i = 0; i <= 6; i++) {
    const slot = document.getElementById(`weapon-slot-${i}`);
    slot?.addEventListener('click', () => {
      engine?.player?.selectWeapon(i);
    });
  }

  const specialSlot = document.getElementById('special-slot');
  specialSlot?.addEventListener('click', () => {
    if (engine && !engine.pausedForUpgrade) {
      engine.input.special = true;
    }
  });

  const survCards = document.querySelectorAll('.surv-card');
  survCards.forEach((card) => {
    card.addEventListener('click', () => {
      survCards.forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedSurvivor = (card.getAttribute('data-survivor') as SurvivorId) || 'vanguard';
    });
  });

  document.getElementById('btn-start-run')?.addEventListener('click', () => startGame(false));
  document.getElementById('btn-start-ai-demo')?.addEventListener('click', () => startGame(true));
  document.getElementById('btn-toggle-ai')?.addEventListener('click', () => engine?.toggleAI());
  document.getElementById('btn-toggle-audio')?.addEventListener('click', () => engine?.toggleAudio());
  document.getElementById('btn-return-menu')?.addEventListener('click', () => returnToMenu());

  const codexModal = document.getElementById('codex-modal');
  document.getElementById('btn-open-codex')?.addEventListener('click', () => codexModal?.classList.remove('hidden'));
  document.getElementById('btn-close-codex')?.addEventListener('click', () => codexModal?.classList.add('hidden'));

  document.getElementById('btn-retry-run')?.addEventListener('click', () => {
    document.getElementById('gameover-modal')?.classList.add('hidden');
    startGame(engine ? engine.ai.enabled : false);
  });

  document.getElementById('btn-go-menu')?.addEventListener('click', () => {
    document.getElementById('gameover-modal')?.classList.add('hidden');
    returnToMenu();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!document.getElementById('codex-modal')?.classList.contains('hidden')) {
        document.getElementById('codex-modal')?.classList.add('hidden');
      } else if (engine && engine.running && !engine.pausedForUpgrade) {
        returnToMenu();
      }
    }
  });
}

function startGame(withAi: boolean) {
  if (!engine) return;

  document.getElementById('main-menu-overlay')?.classList.add('hidden');
  document.getElementById('gameover-modal')?.classList.add('hidden');
  document.getElementById('codex-modal')?.classList.add('hidden');
  document.getElementById('upgrade-draft-modal')?.classList.add('hidden');

  document.getElementById('hud-top-left')?.classList.remove('hidden');
  document.getElementById('hud-top-right')?.classList.remove('hidden');
  document.getElementById('hud-bottom')?.classList.remove('hidden');

  resetHUDCache();
  engine.startRun(selectedSurvivor, withAi);
}

function returnToMenu() {
  if (!engine) return;

  engine.running = false;
  engine.pausedForUpgrade = false;

  document.getElementById('main-menu-overlay')?.classList.remove('hidden');
  document.getElementById('gameover-modal')?.classList.add('hidden');
  document.getElementById('upgrade-draft-modal')?.classList.add('hidden');

  document.getElementById('hud-top-left')?.classList.add('hidden');
  document.getElementById('hud-top-right')?.classList.add('hidden');
  document.getElementById('hud-bottom')?.classList.add('hidden');
  document.getElementById('hud-boss-bar')?.classList.add('hidden');
  document.getElementById('hud-item-ribbon')?.classList.add('hidden');
  document.getElementById('hud-tp-bar-wrap')?.classList.add('hidden');
}

function showGameOverScreen(stats: Record<string, string>) {
  const isVictory = stats.victory === '1';
  const goTitle = document.getElementById('go-title');
  const goSub = document.getElementById('go-subtitle');
  const statsGrid = document.getElementById('go-stats-grid');
  const modal = document.getElementById('gameover-modal');

  if (goTitle) {
    goTitle.textContent = isVictory ? '★ APEX BIO-LEVIATHAN SLAIN ★' : 'SIGNAL LOST IN SECTOR 207';
    goTitle.style.color = isVictory ? '#22e58a' : '#ff3366';
  }
  if (goSub) {
    goSub.textContent = isVictory
      ? 'You mastered the alien biome and conquered Sector 207.'
      : 'Your armored suit was overwhelmed by the spore swarm.';
  }

  if (statsGrid) {
    statsGrid.innerHTML = Object.entries(stats)
      .filter(([k]) => k !== 'victory')
      .map(([k, v]) => `<div><span style="color:var(--text-secondary)">${k}:</span> <strong style="color:var(--color-cyan-bright)">${v}</strong></div>`)
      .join('');
  }

  modal?.classList.remove('hidden');
}

function populateCodex() {
  const container = document.getElementById('codex-items-grid');
  if (!container) return;

  container.innerHTML = ALL_RELIC_ITEMS.map((item) => `
    <div class="codex-item-card">
      <div class="codex-item-icon">${item.icon}</div>
      <div class="codex-item-info">
        <h4>${item.name} <span class="p-badge ${item.rarity}" style="font-size:8px">${item.rarity.toUpperCase()}</span></h4>
        <p>${item.desc}</p>
        <span class="codex-item-stack">STACK: ${item.stackText}</span>
      </div>
    </div>
  `).join('');
}
