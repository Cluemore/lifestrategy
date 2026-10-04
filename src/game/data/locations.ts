import type { LocationId } from '../types';

/** A single authoritative source for visible buildings, labels and interaction IDs. */
export type WorldLocation = {
  id: LocationId;
  label: string;
  interaction: Uppercase<LocationId>;
  icon: string;
  color: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

// The outer positions deliberately avoid the persistent HUD-safe zones on a 1200 × 590 town:
// upper-left chapter card, left progress strip, lower-right goals card and bottom dock.
export const WORLD_LOCATIONS: readonly WorldLocation[] = [
  { id: 'home', label: 'Home', interaction: 'HOME', icon: '🏡', color: 0xffc8a8, x: 450, y: 118, w: 138, h: 92 },
  { id: 'workplace', label: 'Workplace', interaction: 'WORKPLACE', icon: '💼', color: 0xffdc75, x: 625, y: 118, w: 150, h: 92 },
  { id: 'bank', label: 'Bank', interaction: 'BANK', icon: '🏦', color: 0xa9dfc3, x: 800, y: 178, w: 132, h: 94 },
  { id: 'investments', label: 'Investment Corner', interaction: 'INVESTMENTS', icon: '🌱', color: 0xbce4a6, x: 985, y: 120, w: 154, h: 92 },
  { id: 'learning', label: 'Learning Studio', interaction: 'LEARNING', icon: '📚', color: 0xc7b5ef, x: 1050, y: 220, w: 150, h: 94 },
  { id: 'market', label: 'Shopping Street', interaction: 'MARKET', icon: '🛍️', color: 0xffb89f, x: 155, y: 395, w: 145, h: 92 },
  { id: 'cafe', label: 'Café', interaction: 'CAFE', icon: '☕', color: 0xffd68b, x: 365, y: 402, w: 130, h: 92 },
  { id: 'travel', label: 'Travel Station', interaction: 'TRAVEL', icon: '🚉', color: 0x8fd5df, x: 565, y: 402, w: 140, h: 92 },
  { id: 'strategy', label: 'Strategy Lab', interaction: 'STRATEGY', icon: '⚖️', color: 0x9dc4e9, x: 735, y: 402, w: 145, h: 94 },
] as const;

export const LOCATION_EVENT = 'lifestrategy:open-location' as const;

export type LocationInteractionSource = 'pointer' | 'keyboard' | 'map' | 'chapter';
export type LocationInteractionDetail = { locationId: LocationId; source: LocationInteractionSource };

export const LOCATION_LABELS: Record<LocationId, string> = {
  home: 'Home',
  workplace: 'Workplace',
  bank: 'Bank',
  investments: 'Investment Corner',
  learning: 'Learning Studio',
  market: 'Shopping Street',
  cafe: 'Café',
  travel: 'Travel Station',
  strategy: 'Strategy Lab',
};

export const LOCATION_BY_ID: Record<LocationId, WorldLocation> = WORLD_LOCATIONS.reduce((all, location) => {
  all[location.id] = location;
  return all;
}, {} as Record<LocationId, WorldLocation>);

export const isLocationId = (value: unknown): value is LocationId => typeof value === 'string' && value in LOCATION_BY_ID;

type Rectangle = { name?: string; x: number; y: number; w: number; h: number };

/** Persistent overlay bounds in the logical 1200 × 590 Phaser town. */
export const HUD_SAFE_ZONES: readonly Rectangle[] = [
  { name: 'monthly chapter', x: 180, y: 120, w: 360, h: 240 },
  { name: 'year journey', x: 180, y: 285, w: 360, h: 70 },
  { name: 'your goals', x: 1025, y: 430, w: 350, h: 320 },
  { name: 'bottom dock', x: 600, y: 552, w: 330, h: 76 },
];

const overlaps = (one: Rectangle, other: Rectangle) => Math.abs(one.x - other.x) < (one.w + other.w) / 2 && Math.abs(one.y - other.y) < (one.h + other.h) / 2;

/** Pure audit helper used by tests and useful whenever a new building is added. */
export const locationLayoutIssues = (locations: readonly WorldLocation[] = WORLD_LOCATIONS) => {
  const issues: string[] = [];
  const ids = new Set<string>();
  locations.forEach((location) => {
    if (ids.has(location.id)) issues.push(`Duplicate location id: ${location.id}`);
    ids.add(location.id);
    if (location.x - location.w / 2 < 0 || location.x + location.w / 2 > 1200 || location.y - location.h / 2 < 0 || location.y + location.h / 2 > 590) issues.push(`${location.id} is outside the town bounds`);
  });
  locations.forEach((location, index) => locations.slice(index + 1).forEach((other) => {
    if (overlaps(location, other)) issues.push(`${location.id} overlaps ${other.id}`);
  }));
  locations.forEach((location) => HUD_SAFE_ZONES.forEach((zone) => {
    if (overlaps(location, zone)) issues.push(`${location.id} overlaps the ${zone.name} HUD-safe zone`);
  }));
  return issues;
};
