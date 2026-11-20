import type { WallBlock, QuestionBlock, WarpPipe, Teleporter, PlacedObject } from './types';

export interface LevelData {
  width: number;
  height: number;
  walls: WallBlock[];
  blocks: QuestionBlock[];
  pipes: WarpPipe[];
  barrels: PlacedObject[];
  teleporter: Teleporter;
  spawnPoints: { x: number; y: number }[];
  playerSpawn: { x: number; y: number };
}

export const STAGE_NAMES = [
  'SECTOR 207: THE BUNKER',
  'NEON CONDUIT LABYRINTH',
  'SPORE-STORM CROSSROADS',
  'CIRCUIT CITADEL PLAZA',
  'LEVIATHAN THRONE ARENA',
];

export function generateTopDownArena(stage: number): LevelData {
  const width = 2400;
  const height = 1800;
  const walls: WallBlock[] = [];
  const blocks: QuestionBlock[] = [];
  const pipes: WarpPipe[] = [];
  const barrels: PlacedObject[] = [];
  const spawnPoints: { x: number; y: number }[] = [];

  const wallThickness = 60;

  // Outer border walls
  // Top, Bottom, Left, Right with spawn gaps
  // Top
  walls.push({ x: 0, y: 0, w: width * 0.4, h: wallThickness, color: '#16203a' });
  walls.push({ x: width * 0.6, y: 0, w: width * 0.4, h: wallThickness, color: '#16203a' });
  spawnPoints.push({ x: width * 0.5, y: -20 });

  // Bottom
  walls.push({ x: 0, y: height - wallThickness, w: width * 0.4, h: wallThickness, color: '#16203a' });
  walls.push({ x: width * 0.6, y: height - wallThickness, w: width * 0.4, h: wallThickness, color: '#16203a' });
  spawnPoints.push({ x: width * 0.5, y: height + 20 });

  // Left
  walls.push({ x: 0, y: 0, w: wallThickness, h: height * 0.4, color: '#16203a' });
  walls.push({ x: 0, y: height * 0.6, w: wallThickness, h: height * 0.4, color: '#16203a' });
  spawnPoints.push({ x: -20, y: height * 0.5 });

  // Right
  walls.push({ x: width - wallThickness, y: 0, w: wallThickness, h: height * 0.4, color: '#16203a' });
  walls.push({ x: width - wallThickness, y: height * 0.6, w: wallThickness, h: height * 0.4, color: '#16203a' });
  spawnPoints.push({ x: width + 20, y: height * 0.5 });

  // 4 Corner spawn gates
  spawnPoints.push({ x: 120, y: 120 });
  spawnPoints.push({ x: width - 120, y: 120 });
  spawnPoints.push({ x: 120, y: height - 120 });
  spawnPoints.push({ x: width - 120, y: height - 120 });

  // Layout architecture based on stage
  const layout = stage % 3;
  if (layout === 1) {
    // "Bunkers / Columns" - classic Boxhead map with 4 large block columns and side rooms
    const cols = [
      { x: 500, y: 400 },
      { x: width - 700, y: 400 },
      { x: 500, y: height - 600 },
      { x: width - 700, y: height - 600 },
    ];
    cols.forEach(c => {
      walls.push({ x: c.x, y: c.y, w: 200, h: 200, color: '#1a2642' });
    });

    // Central cross barricade walls with openings
    walls.push({ x: width * 0.5 - 250, y: height * 0.5 - 20, w: 180, h: 40, color: '#25355a' });
    walls.push({ x: width * 0.5 + 70, y: height * 0.5 - 20, w: 180, h: 40, color: '#25355a' });
  } else if (layout === 2) {
    // "Bridge / Corridors"
    walls.push({ x: 400, y: 300, w: 60, h: 600, color: '#1a2642' });
    walls.push({ x: width - 460, y: 300, w: 60, h: 600, color: '#1a2642' });
    walls.push({ x: 400, y: height - 900, w: 60, h: 600, color: '#1a2642' });
    walls.push({ x: width - 460, y: height - 900, w: 60, h: 600, color: '#1a2642' });

    walls.push({ x: 700, y: 550, w: 400, h: 60, color: '#25355a' });
    walls.push({ x: width - 1100, y: height - 610, w: 400, h: 60, color: '#25355a' });
  } else {
    // "Arena Pillars" - 8 defensive pillars
    const px = [600, 1200, 1800];
    const py = [450, 1350];
    px.forEach(x => {
      py.forEach(y => {
        walls.push({ x: x - 60, y: y - 60, w: 120, h: 120, color: '#1a2642' });
      });
    });
  }

  // 4 Mario Warp Pipes in corners (step on to teleport diagonally!)
  pipes.push({ id: 0, x: 220, y: 220, radius: 42, targetPipeId: 2, cooldown: 0 });
  pipes.push({ id: 1, x: width - 220, y: 220, radius: 42, targetPipeId: 3, cooldown: 0 });
  pipes.push({ id: 2, x: width - 220, y: height - 220, radius: 42, targetPipeId: 0, cooldown: 0 });
  pipes.push({ id: 3, x: 220, y: height - 220, radius: 42, targetPipeId: 1, cooldown: 0 });

  // Question Blocks [?] (Shoot to break open for ammo/hearts/relics!)
  let blockId = 0;
  const blockPositions = [
    { x: 380, y: height * 0.5 },
    { x: width - 420, y: height * 0.5 },
    { x: width * 0.5 - 150, y: 350 },
    { x: width * 0.5 + 110, y: 350 },
    { x: width * 0.5 - 150, y: height - 390 },
    { x: width * 0.5 + 110, y: height - 390 },
    { x: 750, y: 800 },
    { x: width - 790, y: 800 },
  ];
  blockPositions.forEach(pos => {
    const r = Math.random();
    blocks.push({
      id: blockId++,
      x: pos.x,
      y: pos.y,
      w: 44,
      h: 44,
      hp: 35,
      maxHp: 35,
      hit: false,
      itemType: r < 0.45 ? 'ammo' : r < 0.75 ? 'heal' : r < 0.9 ? 'star' : 'relic',
      bumpOffset: 0,
      glowPhase: Math.random() * Math.PI * 2,
    });
  });

  // Pre-seed iconic Boxhead red explosive barrels around the map!
  const barrelPositions = [
    { x: 500, y: 250 },
    { x: 550, y: 250 },
    { x: width - 550, y: 250 },
    { x: width - 500, y: 250 },
    { x: 500, y: height - 250 },
    { x: 550, y: height - 250 },
    { x: width - 550, y: height - 250 },
    { x: width - 500, y: height - 250 },
    { x: width * 0.5 - 40, y: height * 0.35 },
    { x: width * 0.5 - 40, y: height * 0.65 },
  ];
  let barrelId = 0;
  barrelPositions.forEach(b => {
    barrels.push({
      id: barrelId++,
      type: 'barrel',
      x: b.x,
      y: b.y,
      w: 36,
      h: 36,
      hp: 40,
      maxHp: 40,
      color: '#ff2a2a',
    });
  });

  // Central RoR2 Teleporter Monolith
  const teleporter: Teleporter = {
    x: width * 0.5,
    y: height * 0.5,
    radius: 360,
    chargeProgress: 0,
    state: 'idle',
    bossSpawned: false,
    bossDefeated: false,
    pulsePhase: 0,
  };

  return {
    width,
    height,
    walls,
    blocks,
    pipes,
    barrels,
    teleporter,
    spawnPoints,
    playerSpawn: { x: width * 0.5, y: height * 0.5 + 160 },
  };
}
