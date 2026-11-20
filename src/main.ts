// CYBER-SPORE 207 // Main Entry Point & Dead Cells Upgrade Modal Wiring
import { GameEngine } from './engine';
import { ALL_RELIC_ITEMS } from './items';
import { resetHUDCache } from './hud';
import { clearRunSave, describeRunSave, loadRunSave, writeRunSave } from './save';
import type { SurvivorId, UpgradeCard } from './types';

let selectedSurvivor: SurvivorId = 'vanguard';
let engine: GameEngine | null = null;

function initApp() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  engine = new GameEngine(canvas);

  populateCodex();
  setupMenuBindings();
  refreshContinueButton();

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
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

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
        .map(
          (st) => `
          <div class="draft-hero-stat">
            <span class="draft-hero-val">${st.value}</span>
            <span class="draft-hero-lbl">${st.label}</span>
          </div>`
        )
        .join('');

      return `
        <button class="draft-card rarity-${card.rarity} cat-${card.category.toLowerCase()}" data-card-index="${idx}" type="button">
          <div class="draft-card-top">
            <span class="draft-key-badge">${idx + 1}</span>
            <span class="draft-rarity-tag">${card.rarity.toUpperCase()}</span>
            ${card.stackBadge ? `<span class="draft-stack-badge">${card.stackBadge}</span>` : ''}
          </div>
          <div class="draft-card-hero-head">
            <span class="draft-card-icon">${card.icon}</span>
            <h3 class="draft-card-title">${card.title}</h3>
          </div>
          <div class="draft-hero-stats-grid">${statsHtml}</div>
          <div class="draft-perk-banner">${card.perk}</div>
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

  // Bulletproof Survivor Selection via event delegation on container
  const survContainer = document.getElementById('survivor-cards-container');
  survContainer?.addEventListener('click', (ev) => {
    const card = (ev.target as HTMLElement | null)?.closest('.surv-card') as HTMLElement | null;
    if (!card) return;
    survContainer.querySelectorAll('.surv-card').forEach((c) => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedSurvivor = (card.getAttribute('data-survivor') as SurvivorId) || 'vanguard';
  });

  document.getElementById('btn-continue-run')?.addEventListener('click', () => continueGame());
  document.getElementById('btn-start-run')?.addEventListener('click', () => startGame(false));
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

function refreshContinueButton() {
  const btnCont = document.getElementById('btn-continue-run');
  const sumEl = document.getElementById('continue-run-summary');
  const btnStart = document.getElementById('btn-start-run');
  const saved = loadRunSave();

  if (saved && btnCont && sumEl) {
    sumEl.textContent = describeRunSave(saved);
    btnCont.classList.remove('hidden');
    if (btnStart) btnStart.textContent = '↻ START NEW RUN';
  } else {
    btnCont?.classList.add('hidden');
    if (btnStart) btnStart.textContent = '▶ DEPLOY NOW';
  }
}

function continueGame() {
  if (!engine) return;
  const saved = loadRunSave();
  if (!saved) {
    refreshContinueButton();
    return;
  }

  document.getElementById('main-menu-overlay')?.classList.add('hidden');
  document.getElementById('gameover-modal')?.classList.add('hidden');
  document.getElementById('codex-modal')?.classList.add('hidden');
  document.getElementById('upgrade-draft-modal')?.classList.add('hidden');

  document.getElementById('hud-top-left')?.classList.remove('hidden');
  document.getElementById('hud-top-right')?.classList.remove('hidden');
  document.getElementById('hud-bottom')?.classList.remove('hidden');

  resetHUDCache();
  engine.continueSavedRun();
}

function startGame(withAi: boolean) {
  if (!engine) return;

  // Starting a brand new run replaces any previous save
  clearRunSave();

  // Always read the currently highlighted survivor card as source of truth
  const activeCard = document.querySelector('#survivor-cards-container .surv-card.selected');
  if (activeCard) {
    selectedSurvivor = (activeCard.getAttribute('data-survivor') as SurvivorId) || selectedSurvivor;
  }

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

  if (engine.running && engine.player && !engine.player.isDead) {
    writeRunSave(engine);
  }

  engine.running = false;
  engine.pausedForUpgrade = false;

  refreshContinueButton();

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
