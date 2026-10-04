export type StrategyId = 'SECURITY' | 'GROWTH' | 'LIFESTYLE' | 'BALANCED';

export type LocationId =
  | 'home'
  | 'workplace'
  | 'bank'
  | 'investments'
  | 'learning'
  | 'market'
  | 'cafe'
  | 'travel'
  | 'strategy';

export type Phase = 'title' | 'setup' | 'world' | 'allocation' | 'event' | 'reflection' | 'strategy' | 'final';

export type Allocation = {
  needs: number;
  savings: number;
  investments: number;
  emergency: number;
  lifestyle: number;
  skills: number;
};

export type StrategyVector = {
  security: number;
  savings: number;
  growth: number;
  lifestyle: number;
};

export type FinancialState = {
  cash: number;
  savings: number;
  emergencyFund: number;
  investments: number;
  debt: number;
  monthlyIncome: number;
  essentialExpenses: number;
  salaryMultiplier: number;
  skillFund: number;
};

export type Scores = {
  wealth: number;
  security: number;
  lifestyle: number;
  growth: number;
  goals: number;
};

export type Profile = {
  name: string;
  age: number;
  occupation: string;
  appearance: number;
  living: string;
  scenario: 'starter' | 'steady' | 'career';
};

export type Goal = {
  id: string;
  name: string;
  icon: string;
  target: number;
  progress: number;
  deadline: number;
  category: string;
  complete?: boolean;
};

export type Effect = Partial<{
  cash: number;
  savings: number;
  emergencyFund: number;
  investments: number;
  debt: number;
  monthlyIncome: number;
  skillFund: number;
  wealth: number;
  security: number;
  lifestyle: number;
  growth: number;
  goals: number;
}>;

export type EventChoice = {
  label: string;
  hint: string;
  effect: Effect;
  delayed?: { dueIn: number; label: string; effect: Effect };
};

export type LifeEvent = {
  id: string;
  title: string;
  icon: string;
  story: string;
  type: 'problem' | 'opportunity' | 'positive';
  cost?: number;
  choices: EventChoice[];
  minMonth?: number;
};

export type JournalEntry = {
  id: string;
  month: number;
  kind: 'salary' | 'allocation' | 'event' | 'goal' | 'location' | 'career' | 'learning' | 'market' | 'travel' | 'strategy' | 'month' | 'system';
  title: string;
  message: string;
  amount?: number;
  eventId?: string;
  choiceText?: string;
  consequence?: Record<string, unknown>;
};

/** A durable chronological record returned by the FastAPI history endpoint. */
export type BackendAction = {
  id: number;
  playerId: string;
  month: number;
  type: string;
  title: string;
  description: string;
  amount?: number;
  metadata?: Record<string, unknown>;
  clientActionId?: string;
  createdAt: string;
};

export type DeferredEffect = {
  id: string;
  triggerMonth: number;
  source: string;
  description: string;
  effect: Effect;
  kind?: 'effect' | 'learning';
  data?: { learningId?: string; inventoryName?: string; inventoryIcon?: string };
};

export type Transaction = {
  id: string;
  month: number;
  type: 'transfer' | 'investment' | 'withdrawal' | 'purchase' | 'goal' | 'debt' | 'return' | 'learning' | 'travel';
  description: string;
  amount: number;
  from?: string;
  to?: string;
};

export type SalaryRecord = {
  month: number;
  base: number;
  bonus: number;
  deductions: number;
  paid: number;
};

export type LearningEnrollment = {
  id: string;
  name: string;
  icon: string;
  cost: number;
  startedMonth: number;
  completionMonth: number;
  growth: number;
  salaryBoost?: number;
  status: 'active' | 'completed';
};

export type InventoryItem = {
  id: string;
  name: string;
  icon: string;
  earnedMonth: number;
  note: string;
};

export type AchievementUnlock = {
  id: string;
  unlockedMonth: number;
};

export type AgentProgress = {
  id: string;
  unlocked: boolean;
  satisfaction: number;
  interactions: number;
  latestRecommendation: string;
};

export type StrategyRecord = {
  id: string;
  month: number;
  agentId: string;
  human: StrategyId;
  agent: StrategyId;
  allocation: StrategyVector;
  humanPayoff: number;
  agentPayoff: number;
  nash: boolean;
  pareto: boolean;
};

export type MonthlySnapshot = {
  month: number;
  cash: number;
  savings: number;
  investments: number;
  emergencyFund: number;
  debt: number;
  wealth: number;
  security: number;
  lifestyle: number;
  growth: number;
  goals: number;
};

export type GameSettings = {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  reducedMotion: boolean;
  textSize: 'standard' | 'large';
  musicPlaying: boolean;
  musicTrack: number;
};

export type CompletedRun = {
  id: string;
  completedAt: string;
  playerName: string;
  finalState: FinancialState;
  finalScores: Scores;
  completedGoals: number;
  totalGoals: number;
  classification: string;
  events: string[];
  history: MonthlySnapshot[];
};
