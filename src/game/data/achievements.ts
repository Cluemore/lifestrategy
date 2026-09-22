import type {AchievementUnlock} from '../types';

export const ACHIEVEMENTS = [
  { id: 'first-saved', name: 'First ₹10K Saved', icon: '🐷', description: 'Keep at least ₹10,000 in savings.' },
  { id: 'emergency-ready', name: 'Emergency Ready', icon: '🛡️', description: 'Build three months of essential-expense cover.' },
  { id: 'debt-free', name: 'Debt Free', icon: '🌤️', description: 'Clear debt after taking on a liability.' },
  { id: 'first-investment', name: 'First Investment', icon: '🌱', description: 'Make your first investment contribution.' },
  { id: 'skill-builder', name: 'Skill Builder', icon: '📚', description: 'Complete a learning activity.' },
  { id: 'goal-getter', name: 'Goal Getter', icon: '🎯', description: 'Complete a personal goal.' },
  { id: 'strategic-thinker', name: 'Strategic Thinker', icon: '⚖️', description: 'Record a genuine strategy interaction.' },
  { id: 'balanced-planner', name: 'Balanced Planner', icon: '🧭', description: 'Finish a month with a balanced allocation.' },
  { id: 'resilient', name: 'Resilient', icon: '🌿', description: 'Handle a difficult event without borrowing.' },
  { id: 'frequent-traveller', name: 'Frequent Traveller', icon: '🧳', description: 'Complete a travel experience.' },
] as const;

export const isUnlocked = (unlocks: AchievementUnlock[], id: string) => unlocks.some((unlock) => unlock.id === id);
