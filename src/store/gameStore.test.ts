import { describe, expect, it } from 'vitest';
import type { Allocation, Profile, StrategyId } from '../game/types';
import { gameSnapshot, SAVE_VERSION, useGameStore } from './gameStore';
import { totalAllocation } from '../game/engine/financeEngine';

const profile: Profile = {
  name: 'Test Player',
  age: 24,
  occupation: 'Analyst',
  appearance: 0,
  living: 'Living independently',
  scenario: 'steady',
};

function plan(income: number, style: 'balanced' | 'security' | 'lifestyle' | 'growth'): Allocation {
  const needs = Math.round(income * 0.45 / 500) * 500;
  const weights = {
    balanced: { savings: 0.15, investments: 0.1, emergency: 0.1, lifestyle: 0.12 },
    security: { savings: 0.2, investments: 0.05, emergency: 0.2, lifestyle: 0.05 },
    lifestyle: { savings: 0.1, investments: 0.05, emergency: 0.05, lifestyle: 0.25 },
    growth: { savings: 0.1, investments: 0.2, emergency: 0.08, lifestyle: 0.07 },
  }[style];
  const savings = Math.round(income * weights.savings / 500) * 500;
  const investments = Math.round(income * weights.investments / 500) * 500;
  const emergency = Math.round(income * weights.emergency / 500) * 500;
  const lifestyle = Math.round(income * weights.lifestyle / 500) * 500;
  return { needs, savings, investments, emergency, lifestyle, skills: income - needs - savings - investments - emergency - lifestyle };
}

function playYear(style: 'balanced' | 'security' | 'lifestyle' | 'growth', strategy: StrategyId) {
  useGameStore.getState().start({ ...profile, name: `${style} player` }, ['emergency', 'travel', 'certificate']);
  for (let month = 1; month <= 12; month += 1) {
    useGameStore.getState().processSalary();
    const allocation = plan(useGameStore.getState().state.monthlyIncome, style);
    (Object.keys(allocation) as (keyof Allocation)[]).forEach((key) => useGameStore.getState().setAllocation(key, allocation[key]));
    useGameStore.getState().confirmAllocation();
    useGameStore.getState().chooseEvent(0);
    if (month >= 7) useGameStore.getState().recordStrategy(strategy, strategy);
    useGameStore.getState().finishMonth();
  }
  return useGameStore.getState();
}

describe('persistent 12-month game lifecycle', () => {
  it('processes salary exactly once even when the action is repeated', () => {
    useGameStore.getState().start(profile, ['emergency', 'travel']);
    useGameStore.getState().processSalary();
    useGameStore.getState().processSalary();
    expect(useGameStore.getState().salaryHistory).toHaveLength(1);
    expect(useGameStore.getState().salaryProcessedForMonth).toBe(true);
  });

  it('keeps Suggested Balance valid after all rounding', () => {
    useGameStore.getState().start(profile, ['emergency', 'travel', 'certificate']);
    useGameStore.getState().processSalary();
    useGameStore.getState().autoBalance();
    const game = useGameStore.getState();
    expect(totalAllocation(game.allocation)).toBe(game.state.monthlyIncome);
    expect(game.allocation.skills).toBeGreaterThanOrEqual(0);
  });

  it.each([
    ['balanced', 'BALANCED'],
    ['security', 'SECURITY'],
    ['lifestyle', 'LIFESTYLE'],
    ['growth', 'GROWTH'],
  ] as const)('reaches final results for a %s run', (style, strategy) => {
    const game = playYear(style, strategy);
    expect(game.phase).toBe('final');
    expect(game.monthlyHistory).toHaveLength(12);
    expect(game.strategicHistory).toHaveLength(6);
    expect(game.completedRuns.at(-1)?.classification).toBeTruthy();
    expect(game.completedRuns.at(-1)?.finalState.cash).toBeGreaterThanOrEqual(0);
    expect(game.completedRuns.at(-1)?.finalState.debt).toBeGreaterThanOrEqual(0);
  });

  it('hydrates a complete versioned backend snapshot without losing strategy or event state', () => {
    useGameStore.getState().start(profile, ['emergency', 'travel', 'certificate']);
    useGameStore.getState().processSalary();
    useGameStore.getState().autoBalance();
    useGameStore.getState().confirmAllocation();
    useGameStore.getState().chooseEvent(0);
    const before = gameSnapshot(useGameStore.getState());
    before.currentLocation = 'bank';
    before.strategicHistory = [{ id: 'persisted-round', month: 7, agentId: 'sam', human: 'BALANCED', agent: 'SECURITY', allocation: { security: 0.4, savings: 0.3, growth: 0.15, lifestyle: 0.15 }, humanPayoff: 51, agentPayoff: 54, nash: true, pareto: true }];
    before.agents = before.agents.map((agent) => agent.id === 'sam' ? { ...agent, unlocked: true, interactions: 3, satisfaction: 67 } : agent);

    useGameStore.getState().start({ ...profile, name: 'Different local player' }, ['laptop', 'purchase']);
    useGameStore.getState().hydrateBackendSave(JSON.parse(JSON.stringify(before)));
    const restored = useGameStore.getState();

    expect(restored.saveVersion).toBe(SAVE_VERSION);
    expect(restored.phase).toBe('title');
    expect(restored.resumePhase).toBe(before.resumePhase);
    expect(restored.currentLocation).toBe('bank');
    expect(restored.state).toEqual(before.state);
    expect(restored.goals).toEqual(before.goals);
    expect(restored.achievements).toEqual(before.achievements);
    expect(restored.strategicHistory).toEqual(before.strategicHistory);
    expect(restored.agents.find((agent) => agent.id === 'sam')?.interactions).toBe(3);
    expect(restored.journal.some((entry) => entry.kind === 'event' && entry.eventId)).toBe(true);
  });
});
