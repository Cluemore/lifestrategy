import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AchievementUnlock,
  AgentProgress,
  Allocation,
  BackendAction,
  CompletedRun,
  DeferredEffect,
  FinancialState,
  GameSettings,
  Goal,
  InventoryItem,
  JournalEntry,
  LearningEnrollment,
  LocationId,
  MonthlySnapshot,
  Phase,
  Profile,
  SalaryRecord,
  Scores,
  StrategyId,
  StrategyRecord,
  StrategyVector,
  Transaction,
} from '../game/types';
import {
  allocationVector,
  applyEffect,
  clamp,
  defaultAllocation,
  investCash,
  isValidAllocation,
  processAllocation,
  recalculateScores,
  settleDebtAndInvestments,
  spendCash,
  spendForLearning,
  totalAllocation,
  transferFunds,
  withdrawInvestment,
} from '../game/engine/financeEngine';
import { ACHIEVEMENTS, isUnlocked } from '../game/data/achievements';
import { LEARNING_ACTIVITIES, MARKET_ITEMS, TRAVEL_DESTINATIONS } from '../game/data/activities';
import { isLocationId } from '../game/data/locations';
import { EVENTS } from '../game/data/events';
import { GOAL_CATALOG } from '../game/data/goals';
import { AGENTS, recommendationFor } from '../gameTheory/agents';
import { bestResponses, humanPreferences, matrix, nashEquilibria, paretoFrontier } from '../gameTheory/engine';
import { STRATEGIES } from '../gameTheory/strategies';

type Feedback = { id: string; tone: 'success' | 'error' | 'info'; title: string; message: string };
type Account = 'cash' | 'savings' | 'emergencyFund';

export type BackendStatus = 'loading' | 'ready' | 'offline' | 'saving' | 'error';

export type Game = {
  saveVersion: number;
  hasActiveSession: boolean;
  phase: Phase;
  resumePhase: Phase;
  mode: 'normal' | 'presentation';
  profile: Profile;
  month: number;
  seed: number;
  currentLocation: LocationId;
  discoveredLocations: LocationId[];
  state: FinancialState;
  scores: Scores;
  allocation: Allocation;
  allocationHistory: StrategyVector[];
  goals: Goal[];
  goalFunds: Record<string, number>;
  journal: JournalEntry[];
  transactions: Transaction[];
  salaryHistory: SalaryRecord[];
  deferredEffects: DeferredEffect[];
  learning: LearningEnrollment[];
  inventory: InventoryItem[];
  achievements: AchievementUnlock[];
  agents: AgentProgress[];
  currentAgentId: string;
  strategicHistory: StrategyRecord[];
  monthlyHistory: MonthlySnapshot[];
  completedRuns: CompletedRun[];
  selectedTravelId: string;
  minigameCompletions: string[];
  xp: number;
  level: number;
  debtEver: boolean;
  resilientEvents: number;
  salaryProcessedForMonth: boolean;
  allocationConfirmedForMonth: boolean;
  eventResolvedForMonth: boolean;
  strategyResolvedForMonth: boolean;
  activeEventId?: string;
  settings: GameSettings;
  feedback?: Feedback;
  backendStatus: BackendStatus;
  backendError?: string;
  backendHistory: BackendAction[];

  beginNewGame: () => void;
  start: (profile: Profile, goalIds: string[], mode?: 'normal' | 'presentation') => void;
  continueGame: () => void;
  resetActiveSave: () => void;
  setPhase: (phase: Phase) => void;
  visitLocation: (location: LocationId) => void;
  fastTravel: (location: LocationId) => void;
  processSalary: () => void;
  setAllocation: (key: keyof Allocation, value: number) => void;
  autoBalance: () => void;
  confirmAllocation: () => void;
  chooseEvent: (choiceIndex: number) => void;
  transferMoney: (from: Account, to: Account, amount: number) => void;
  contributeInvestment: (amount: number) => void;
  withdrawFromInvestment: (amount: number) => void;
  fundGoal: (goalId: string, amount: number) => void;
  completeFundedGoal: (goalId: string) => void;
  setTravelDestination: (id: string) => void;
  bookTravel: () => void;
  enrollLearning: (activityId: string) => void;
  acceptCareerOpportunity: (id: 'overtime' | 'freelance' | 'promotion' | 'network') => void;
  buyMarketItem: (itemId: string) => void;
  talkToAgent: (agentId: string) => void;
  recordStrategy: (human: StrategyId, agent: StrategyId) => void;
  finishMonth: () => void;
  completeMiniGame: (gameId: 'salary-split' | 'strategy-match', correct: boolean) => void;
  presentationBeat: () => void;
  setSettings: (patch: Partial<GameSettings>) => void;
  hydrateBackendSave: (snapshot: unknown) => void;
  setBackendStatus: (status: BackendStatus, error?: string) => void;
  setBackendHistory: (history: BackendAction[]) => void;
  appendBackendHistory: (entries: BackendAction[]) => void;
  clearFeedback: () => void;
};

export type GameSaveData = Pick<
  Game,
  | 'saveVersion'
  | 'hasActiveSession'
  | 'phase'
  | 'resumePhase'
  | 'mode'
  | 'profile'
  | 'month'
  | 'seed'
  | 'currentLocation'
  | 'discoveredLocations'
  | 'state'
  | 'scores'
  | 'allocation'
  | 'allocationHistory'
  | 'goals'
  | 'goalFunds'
  | 'journal'
  | 'transactions'
  | 'salaryHistory'
  | 'deferredEffects'
  | 'learning'
  | 'inventory'
  | 'achievements'
  | 'agents'
  | 'currentAgentId'
  | 'strategicHistory'
  | 'monthlyHistory'
  | 'completedRuns'
  | 'selectedTravelId'
  | 'minigameCompletions'
  | 'xp'
  | 'level'
  | 'debtEver'
  | 'resilientEvents'
  | 'salaryProcessedForMonth'
  | 'allocationConfirmedForMonth'
  | 'eventResolvedForMonth'
  | 'strategyResolvedForMonth'
  | 'activeEventId'
  | 'settings'
>;

const DEFAULT_SETTINGS: GameSettings = {
  musicVolume: 0.35,
  sfxVolume: 0.5,
  muted: false,
  reducedMotion: false,
  textSize: 'standard',
  musicPlaying: false,
  musicTrack: 0,
};

const DEFAULT_PROFILE: Profile = {
  name: 'Alex',
  age: 23,
  occupation: 'Junior Software Developer',
  appearance: 0,
  living: 'Living independently',
  scenario: 'steady',
};

const DEFAULT_STATE: FinancialState = {
  cash: 20000,
  savings: 20000,
  emergencyFund: 0,
  investments: 0,
  debt: 0,
  monthlyIncome: 45000,
  essentialExpenses: 20250,
  salaryMultiplier: 1,
  skillFund: 0,
};

const DEFAULT_SCORES: Scores = { wealth: 28, security: 18, lifestyle: 38, growth: 30, goals: 0 };
export const SAVE_VERSION = 3;
const id = (prefix: string, month: number) => `${prefix}-${month}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const money = (amount: number) => `₹${Math.round(amount).toLocaleString('en-IN')}`;

const initialAgents = (): AgentProgress[] =>
  AGENTS.map((agent) => ({ id: agent.id, unlocked: false, satisfaction: 50, interactions: 0, latestRecommendation: 'Meet this person later in your year.' }));

const initialData = (settings: GameSettings = DEFAULT_SETTINGS, completedRuns: CompletedRun[] = []) => ({
  saveVersion: SAVE_VERSION,
  hasActiveSession: false,
  phase: 'title' as Phase,
  resumePhase: 'world' as Phase,
  mode: 'normal' as const,
  profile: DEFAULT_PROFILE,
  month: 1,
  seed: 712,
  currentLocation: 'home' as LocationId,
  discoveredLocations: ['home', 'workplace'] as LocationId[],
  state: DEFAULT_STATE,
  scores: DEFAULT_SCORES,
  allocation: defaultAllocation(DEFAULT_STATE.monthlyIncome),
  allocationHistory: [] as StrategyVector[],
  goals: GOAL_CATALOG.slice(0, 3).map((goal) => ({ ...goal })),
  goalFunds: {} as Record<string, number>,
  journal: [] as JournalEntry[],
  transactions: [] as Transaction[],
  salaryHistory: [] as SalaryRecord[],
  deferredEffects: [] as DeferredEffect[],
  learning: [] as LearningEnrollment[],
  inventory: [] as InventoryItem[],
  achievements: [] as AchievementUnlock[],
  agents: initialAgents(),
  currentAgentId: 'sam',
  strategicHistory: [] as StrategyRecord[],
  monthlyHistory: [] as MonthlySnapshot[],
  completedRuns,
  selectedTravelId: 'goa',
  minigameCompletions: [] as string[],
  xp: 0,
  level: 1,
  debtEver: false,
  resilientEvents: 0,
  salaryProcessedForMonth: false,
  allocationConfirmedForMonth: false,
  eventResolvedForMonth: false,
  strategyResolvedForMonth: false,
  activeEventId: undefined as string | undefined,
  settings,
  feedback: undefined as Feedback | undefined,
});

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const asArray = <T>(value: unknown, fallback: T[]): T[] => Array.isArray(value) ? value as T[] : fallback;
const validPhase = (value: unknown): value is Phase => ['title', 'setup', 'world', 'allocation', 'event', 'reflection', 'strategy', 'final'].includes(String(value));
const validNumber = (value: unknown, fallback: number, min = -Number.MAX_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) => {
  const next = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return clamp(next, min, max);
};

export const gameSnapshot = (state: Game): GameSaveData => ({
  saveVersion: SAVE_VERSION,
  hasActiveSession: state.hasActiveSession,
  phase: state.phase,
  resumePhase: state.resumePhase,
  mode: state.mode,
  profile: state.profile,
  month: state.month,
  seed: state.seed,
  currentLocation: state.currentLocation,
  discoveredLocations: state.discoveredLocations,
  state: state.state,
  scores: state.scores,
  allocation: state.allocation,
  allocationHistory: state.allocationHistory,
  goals: state.goals,
  goalFunds: state.goalFunds,
  journal: state.journal,
  transactions: state.transactions,
  salaryHistory: state.salaryHistory,
  deferredEffects: state.deferredEffects,
  learning: state.learning,
  inventory: state.inventory,
  achievements: state.achievements,
  agents: state.agents,
  currentAgentId: state.currentAgentId,
  strategicHistory: state.strategicHistory,
  monthlyHistory: state.monthlyHistory,
  completedRuns: state.completedRuns,
  selectedTravelId: state.selectedTravelId,
  minigameCompletions: state.minigameCompletions,
  xp: state.xp,
  level: state.level,
  debtEver: state.debtEver,
  resilientEvents: state.resilientEvents,
  salaryProcessedForMonth: state.salaryProcessedForMonth,
  allocationConfirmedForMonth: state.allocationConfirmedForMonth,
  eventResolvedForMonth: state.eventResolvedForMonth,
  strategyResolvedForMonth: state.strategyResolvedForMonth,
  activeEventId: state.activeEventId,
  settings: state.settings,
});

/** Validate a remote JSON save while supplying safe defaults for old or partial schemas. */
const normaliseBackendSave = (snapshot: unknown, localSettings: GameSettings, localCompletedRuns: CompletedRun[]): GameSaveData => {
  const source = isRecord(snapshot) ? snapshot : {};
  const defaults = initialData(localSettings, localCompletedRuns);
  const remoteState = isRecord(source.state) ? source.state : {};
  const remoteScores = isRecord(source.scores) ? source.scores : {};
  const remoteProfile = isRecord(source.profile) ? source.profile : {};
  const remoteAllocation = isRecord(source.allocation) ? source.allocation : {};
  const remoteSettings = isRecord(source.settings) ? source.settings : {};
  const month = Math.round(validNumber(source.month, defaults.month, 1, 12));
  const resumePhase = validPhase(source.resumePhase) ? source.resumePhase : validPhase(source.phase) && source.phase !== 'title' && source.phase !== 'setup' ? source.phase : 'world';
  const textSize = remoteSettings.textSize === 'large' ? 'large' : 'standard';
  return {
    ...(defaults as GameSaveData),
    saveVersion: SAVE_VERSION,
    hasActiveSession: source.hasActiveSession === true,
    phase: 'title',
    resumePhase,
    mode: source.mode === 'presentation' ? 'presentation' : 'normal',
    profile: {
      ...defaults.profile,
      ...remoteProfile,
      name: typeof remoteProfile.name === 'string' && remoteProfile.name.trim() ? remoteProfile.name.slice(0, 120) : defaults.profile.name,
      age: Math.round(validNumber(remoteProfile.age, defaults.profile.age, 18, 80)),
      appearance: Math.round(validNumber(remoteProfile.appearance, defaults.profile.appearance, 0, 3)),
      scenario: remoteProfile.scenario === 'starter' || remoteProfile.scenario === 'career' ? remoteProfile.scenario : 'steady',
    },
    month,
    seed: Math.round(validNumber(source.seed, defaults.seed, 1)),
    currentLocation: isLocationId(source.currentLocation) ? source.currentLocation : defaults.currentLocation,
    discoveredLocations: asArray<LocationId>(source.discoveredLocations, defaults.discoveredLocations).filter(isLocationId),
    state: {
      ...defaults.state,
      ...remoteState,
      cash: validNumber(remoteState.cash, defaults.state.cash, 0),
      savings: validNumber(remoteState.savings, defaults.state.savings, 0),
      emergencyFund: validNumber(remoteState.emergencyFund, defaults.state.emergencyFund, 0),
      investments: validNumber(remoteState.investments, defaults.state.investments, 0),
      debt: validNumber(remoteState.debt, defaults.state.debt, 0),
      monthlyIncome: validNumber(remoteState.monthlyIncome, defaults.state.monthlyIncome, 0),
      essentialExpenses: validNumber(remoteState.essentialExpenses, defaults.state.essentialExpenses, 1),
    },
    scores: {
      ...defaults.scores,
      ...remoteScores,
      wealth: validNumber(remoteScores.wealth, defaults.scores.wealth, 0, 100),
      security: validNumber(remoteScores.security, defaults.scores.security, 0, 100),
      lifestyle: validNumber(remoteScores.lifestyle, defaults.scores.lifestyle, 0, 100),
      growth: validNumber(remoteScores.growth, defaults.scores.growth, 0, 100),
      goals: validNumber(remoteScores.goals, defaults.scores.goals, 0, 100),
    },
    allocation: {
      ...defaults.allocation,
      ...remoteAllocation,
      needs: validNumber(remoteAllocation.needs, defaults.allocation.needs, 0),
      savings: validNumber(remoteAllocation.savings, defaults.allocation.savings, 0),
      investments: validNumber(remoteAllocation.investments, defaults.allocation.investments, 0),
      emergency: validNumber(remoteAllocation.emergency, defaults.allocation.emergency, 0),
      lifestyle: validNumber(remoteAllocation.lifestyle, defaults.allocation.lifestyle, 0),
      skills: validNumber(remoteAllocation.skills, defaults.allocation.skills, 0),
    },
    allocationHistory: asArray<StrategyVector>(source.allocationHistory, defaults.allocationHistory),
    goals: asArray<Goal>(source.goals, defaults.goals),
    goalFunds: isRecord(source.goalFunds) ? source.goalFunds as Record<string, number> : defaults.goalFunds,
    journal: asArray<JournalEntry>(source.journal, defaults.journal),
    transactions: asArray<Transaction>(source.transactions, defaults.transactions),
    salaryHistory: asArray<SalaryRecord>(source.salaryHistory, defaults.salaryHistory),
    deferredEffects: asArray<DeferredEffect>(source.deferredEffects, defaults.deferredEffects),
    learning: asArray<LearningEnrollment>(source.learning, defaults.learning),
    inventory: asArray<InventoryItem>(source.inventory, defaults.inventory),
    achievements: asArray<AchievementUnlock>(source.achievements, defaults.achievements),
    agents: asArray<AgentProgress>(source.agents, defaults.agents),
    currentAgentId: typeof source.currentAgentId === 'string' ? source.currentAgentId : defaults.currentAgentId,
    strategicHistory: asArray<StrategyRecord>(source.strategicHistory, defaults.strategicHistory),
    monthlyHistory: asArray<MonthlySnapshot>(source.monthlyHistory, defaults.monthlyHistory),
    completedRuns: asArray<CompletedRun>(source.completedRuns, localCompletedRuns),
    selectedTravelId: typeof source.selectedTravelId === 'string' ? source.selectedTravelId : defaults.selectedTravelId,
    minigameCompletions: asArray<string>(source.minigameCompletions, defaults.minigameCompletions),
    xp: Math.round(validNumber(source.xp, defaults.xp, 0)),
    level: Math.max(1, Math.round(validNumber(source.level, defaults.level, 1))),
    debtEver: source.debtEver === true,
    resilientEvents: Math.round(validNumber(source.resilientEvents, defaults.resilientEvents, 0)),
    salaryProcessedForMonth: source.salaryProcessedForMonth === true,
    allocationConfirmedForMonth: source.allocationConfirmedForMonth === true,
    eventResolvedForMonth: source.eventResolvedForMonth === true,
    strategyResolvedForMonth: source.strategyResolvedForMonth === true,
    activeEventId: typeof source.activeEventId === 'string' ? source.activeEventId : undefined,
    settings: {
      ...defaults.settings,
      ...remoteSettings,
      musicVolume: validNumber(remoteSettings.musicVolume, defaults.settings.musicVolume, 0, 1),
      sfxVolume: validNumber(remoteSettings.sfxVolume, defaults.settings.sfxVolume, 0, 1),
      muted: remoteSettings.muted === true,
      reducedMotion: remoteSettings.reducedMotion === true,
      textSize,
      musicPlaying: remoteSettings.musicPlaying === true,
      musicTrack: Math.round(validNumber(remoteSettings.musicTrack, defaults.settings.musicTrack, 0)),
    },
  };
};

const eventFor = (month: number, mode: 'normal' | 'presentation', seed: number) => {
  const presentationRoute = [24, 0, 12, 3, 13, 29, 1, 16, 30, 5, 18, 34];
  return mode === 'presentation' ? presentationRoute[month - 1] % EVENTS.length : (seed * month * 17 + month * 13) % EVENTS.length;
};

const journalEntry = (month: number, kind: JournalEntry['kind'], title: string, message: string, amount?: number): JournalEntry => ({
  id: id(kind, month),
  month,
  kind,
  title,
  message,
  amount,
});

const feedback = (month: number, tone: Feedback['tone'], title: string, message: string): Feedback => ({ id: id('feedback', month), tone, title, message });

const refreshGoals = (goals: Goal[], state: FinancialState, goalFunds: Record<string, number>, learning: LearningEnrollment[]) => {
  const certificate = learning.find((item) => item.id === 'certificate');
  return goals.map((goal) => {
    let progress = goal.progress;
    if (goal.id === 'emergency') progress = Math.min(goal.target, state.emergencyFund);
    if (goal.id === 'invest') progress = Math.min(goal.target, state.investments);
    if (goal.id === 'certificate') progress = certificate?.status === 'completed' ? goal.target : certificate ? Math.round(goal.target * 0.35) : 0;
    if (['travel', 'laptop', 'purchase'].includes(goal.id) && !goal.complete) progress = Math.min(goal.target, goalFunds[goal.id] || 0);
    const autoComplete = ['emergency', 'invest', 'certificate'].includes(goal.id) && progress >= goal.target;
    return { ...goal, progress, complete: goal.complete || autoComplete };
  });
};

const classifyRun = (history: StrategyVector[]) => {
  if (!history.length) return 'Balanced Planner';
  const totals = history.reduce(
    (sum, row) => ({
      security: sum.security + row.security,
      growth: sum.growth + row.growth,
      lifestyle: sum.lifestyle + row.lifestyle,
      savings: sum.savings + row.savings,
    }),
    { security: 0, growth: 0, lifestyle: 0, savings: 0 },
  );
  const ordered = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const spread = ordered[0][1] - ordered.at(-1)![1];
  if (spread < history.length * 0.12) return 'Balanced Planner';
  if (ordered[0][0] === 'security' || ordered[0][0] === 'savings') return 'Security Architect';
  if (ordered[0][0] === 'growth') return 'Growth Strategist';
  return 'Experience Seeker';
};

const achievementSweep = (
  existing: AchievementUnlock[],
  month: number,
  state: FinancialState,
  goals: Goal[],
  learning: LearningEnrollment[],
  strategicHistory: StrategyRecord[],
  allocation: Allocation,
  debtEver: boolean,
  resilientEvents: number,
) => {
  const ids: string[] = [];
  const coverage = state.emergencyFund / Math.max(state.essentialExpenses, 1);
  const values = [allocation.savings, allocation.investments, allocation.emergency, allocation.lifestyle];
  const balanced = Math.max(...values) - Math.min(...values) <= state.monthlyIncome * 0.14;
  if (state.savings >= 10000) ids.push('first-saved');
  if (coverage >= 3) ids.push('emergency-ready');
  if (debtEver && state.debt === 0) ids.push('debt-free');
  if (state.investments > 0) ids.push('first-investment');
  if (learning.some((item) => item.status === 'completed')) ids.push('skill-builder');
  if (goals.some((goal) => goal.complete)) ids.push('goal-getter');
  if (strategicHistory.length > 0) ids.push('strategic-thinker');
  if (balanced) ids.push('balanced-planner');
  if (resilientEvents > 0) ids.push('resilient');
  if (goals.some((goal) => goal.id === 'travel' && goal.complete)) ids.push('frequent-traveller');
  return [...existing, ...ids.filter((achievementId) => !isUnlocked(existing, achievementId)).map((achievementId) => ({ id: achievementId, unlockedMonth: month }))];
};

const scenarioState = (scenario: Profile['scenario']): FinancialState => {
  if (scenario === 'starter') return { ...DEFAULT_STATE, cash: 12000, savings: 8000, monthlyIncome: 38000, essentialExpenses: 17000 };
  if (scenario === 'career') return { ...DEFAULT_STATE, cash: 30000, savings: 12000, monthlyIncome: 56000, essentialExpenses: 24000 };
  return { ...DEFAULT_STATE };
};

const careerAvailable = (id: 'overtime' | 'freelance' | 'promotion' | 'network', month: number, scores: Scores, learning: LearningEnrollment[]) => {
  if (id === 'promotion') return month >= 6 && (scores.growth >= 50 || learning.some((item) => item.id === 'certificate' && item.status === 'completed'));
  if (id === 'freelance') return month >= 3;
  if (id === 'network') return month >= 2;
  return true;
};

export const useGameStore = create<Game>()(
  persist(
    (set, get) => ({
      ...initialData(),
      backendStatus: 'loading' as BackendStatus,
      backendError: undefined,
      backendHistory: [],

      beginNewGame: () => {
        const current = get();
        set({ ...initialData(current.settings, current.completedRuns), phase: 'setup', resumePhase: 'setup' });
      },

      start: (profile, goalIds, mode = 'normal') => {
        const current = get();
        const state = mode === 'presentation' ? scenarioState('steady') : scenarioState(profile.scenario);
        const cleanProfile = { ...profile, name: profile.name.trim() || 'Alex' };
        const goals = GOAL_CATALOG.filter((goal) => goalIds.includes(goal.id)).map((goal) => ({ ...goal }));
        const agentStates = initialAgents().map((agent) => {
          const raw = AGENTS.find((candidate) => candidate.id === agent.id)!;
          return { ...agent, unlocked: raw.month <= 1, latestRecommendation: raw.month <= 1 ? recommendationFor(raw, state) : agent.latestRecommendation };
        });
        set({
          ...initialData(current.settings, current.completedRuns),
          hasActiveSession: true,
          phase: 'world',
          resumePhase: 'world',
          mode,
          profile: cleanProfile,
          seed: mode === 'presentation' ? 712 : Math.floor(Math.random() * 9000) + 1000,
          state,
          allocation: defaultAllocation(state.monthlyIncome),
          goals,
          agents: agentStates,
          journal: [journalEntry(1, 'system', 'A new financial year begins', `${cleanProfile.name} starts with ${money(state.cash)} cash and ${money(state.savings)} in savings.`)],
          feedback: feedback(1, 'success', 'Your year begins', 'Visit the Workplace to receive April’s salary budget.'),
        });
      },

      continueGame: () => {
        const current = get();
        if (!current.hasActiveSession) {
          set({ feedback: feedback(current.month, 'error', 'No active journey', 'Start a new journey or choose Presentation Mode first.') });
          return;
        }
        set({ phase: current.resumePhase === 'title' || current.resumePhase === 'setup' ? 'world' : current.resumePhase });
      },

      resetActiveSave: () => {
        const current = get();
        set({ ...initialData(current.settings, current.completedRuns), feedback: feedback(1, 'info', 'Active save reset', 'Your unfinished journey was removed. Completed journeys remain available for comparison.') });
      },

      setPhase: (phase) => set({ phase, resumePhase: phase }),

      visitLocation: (location) => {
        const current = get();
        const firstVisit = !current.discoveredLocations.includes(location);
        const discoveredLocations = firstVisit ? [...current.discoveredLocations, location] : current.discoveredLocations;
        set({
          currentLocation: location,
          discoveredLocations,
          journal: firstVisit
            ? [...current.journal, journalEntry(current.month, 'location', 'New place discovered', `You found ${location === 'investments' ? 'Investment Corner' : location === 'strategy' ? 'Strategy Lab' : location[0].toUpperCase() + location.slice(1)}.`)]
            : current.journal,
        });
      },

      fastTravel: (location) => {
        const current = get();
        if (!current.discoveredLocations.includes(location)) {
          set({ feedback: feedback(current.month, 'error', 'Location not discovered', 'Walk there once in town before using fast travel.') });
          return;
        }
        set({ currentLocation: location, feedback: feedback(current.month, 'success', 'Fast travelled', 'You are ready to interact at this location.') });
      },

      processSalary: () => {
        const current = get();
        if (current.salaryProcessedForMonth) {
          set({ feedback: feedback(current.month, 'info', 'Salary already processed', 'This month’s income is already available for allocation. Refreshing or revisiting cannot pay it twice.') });
          return;
        }
        const base = current.state.monthlyIncome;
        const record: SalaryRecord = { month: current.month, base, bonus: 0, deductions: 0, paid: base };
        set({
          salaryProcessedForMonth: true,
          salaryHistory: [...current.salaryHistory, record],
          journal: [...current.journal, journalEntry(current.month, 'salary', 'Salary budget received', `${money(base)} is ready to place across this month’s plan.`, base)],
          feedback: feedback(current.month, 'success', 'Salary received', `${money(base)} can now be allocated. It will not be paid again this month.`),
        });
      },

      setAllocation: (key, value) => {
        const current = get();
        if (current.allocationConfirmedForMonth) {
          set({ feedback: feedback(current.month, 'error', 'Allocation locked', 'This month’s plan has already been confirmed and cannot be silently rewritten.') });
          return;
        }
        set({ allocation: { ...current.allocation, [key]: Math.max(0, Math.round(value / 500) * 500) } });
      },

      autoBalance: () => {
        const current = get();
        if (current.allocationConfirmedForMonth) return;
        const coverage = current.state.emergencyFund / Math.max(current.state.essentialExpenses, 1);
        const roundDown = (share: number) => Math.floor((current.state.monthlyIncome * share) / 500) * 500;
        // Floor each proposed bucket, then give the exact residual to skills.
        // This prevents rounding from ever producing an allocation above salary.
        const needs = roundDown(0.45);
        const emergencyWeight = current.goals.some((goal) => goal.id === 'emergency' && !goal.complete) && coverage < 3 ? 0.14 : 0.08;
        const growthWeight = current.goals.some((goal) => goal.category === 'growth' && !goal.complete) ? 0.14 : 0.1;
        const savings = roundDown(0.14);
        const emergency = roundDown(emergencyWeight);
        const investments = roundDown(growthWeight);
        const lifestyle = roundDown(0.09);
        const skills = Math.max(0, current.state.monthlyIncome - needs - savings - emergency - investments - lifestyle);
        set({ allocation: { needs, savings, emergency, investments, lifestyle, skills }, feedback: feedback(current.month, 'info', 'Suggested Balance applied', 'This is a convenience suggestion based on your goals—not financial advice.') });
      },

      confirmAllocation: () => {
        const current = get();
        if (!current.salaryProcessedForMonth) {
          set({ feedback: feedback(current.month, 'error', 'Visit the Workplace first', 'Receive this month’s salary budget before planning where it goes.') });
          return;
        }
        if (current.allocationConfirmedForMonth) {
          set({ feedback: feedback(current.month, 'info', 'Allocation already confirmed', 'The current month already has a locked plan.') });
          return;
        }
        if (!isValidAllocation(current.allocation, current.state.monthlyIncome)) {
          set({ feedback: feedback(current.month, 'error', 'Allocation is incomplete', `Allocate exactly ${money(current.state.monthlyIncome)} before confirming.`) });
          return;
        }
        const nextState = processAllocation(current.state, current.allocation);
        const nextGoals = refreshGoals(current.goals, nextState, current.goalFunds, current.learning);
        const nextScores = recalculateScores(nextState, current.scores, current.allocation.lifestyle, current.allocation.skills, nextGoals.filter((goal) => goal.complete).length, nextGoals.length);
        const nextAchievements = achievementSweep(current.achievements, current.month, nextState, nextGoals, current.learning, current.strategicHistory, current.allocation, current.debtEver, current.resilientEvents);
        const event = EVENTS[eventFor(current.month, current.mode, current.seed)];
        set({
          state: nextState,
          scores: nextScores,
          goals: nextGoals,
          achievements: nextAchievements,
          allocationHistory: [...current.allocationHistory, allocationVector(current.allocation)],
          allocationConfirmedForMonth: true,
          activeEventId: event.id,
          phase: 'event',
          resumePhase: 'event',
          journal: [...current.journal, journalEntry(current.month, 'allocation', 'Monthly plan confirmed', `Needs ${money(current.allocation.needs)} · Savings ${money(current.allocation.savings)} · Investments ${money(current.allocation.investments)}.`, current.state.monthlyIncome)],
          feedback: feedback(current.month, 'success', 'Plan confirmed', 'Your choices now shape the event and the rest of this month.'),
        });
      },

      chooseEvent: (choiceIndex) => {
        const current = get();
        const event = EVENTS.find((candidate) => candidate.id === current.activeEventId);
        if (!event || !current.allocationConfirmedForMonth || current.eventResolvedForMonth) {
          set({ feedback: feedback(current.month, 'error', 'Event unavailable', 'This event has already been resolved or your plan is not confirmed yet.') });
          return;
        }
        const choice = event.choices[choiceIndex];
        if (!choice) return;
        const effect = { ...choice.effect };
        (['cash', 'savings', 'emergencyFund'] as const).forEach((account) => {
          const requested = effect[account];
          if (typeof requested === 'number' && requested < 0 && current.state[account] < Math.abs(requested)) {
            const gap = Math.abs(requested) - current.state[account];
            effect[account] = -current.state[account];
            effect.debt = (effect.debt || 0) + gap;
          }
        });
        const applied = applyEffect(current.state, current.scores, effect);
        const newDebt = (effect.debt || 0) > 0;
        const deferredEffects = choice.delayed
          ? [...current.deferredEffects, { id: id('deferred', current.month), triggerMonth: current.month + choice.delayed.dueIn, source: event.title, description: choice.delayed.label, effect: choice.delayed.effect, kind: 'effect' as const }]
          : current.deferredEffects;
        const nextGoals = refreshGoals(current.goals, applied.state, current.goalFunds, current.learning);
        const nextAchievements = achievementSweep(
          current.achievements,
          current.month,
          applied.state,
          nextGoals,
          current.learning,
          current.strategicHistory,
          current.allocation,
          current.debtEver || newDebt,
          current.resilientEvents + (event.type === 'problem' && choiceIndex === 0 && !newDebt ? 1 : 0),
        );
        set({
          state: applied.state,
          scores: applied.scores,
          goals: nextGoals,
          achievements: nextAchievements,
          deferredEffects,
          debtEver: current.debtEver || newDebt,
          resilientEvents: current.resilientEvents + (event.type === 'problem' && choiceIndex === 0 && !newDebt ? 1 : 0),
          eventResolvedForMonth: true,
          phase: current.month >= 7 ? 'strategy' : 'reflection',
          resumePhase: current.month >= 7 ? 'strategy' : 'reflection',
          journal: [...current.journal, {
            ...journalEntry(current.month, 'event', event.title, `You chose “${choice.label}”. ${choice.hint}`, effect.cash || effect.savings || effect.emergencyFund || effect.investments),
            eventId: event.id,
            choiceText: choice.label,
            consequence: effect,
          }],
          feedback: feedback(current.month, 'success', 'Choice recorded', choice.delayed ? `${choice.delayed.label} has been scheduled.` : 'The consequence is now part of your journey.'),
        });
      },

      transferMoney: (from, to, amount) => {
        const current = get();
        const nextState = transferFunds(current.state, from, to, amount);
        if (!nextState) {
          set({ feedback: feedback(current.month, 'error', 'Transfer could not be made', 'Choose different accounts and an amount you actually hold.') });
          return;
        }
        const rounded = Math.round(amount);
        set({
          state: nextState,
          transactions: [...current.transactions, { id: id('transfer', current.month), month: current.month, type: 'transfer', description: `Moved ${money(rounded)} from ${from} to ${to}.`, amount: rounded, from, to }],
          journal: [...current.journal, journalEntry(current.month, 'location', 'Bank transfer', `${money(rounded)} moved from ${from} to ${to}.`, rounded)],
          feedback: feedback(current.month, 'success', 'Transfer complete', `${money(rounded)} moved to ${to}.`),
        });
      },

      contributeInvestment: (amount) => {
        const current = get();
        const nextState = investCash(current.state, amount);
        if (!nextState) {
          set({ feedback: feedback(current.month, 'error', 'Not enough cash', 'Move available cash from savings first if you want to contribute to investments.') });
          return;
        }
        const nextGoals = refreshGoals(current.goals, nextState, current.goalFunds, current.learning);
        const nextAchievements = achievementSweep(current.achievements, current.month, nextState, nextGoals, current.learning, current.strategicHistory, current.allocation, current.debtEver, current.resilientEvents);
        set({
          state: nextState,
          goals: nextGoals,
          achievements: nextAchievements,
          transactions: [...current.transactions, { id: id('investment', current.month), month: current.month, type: 'investment', description: `Invested ${money(amount)} in the simulated portfolio.`, amount }],
          journal: [...current.journal, journalEntry(current.month, 'location', 'Investment contribution', `${money(amount)} added to the simulated portfolio.`, amount)],
          feedback: feedback(current.month, 'success', 'Investment added', 'Returns are simulated deterministically at month-end; no live market data is used.'),
        });
      },

      withdrawFromInvestment: (amount) => {
        const current = get();
        const nextState = withdrawInvestment(current.state, amount);
        if (!nextState) {
          set({ feedback: feedback(current.month, 'error', 'Withdrawal unavailable', 'The requested amount is larger than your simulated investment balance.') });
          return;
        }
        set({
          state: nextState,
          transactions: [...current.transactions, { id: id('investment-withdrawal', current.month), month: current.month, type: 'withdrawal', description: `Withdrew ${money(amount)} from the simulated portfolio.`, amount }],
          journal: [...current.journal, journalEntry(current.month, 'location', 'Investment withdrawal', `${money(amount)} returned to cash.`, amount)],
          feedback: feedback(current.month, 'success', 'Investment withdrawn', `${money(amount)} is now cash.`),
        });
      },

      fundGoal: (goalId, amount) => {
        const current = get();
        const goal = current.goals.find((candidate) => candidate.id === goalId);
        const rounded = Math.round(amount);
        if (!goal || goal.complete || rounded <= 0 || current.state.cash < rounded) {
          set({ feedback: feedback(current.month, 'error', 'Goal funding unavailable', 'Use spendable cash and choose an unfinished, fundable goal.') });
          return;
        }
        if (!['travel', 'laptop', 'purchase'].includes(goalId)) {
          set({ feedback: feedback(current.month, 'info', 'This goal updates automatically', 'Its progress is linked directly to your fund, investment, or completed learning activity.') });
          return;
        }
        const nextState = { ...current.state, cash: current.state.cash - rounded };
        const goalFunds = { ...current.goalFunds, [goalId]: (current.goalFunds[goalId] || 0) + rounded };
        const goals = refreshGoals(current.goals, nextState, goalFunds, current.learning);
        set({
          state: nextState,
          goalFunds,
          goals,
          transactions: [...current.transactions, { id: id('goal', current.month), month: current.month, type: 'goal', description: `Set aside ${money(rounded)} for ${goal.name}.`, amount: rounded, from: 'cash', to: goal.name }],
          journal: [...current.journal, journalEntry(current.month, 'goal', 'Goal fund updated', `${money(rounded)} set aside for ${goal.name}.`, rounded)],
          feedback: feedback(current.month, 'success', 'Goal fund updated', `${money(rounded)} is reserved for ${goal.name}.`),
        });
      },

      completeFundedGoal: (goalId) => {
        const current = get();
        const goal = current.goals.find((candidate) => candidate.id === goalId);
        if (!goal || goal.complete || goal.progress < goal.target || !['laptop', 'purchase'].includes(goalId)) {
          set({ feedback: feedback(current.month, 'error', 'Goal is not ready', 'Fund the full target before completing this goal.') });
          return;
        }
        const goals = current.goals.map((candidate) => (candidate.id === goalId ? { ...candidate, complete: true, progress: candidate.target } : candidate));
        const item: InventoryItem = { id: id(`goal-${goalId}`, current.month), name: goalId === 'laptop' ? 'New Laptop' : 'Major Purchase', icon: goalId === 'laptop' ? '💻' : '🎁', earnedMonth: current.month, note: `${goal.name} completed through deliberate saving.` };
        const achievements = achievementSweep(current.achievements, current.month, current.state, goals, current.learning, current.strategicHistory, current.allocation, current.debtEver, current.resilientEvents);
        set({
          goals,
          goalFunds: { ...current.goalFunds, [goalId]: 0 },
          inventory: [...current.inventory, item],
          achievements,
          journal: [...current.journal, journalEntry(current.month, 'goal', 'Goal completed', `${goal.name} is now part of your life.`)],
          feedback: feedback(current.month, 'success', 'Goal completed!', `${item.name} has been added to your room and inventory.`),
        });
      },

      setTravelDestination: (selectedTravelId) => set({ selectedTravelId }),

      bookTravel: () => {
        const current = get();
        const goal = current.goals.find((candidate) => candidate.id === 'travel');
        const trip = TRAVEL_DESTINATIONS.find((candidate) => candidate.id === current.selectedTravelId)!;
        if (!goal || goal.complete || (current.goalFunds.travel || 0) < trip.cost) {
          set({ feedback: feedback(current.month, 'error', 'Trip not affordable yet', 'Fund your travel goal with cash until it can cover the selected destination.') });
          return;
        }
        const goals = current.goals.map((candidate) => (candidate.id === 'travel' ? { ...candidate, progress: candidate.target, complete: true } : candidate));
        const goalFunds = { ...current.goalFunds, travel: Math.max(0, (current.goalFunds.travel || 0) - trip.cost) };
        const applied = applyEffect(current.state, current.scores, { lifestyle: 8, goals: 8 });
        const item: InventoryItem = { id: id('travel', current.month), name: `${trip.name} ticket`, icon: trip.icon, earnedMonth: current.month, note: `${trip.description} A postcard now sits in your room.` };
        const achievements = achievementSweep(current.achievements, current.month, applied.state, goals, current.learning, current.strategicHistory, current.allocation, current.debtEver, current.resilientEvents);
        set({
          state: applied.state,
          scores: applied.scores,
          goals,
          goalFunds,
          inventory: [...current.inventory, item],
          achievements,
          transactions: [...current.transactions, { id: id('travel', current.month), month: current.month, type: 'travel', description: `Booked ${trip.name}.`, amount: trip.cost, from: 'travel fund' }],
          journal: [...current.journal, journalEntry(current.month, 'travel', 'Travel booked', `${trip.name}: ${trip.description}`, trip.cost)],
          feedback: feedback(current.month, 'success', 'Travel goal completed!', `${trip.name} has been booked, and your Lifestyle and Goals scores increased.`),
        });
      },

      enrollLearning: (activityId) => {
        const current = get();
        const activity = LEARNING_ACTIVITIES.find((candidate) => candidate.id === activityId);
        if (!activity || current.learning.some((item) => item.id === activityId && item.status === 'active')) {
          set({ feedback: feedback(current.month, 'error', 'Learning activity unavailable', 'That activity is already in progress or no longer exists.') });
          return;
        }
        if (current.month + activity.duration > 12) {
          set({ feedback: feedback(current.month, 'error', 'Not enough time in this run', 'Choose an activity that can complete before Month 12 so its delayed effect can genuinely occur.') });
          return;
        }
        const nextState = spendForLearning(current.state, activity.cost);
        if (!nextState) {
          set({ feedback: feedback(current.month, 'error', 'Not enough learning money', `Use this month’s Skill Development allocation or keep ${money(activity.cost)} in cash.`) });
          return;
        }
        const enrollment: LearningEnrollment = {
          id: activity.id,
          name: activity.name,
          icon: activity.icon,
          cost: activity.cost,
          startedMonth: current.month,
          completionMonth: current.month + activity.duration,
          growth: activity.growth,
          salaryBoost: activity.salaryBoost,
          status: 'active',
        };
        const deferred: DeferredEffect = {
          id: id('learning', current.month),
          triggerMonth: enrollment.completionMonth,
          source: activity.name,
          description: `${activity.name} completes`,
          effect: { growth: activity.growth, monthlyIncome: activity.salaryBoost || 0 },
          kind: 'learning',
          data: { learningId: activity.id, inventoryName: `${activity.name} certificate`, inventoryIcon: activity.icon },
        };
        const learning = [...current.learning, enrollment];
        const goals = refreshGoals(current.goals, nextState, current.goalFunds, learning);
        set({
          state: nextState,
          learning,
          goals,
          deferredEffects: [...current.deferredEffects, deferred],
          transactions: [...current.transactions, { id: id('learning-cost', current.month), month: current.month, type: 'learning', description: `Started ${activity.name}.`, amount: activity.cost, from: 'skill fund / cash' }],
          journal: [...current.journal, journalEntry(current.month, 'learning', 'Learning started', `${activity.name} will complete in Month ${enrollment.completionMonth}.`, activity.cost)],
          feedback: feedback(current.month, 'success', 'Learning started', `${activity.name} has a real delayed completion effect.`),
        });
      },

      acceptCareerOpportunity: (opportunityId) => {
        const current = get();
        if (!careerAvailable(opportunityId, current.month, current.scores, current.learning)) {
          set({ feedback: feedback(current.month, 'error', 'Not eligible yet', 'Build skills, keep progressing, or return in a later month for this opportunity.') });
          return;
        }
        const unique = `career-${opportunityId}`;
        if (current.inventory.some((item) => item.id.startsWith(unique))) {
          set({ feedback: feedback(current.month, 'info', 'Already completed', 'This career opportunity has already been used once this run.') });
          return;
        }
        let nextState = { ...current.state };
        let nextScores = { ...current.scores };
        let description = '';
        let amount = 0;
        if (opportunityId === 'overtime') {
          nextState.cash += 2500;
          nextScores = applyEffect(nextState, nextScores, { lifestyle: -2 }).scores;
          description = 'You took one paid overtime shift.';
          amount = 2500;
        }
        if (opportunityId === 'freelance') {
          nextState.cash += 5500;
          nextScores = applyEffect(nextState, nextScores, { growth: 3 }).scores;
          description = 'You completed a freelance project.';
          amount = 5500;
        }
        if (opportunityId === 'promotion') {
          nextState.monthlyIncome += 5000;
          nextScores = applyEffect(nextState, nextScores, { growth: 6, wealth: 3 }).scores;
          description = 'Your promotion permanently raises the monthly salary budget.';
          amount = 5000;
        }
        if (opportunityId === 'network') {
          nextScores = applyEffect(nextState, nextScores, { growth: 4 }).scores;
          description = 'A networking conversation expands future opportunities.';
          amount = 0;
        }
        const item: InventoryItem = { id: `${unique}-${current.month}`, name: opportunityId[0].toUpperCase() + opportunityId.slice(1), icon: opportunityId === 'promotion' ? '🏅' : opportunityId === 'freelance' ? '🧑🏽‍💻' : opportunityId === 'network' ? '🤝' : '⏱️', earnedMonth: current.month, note: description };
        set({
          state: nextState,
          scores: nextScores,
          inventory: [...current.inventory, item],
          journal: [...current.journal, journalEntry(current.month, 'career', 'Career opportunity', description, amount || undefined)],
          feedback: feedback(current.month, 'success', 'Career progress recorded', description),
        });
      },

      buyMarketItem: (itemId) => {
        const current = get();
        const item = MARKET_ITEMS.find((candidate) => candidate.id === itemId);
        if (!item) return;
        const nextState = spendCash(current.state, item.cost);
        if (!nextState) {
          set({ feedback: feedback(current.month, 'error', 'Not enough lifestyle cash', 'Your Lifestyle allocation becomes cash; use the Bank if you intentionally want to withdraw savings.') });
          return;
        }
        const applied = applyEffect(nextState, current.scores, { lifestyle: item.lifestyle });
        const inventory = item.collectible
          ? [...current.inventory, { id: id(`market-${item.id}`, current.month), name: item.name, icon: item.icon, earnedMonth: current.month, note: item.note }]
          : current.inventory;
        set({
          state: applied.state,
          scores: applied.scores,
          inventory,
          transactions: [...current.transactions, { id: id('market', current.month), month: current.month, type: 'purchase', description: `Bought ${item.name}.`, amount: item.cost, from: 'cash' }],
          journal: [...current.journal, journalEntry(current.month, 'market', item.name, item.note, item.cost)],
          feedback: feedback(current.month, 'success', 'Purchase recorded', `${money(item.cost)} spent · Lifestyle +${item.lifestyle}.`),
        });
      },

      talkToAgent: (agentId) => {
        const current = get();
        const agent = AGENTS.find((candidate) => candidate.id === agentId);
        const progress = current.agents.find((candidate) => candidate.id === agentId);
        if (!agent || !progress || current.month < agent.month) {
          set({ feedback: feedback(current.month, 'error', 'Agent not unlocked', 'This person joins the Café later in the year.') });
          return;
        }
        const agents = current.agents.map((candidate) =>
          candidate.id === agentId
            ? { ...candidate, unlocked: true, interactions: candidate.interactions + 1, satisfaction: clamp(candidate.satisfaction + 2), latestRecommendation: recommendationFor(agent, current.state) }
            : candidate,
        );
        set({
          agents,
          currentAgentId: agentId,
          journal: [...current.journal, journalEntry(current.month, 'strategy', `Café conversation with ${agent.short}`, recommendationFor(agent, current.state))],
          feedback: feedback(current.month, 'info', `${agent.short}'s recommendation`, recommendationFor(agent, current.state)),
        });
      },

      recordStrategy: (human, agentStrategy) => {
        const current = get();
        const rawAgent = AGENTS.find((candidate) => candidate.id === current.currentAgentId) || AGENTS.filter((candidate) => candidate.month <= current.month).at(-1) || AGENTS[0];
        if (current.month < 7 || current.strategyResolvedForMonth || current.month < rawAgent.month) {
          set({ feedback: feedback(current.month, 'error', 'Strategy interaction unavailable', 'Finish the current event, meet an unlocked agent, and record one real strategy outcome this month.') });
          return;
        }
        const outcomes = matrix(current.state, humanPreferences(current.allocationHistory, current.goals), rawAgent);
        const selected = outcomes.find((outcome) => outcome.human === human && outcome.agent === agentStrategy);
        if (!selected) return;
        const nash = nashEquilibria(outcomes).some((outcome) => outcome.human === human && outcome.agent === agentStrategy);
        const pareto = paretoFrontier(outcomes).some((outcome) => outcome.human === human && outcome.agent === agentStrategy);
        const applied = applyEffect(current.state, current.scores, {
          security: Math.round(selected.allocation.security * 5),
          growth: Math.round(selected.allocation.growth * 5),
          lifestyle: Math.round(selected.allocation.lifestyle * 5),
        });
        const record: StrategyRecord = {
          id: id('strategy', current.month),
          month: current.month,
          agentId: rawAgent.id,
          human,
          agent: agentStrategy,
          allocation: selected.allocation,
          humanPayoff: selected.humanPayoff,
          agentPayoff: selected.agentPayoff,
          nash,
          pareto,
        };
        const agents = current.agents.map((candidate) =>
          candidate.id === rawAgent.id
            ? {
                ...candidate,
                unlocked: true,
                satisfaction: clamp(candidate.satisfaction + Math.round((selected.agentPayoff - 45) / 5)),
                latestRecommendation: recommendationFor(rawAgent, applied.state),
              }
            : candidate,
        );
        const strategicHistory = [...current.strategicHistory, record];
        const achievements = achievementSweep(current.achievements, current.month, applied.state, current.goals, current.learning, strategicHistory, current.allocation, current.debtEver, current.resilientEvents);
        set({
          state: applied.state,
          scores: applied.scores,
          agents,
          strategicHistory,
          achievements,
          strategyResolvedForMonth: true,
          phase: 'reflection',
          resumePhase: 'reflection',
          journal: [...current.journal, journalEntry(current.month, 'strategy', 'Strategy outcome recorded', `${STRATEGIES[human].label} × ${STRATEGIES[agentStrategy].label}: You ${selected.humanPayoff}, ${rawAgent.short} ${selected.agentPayoff}.${nash ? ' Nash equilibrium.' : ''}${pareto ? ' Pareto-efficient.' : ''}`)],
          feedback: feedback(current.month, 'success', 'Strategy recorded', nash ? 'A Nash equilibrium was found and explained with actual payoff values.' : 'The outcome was recorded; inspect the board to see who could improve by changing alone.'),
        });
      },

      finishMonth: () => {
        const current = get();
        const strategyRequired = current.month >= 7;
        if (!current.salaryProcessedForMonth || !current.allocationConfirmedForMonth || !current.eventResolvedForMonth || (strategyRequired && !current.strategyResolvedForMonth)) {
          set({ feedback: feedback(current.month, 'error', 'This month is not complete', `Required: salary ${current.salaryProcessedForMonth ? '✓' : '•'}, allocation ${current.allocationConfirmedForMonth ? '✓' : '•'}, event ${current.eventResolvedForMonth ? '✓' : '•'}${strategyRequired ? `, strategy ${current.strategyResolvedForMonth ? '✓' : '•'}` : ''}.`) });
          return;
        }
        const settled = settleDebtAndInvestments(current.state, current.seed, current.month);
        const endGoals = refreshGoals(current.goals, settled.state, current.goalFunds, current.learning);
        const endScores = recalculateScores(settled.state, current.scores, current.allocation.lifestyle, current.allocation.skills, endGoals.filter((goal) => goal.complete).length, endGoals.length);
        const monthEntries = [
          journalEntry(current.month, 'month', 'Month-end settled', `Simulated portfolio return: +${money(settled.investmentReturn)} at ${(settled.investmentRate * 100).toFixed(1)}%.`, settled.investmentReturn),
          ...(settled.debtInterest || settled.debtPayment
            ? [journalEntry(current.month, 'month', 'Debt payment processed', `Interest ${money(settled.debtInterest)} · mandatory payment ${money(settled.debtPayment)}.`, settled.debtPayment)]
            : []),
        ];
        const monthTransactions = [
          ...current.transactions,
          ...(settled.investmentReturn ? [{ id: id('return', current.month), month: current.month, type: 'return' as const, description: `Simulated portfolio return of ${money(settled.investmentReturn)}.`, amount: settled.investmentReturn, to: 'investments' }] : []),
          ...(settled.debtInterest || settled.debtPayment ? [{ id: id('debt-payment', current.month), month: current.month, type: 'debt' as const, description: `Debt interest ${money(settled.debtInterest)} and payment ${money(settled.debtPayment)} processed.`, amount: settled.debtPayment, from: 'cash', to: 'debt' }] : []),
        ];
        const snapshot: MonthlySnapshot = {
          month: current.month,
          cash: settled.state.cash,
          savings: settled.state.savings,
          investments: settled.state.investments,
          emergencyFund: settled.state.emergencyFund,
          debt: settled.state.debt,
          ...endScores,
        };
        const history = [...current.monthlyHistory, snapshot];
        const achievements = achievementSweep(current.achievements, current.month, settled.state, endGoals, current.learning, current.strategicHistory, current.allocation, current.debtEver, current.resilientEvents);

        if (current.month === 12) {
          const completed: CompletedRun = {
            id: id('run', current.month),
            completedAt: new Date().toISOString(),
            playerName: current.profile.name,
            finalState: settled.state,
            finalScores: endScores,
            completedGoals: endGoals.filter((goal) => goal.complete).length,
            totalGoals: endGoals.length,
            classification: classifyRun(current.allocationHistory),
            events: current.journal.filter((entry) => entry.kind === 'event').map((entry) => entry.title),
            history,
          };
          set({
            state: settled.state,
            scores: endScores,
            goals: endGoals,
            achievements,
            monthlyHistory: history,
            journal: [...current.journal, ...monthEntries],
            transactions: monthTransactions,
            completedRuns: [...current.completedRuns, completed].slice(-8),
            phase: 'final',
            resumePhase: 'final',
            hasActiveSession: false,
            feedback: feedback(current.month, 'success', 'Financial year complete', 'Your completed run is saved and can now be compared with another finished journey.'),
          });
          return;
        }

        const nextMonth = current.month + 1;
        let nextState = settled.state;
        let nextScores = endScores;
        let nextLearning = [...current.learning];
        let nextInventory = [...current.inventory];
        let nextJournal = [...current.journal, ...monthEntries];
        const due = current.deferredEffects.filter((item) => item.triggerMonth <= nextMonth);
        due.forEach((effect) => {
          const applied = applyEffect(nextState, nextScores, effect.effect);
          nextState = applied.state;
          nextScores = applied.scores;
          if (effect.kind === 'learning' && effect.data?.learningId) {
            nextLearning = nextLearning.map((item) => (item.id === effect.data?.learningId ? { ...item, status: 'completed' } : item));
            if (!nextInventory.some((item) => item.name === effect.data?.inventoryName)) {
              nextInventory = [...nextInventory, { id: id('learning-item', nextMonth), name: effect.data.inventoryName || effect.source, icon: effect.data.inventoryIcon || '📜', earnedMonth: nextMonth, note: `${effect.source} completed after sustained work.` }];
            }
          }
          nextJournal = [...nextJournal, journalEntry(nextMonth, effect.kind === 'learning' ? 'learning' : 'system', 'Deferred effect processed', `${effect.source}: ${effect.description}.`)];
        });
        const nextGoals = refreshGoals(endGoals, nextState, current.goalFunds, nextLearning);
        nextScores = recalculateScores(nextState, nextScores, 0, 0, nextGoals.filter((goal) => goal.complete).length, nextGoals.length);
        const nextAgents = current.agents.map((progress) => {
          const agent = AGENTS.find((candidate) => candidate.id === progress.id)!;
          return agent.month <= nextMonth ? { ...progress, unlocked: true, latestRecommendation: recommendationFor(agent, nextState) } : progress;
        });
        const nextAchievements = achievementSweep(achievements, nextMonth, nextState, nextGoals, nextLearning, current.strategicHistory, defaultAllocation(nextState.monthlyIncome), current.debtEver, current.resilientEvents);
        set({
          month: nextMonth,
          state: nextState,
          scores: nextScores,
          goals: nextGoals,
          learning: nextLearning,
          inventory: nextInventory,
          agents: nextAgents,
          achievements: nextAchievements,
          deferredEffects: current.deferredEffects.filter((item) => item.triggerMonth > nextMonth),
          monthlyHistory: history,
          journal: nextJournal,
          transactions: monthTransactions,
          allocation: defaultAllocation(nextState.monthlyIncome),
          salaryProcessedForMonth: false,
          allocationConfirmedForMonth: false,
          eventResolvedForMonth: false,
          strategyResolvedForMonth: false,
          activeEventId: undefined,
          currentLocation: 'home',
          phase: 'world',
          resumePhase: 'world',
          feedback: feedback(nextMonth, 'success', `Month ${nextMonth} begins`, due.length ? `${due.length} delayed effect${due.length > 1 ? 's' : ''} processed. Visit the Workplace for your salary.` : 'Visit the Workplace for your salary budget.'),
        });
      },

      completeMiniGame: (gameId, correct) => {
        const current = get();
        const key = `${current.month}-${gameId}`;
        if (current.minigameCompletions.includes(key)) {
          set({ feedback: feedback(current.month, 'info', 'Already rewarded', 'This month’s mini-game reward has already been claimed.') });
          return;
        }
        const earned = correct ? 30 : 10;
        const xp = current.xp + earned;
        const level = Math.floor(xp / 100) + 1;
        set({
          minigameCompletions: [...current.minigameCompletions, key],
          xp,
          level,
          journal: [...current.journal, journalEntry(current.month, 'system', 'Mini-game completed', `${gameId === 'salary-split' ? 'Salary Split' : 'Strategy Match'} awarded ${earned} XP.`)],
          feedback: feedback(current.month, 'success', 'Mini-game complete', `+${earned} XP${level > current.level ? ` · Level ${level} unlocked!` : ''}`),
        });
      },

      presentationBeat: () => {
        const current = get();
        if (current.mode !== 'presentation') return;
        if (!current.salaryProcessedForMonth) return get().processSalary();
        if (!current.allocationConfirmedForMonth) {
          get().autoBalance();
          return get().confirmAllocation();
        }
        if (!current.eventResolvedForMonth) return get().chooseEvent(0);
        if (current.month >= 7 && !current.strategyResolvedForMonth) return get().recordStrategy('BALANCED', 'BALANCED');
        get().finishMonth();
      },

      setSettings: (patch) => set((current) => ({ settings: { ...current.settings, ...patch } })),

      hydrateBackendSave: (snapshot) => {
        const current = get();
        const normalised = normaliseBackendSave(snapshot, current.settings, current.completedRuns);
        set({ ...normalised, backendStatus: 'ready', backendError: undefined });
      },

      setBackendStatus: (backendStatus, backendError) => set({ backendStatus, backendError }),

      setBackendHistory: (backendHistory) => set({ backendHistory }),

      appendBackendHistory: (entries) => set((current) => {
        const existing = new Set(current.backendHistory.map((entry) => entry.id));
        return { backendHistory: [...current.backendHistory, ...entries.filter((entry) => !existing.has(entry.id))].sort((a, b) => a.month - b.month || a.createdAt.localeCompare(b.createdAt) || a.id - b.id) };
      }),

      clearFeedback: () => set({ feedback: undefined }),
    }),
    {
      name: 'lifestrategy-session-v2',
      version: 3,
      partialize: (state) => ({
        ...gameSnapshot(state),
        phase: 'title' as Phase,
        resumePhase: state.hasActiveSession && !['title', 'setup', 'final'].includes(state.phase) ? state.phase : state.resumePhase,
      }),
      migrate: (persisted, version) => {
        const data = persisted as Partial<GameSaveData> | undefined;
        if (!data || typeof data.month !== 'number' || !data.state || !data.profile) return initialData();
        // Version 2 was the previous local-only shape. It remains readable and is
        // immediately upgraded into the versioned backend-compatible snapshot.
        return { ...normaliseBackendSave(data, DEFAULT_SETTINGS, asArray<CompletedRun>(data.completedRuns, [])), phase: 'title', saveVersion: SAVE_VERSION };
      },
    },
  ),
);
