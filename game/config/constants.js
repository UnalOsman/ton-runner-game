export const GLOBAL_SCALE = 0.01;

export const CITY_ROW_DISTANCE = 20;
export const CITY_SPAWN_Z = -20;

export const STRUCTURE_OFFSET_X = 10;
export const STRUCTURE_SCALE = 0.01;

export const PLAYER_Z = 2;

export const LANES = [-1.5, 0, 1.5];

export const BUILDING_PARAMS = {
  'blupHouse1': { yOffset: 1.5, scale: 0.01 },
  'blupHouse2': { yOffset: 3.2, scale: 0.01 },
  'blupHouse3': { yOffset: 1.5, scale: 0.01 },
  'blupHouse4': { yOffset: 2, scale: 0.01, rotationFix: Math.PI },
  'blupHouse5': { yOffset: 2.5, scale: 0.01 },
  'blupHouse6': { yOffset: 2.5, scale: 0.01, rotationFix: -Math.PI / 2 },
  'blupotopark': { yOffset: 2.8, scale: 0.01, xOffset: 7 }
};

export const COLLECTIBLE_PATTERN = {
  MIN: 3,
  MAX: 6,
  SPACING: 1.2
};

export const OBSTACLE_TYPES = {
  JUMP: 'jump',
  SLIDE: 'slide',
  BLOCK: 'block'
};


