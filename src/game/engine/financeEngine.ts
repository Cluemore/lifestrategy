import type {Allocation, Effect, FinancialState, Scores, StrategyVector} from '../types';

const financialKeys = ['cash', 'savings', 'emergencyFund', 'investments', 'debt', 'monthlyIncome', 'skillFund'] as const;
const scoreKeys = ['wealth', 'security', 'lifestyle', 'growth', 'goals'] as const;

export const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));

export const defaultAllocation = (income: number): Allocation => {
  const needs = Math.round(income * 0.45 / 500) * 500;
  const savings = Math.round(income * 0.15 / 500) * 500;
  const investments = Math.round(income * 0.10 / 500) * 500;
  const emergency = Math.round(income * 0.10 / 500) * 500;
  const lifestyle = Math.round(income * 0.12 / 500) * 500;
  return { needs, savings, investments, emergency, lifestyle, skills: income - needs - savings - investments - emergency - lifestyle };
};

export const totalAllocation = (allocation: Allocation) => Object.values(allocation).reduce((total, value) => total + value, 0);

export const isValidAllocation = (allocation: Allocation, income: number) =>
  Object.values(allocation).every((value) => Number.isFinite(value) && value >= 0) && totalAllocation(allocation) === income;

/**
 * Salary is processed by the store exactly once. This function processes the
 * already-earned monthly budget: needs are consumed, long-term buckets receive
 * their allocations, lifestyle becomes spendable cash, and skills stay earmarked.
 */
export function processAllocation(state: FinancialState, allocation: Allocation): FinancialState {
  if (!isValidAllocation(allocation, state.monthlyIncome)) return state;
  return {
    ...state,
    cash: state.cash + allocation.lifestyle,
    savings: state.savings + allocation.savings,
    emergencyFund: state.emergencyFund + allocation.emergency,
    investments: state.investments + allocation.investments,
    skillFund: (state.skillFund || 0) + allocation.skills,
    essentialExpenses: Math.max(1, allocation.needs),
  };
}

export type Account = 'cash' | 'savings' | 'emergencyFund';

export function transferFunds(state: FinancialState, from: Account, to: Account, amount: number): FinancialState | null {
  const rounded = Math.round(amount);
  if (from === to || rounded <= 0 || state[from] < rounded) return null;
  return { ...state, [from]: state[from] - rounded, [to]: state[to] + rounded };
}

export function investCash(state: FinancialState, amount: number): FinancialState | null {
  const rounded = Math.round(amount);
  if (rounded <= 0 || state.cash < rounded) return null;
  return { ...state, cash: state.cash - rounded, investments: state.investments + rounded };
}

export function withdrawInvestment(state: FinancialState, amount: number): FinancialState | null {
  const rounded = Math.round(amount);
  if (rounded <= 0 || state.investments < rounded) return null;
  return { ...state, cash: state.cash + rounded, investments: state.investments - rounded };
}

export function spendCash(state: FinancialState, amount: number): FinancialState | null {
  const rounded = Math.round(amount);
  if (rounded <= 0 || state.cash < rounded) return null;
  return { ...state, cash: state.cash - rounded };
}

export function spendForLearning(state: FinancialState, amount: number): FinancialState | null {
  const rounded = Math.round(amount);
  if (rounded <= 0 || state.skillFund + state.cash < rounded) return null;
  const fromSkillFund = Math.min(state.skillFund, rounded);
  return { ...state, skillFund: state.skillFund - fromSkillFund, cash: state.cash - (rounded - fromSkillFund) };
}

export function applyEffect(state: FinancialState, scores: Scores, effect: Effect) {
  const nextState = { ...state };
  const nextScores = { ...scores };
  financialKeys.forEach((key) => {
    const value = effect[key];
    if (typeof value === 'number' && value !== 0) nextState[key] = Math.max(0, nextState[key] + value);
  });
  scoreKeys.forEach((key) => {
    const value = effect[key];
    if (typeof value === 'number' && value !== 0) nextScores[key] = clamp(nextScores[key] + value);
  });
  return { state: nextState, scores: nextScores };
}

export function settleDebtAndInvestments(state: FinancialState, seed: number, month: number) {
  const rate = 0.004 + ((seed * 17 + month * 31) % 13) / 1000;
  const investmentReturn = Math.round(state.investments * rate);
  const debtInterest = Math.round(state.debt * 0.01);
  const due = state.debt > 0 ? Math.min(state.debt + debtInterest, Math.max(500, Math.round(state.debt * 0.1))) : 0;
  const payment = Math.min(due, state.cash);
  return {
    state: {
      ...state,
      cash: state.cash - payment,
      investments: state.investments + investmentReturn,
      debt: Math.max(0, state.debt + debtInterest - payment),
    },
    investmentReturn,
    debtInterest,
    debtPayment: payment,
    investmentRate: rate,
  };
}

export function recalculateScores(
  state: FinancialState,
  previous: Scores,
  lifestyleSpend: number,
  skillSpend: number,
  completedGoals = 0,
  totalGoals = 1,
): Scores {
  const income = Math.max(state.monthlyIncome, 1);
  const liquidWealth = state.cash + state.savings + state.emergencyFund + state.investments - state.debt;
  const coverage = state.emergencyFund / Math.max(state.essentialExpenses, 1);
  return {
    wealth: clamp(24 + (liquidWealth / (income * 5)) * 48),
    security: clamp(16 + coverage * 17 + (state.savings / income) * 7 - (state.debt / income) * 13),
    lifestyle: clamp(previous.lifestyle * 0.86 + 18 + (lifestyleSpend / income) * 35 - (state.debt / income) * 3),
    growth: clamp(previous.growth * 0.88 + 16 + (skillSpend / income) * 45 + (state.investments / (income * 8)) * 18),
    goals: clamp((completedGoals / Math.max(totalGoals, 1)) * 100),
  };
}

export const allocationVector = (allocation: Allocation): StrategyVector => {
  const discretionary = Math.max(allocation.savings + allocation.investments + allocation.emergency + allocation.lifestyle, 1);
  return {
    security: allocation.emergency / discretionary,
    savings: allocation.savings / discretionary,
    growth: allocation.investments / discretionary,
    lifestyle: allocation.lifestyle / discretionary,
  };
};
