export type LearningActivity = {
  id: string;
  name: string;
  icon: string;
  cost: number;
  duration: number;
  growth: number;
  salaryBoost?: number;
  description: string;
};

export const LEARNING_ACTIVITIES: LearningActivity[] = [
  {
    id: 'certificate',
    name: 'Professional Certificate',
    icon: '📜',
    cost: 6000,
    duration: 2,
    growth: 10,
    salaryBoost: 2500,
    description: 'A focused credential that can open a promotion conversation later in the year.',
  },
  {
    id: 'workshop',
    name: 'Weekend Workshop',
    icon: '🛠️',
    cost: 3000,
    duration: 1,
    growth: 5,
    description: 'A compact practical workshop that improves your confidence and portfolio.',
  },
  {
    id: 'conference',
    name: 'Industry Conference',
    icon: '🎤',
    cost: 5000,
    duration: 2,
    growth: 7,
    salaryBoost: 1000,
    description: 'Meet people, learn current ideas, and build a stronger professional network.',
  },
];

export type MarketItem = {
  id: string;
  name: string;
  icon: string;
  cost: number;
  lifestyle: number;
  note: string;
  collectible?: boolean;
};

export const MARKET_ITEMS: MarketItem[] = [
  { id: 'dining', name: 'Dinner with friends', icon: '🍲', cost: 850, lifestyle: 3, note: 'A warm evening for connection.' },
  { id: 'hobby', name: 'Hobby supplies', icon: '🎨', cost: 1200, lifestyle: 4, note: 'A small creative reset.', collectible: true },
  { id: 'outing', name: 'Weekend outing', icon: '🎡', cost: 1800, lifestyle: 5, note: 'A memory outside the routine.' },
  { id: 'coat', name: 'A useful new outfit', icon: '🧥', cost: 2500, lifestyle: 3, note: 'A confidence boost for work and life.', collectible: true },
  { id: 'luxury', name: 'Little luxury', icon: '✨', cost: 3200, lifestyle: 6, note: 'Enjoyed intentionally, not automatically.' },
];

export type TravelDestination = {
  id: string;
  name: string;
  icon: string;
  cost: number;
  description: string;
};

export const TRAVEL_DESTINATIONS: TravelDestination[] = [
  { id: 'jaipur', name: 'Jaipur weekend', icon: '🕌', cost: 24000, description: 'Colour, craft, and two quiet days away.' },
  { id: 'goa', name: 'Goa coast', icon: '🌊', cost: 30000, description: 'A booked, earned coastal reset.' },
  { id: 'sikkim', name: 'Sikkim escape', icon: '🏔️', cost: 36000, description: 'A longer trip for fresh perspective.' },
];

// Kept as a public re-export so existing UI imports stay compatible while the
// map itself uses the same registry for labels and interaction IDs.
export { LOCATION_LABELS } from './locations';
