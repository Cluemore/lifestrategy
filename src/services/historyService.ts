import type { BackendAction, JournalEntry } from '../game/types';
import { apiRequest } from './apiClient';

type ActionResponse = {
  id: number;
  player_id: string;
  game_month: number;
  action_type: string;
  action_title: string;
  action_description: string;
  amount: number | null;
  metadata?: Record<string, unknown> | null;
  client_action_id?: string | null;
  created_at: string;
};

const toAction = (response: ActionResponse): BackendAction => ({
  id: response.id,
  playerId: response.player_id,
  month: response.game_month,
  type: response.action_type,
  title: response.action_title,
  description: response.action_description,
  amount: response.amount ?? undefined,
  metadata: response.metadata || undefined,
  clientActionId: response.client_action_id || undefined,
  createdAt: response.created_at,
});

const actionTypeFor = (entry: JournalEntry) => {
  const direct: Record<JournalEntry['kind'], string> = {
    salary: 'SALARY_RECEIVED',
    allocation: 'BUDGET_ALLOCATED',
    event: 'EVENT_CHOICE',
    goal: 'GOAL_PROGRESS',
    location: 'LOCATION_ACTION',
    career: 'CAREER_OPPORTUNITY',
    learning: 'LEARNING_ACTIVITY',
    market: 'PURCHASE',
    travel: 'TRAVEL_ACTION',
    strategy: entry.title.includes('Strategy') ? 'AGENT_STRATEGY_SELECTED' : 'AGENT_INTERACTION',
    month: 'MONTH_COMPLETED',
    system: entry.title.includes('Achievement') ? 'ACHIEVEMENT_UNLOCKED' : 'SYSTEM_UPDATE',
  };
  return direct[entry.kind];
};

export const getBackendHistory = async (playerId: string) => {
  const rows = await apiRequest<ActionResponse[]>(`/history/${encodeURIComponent(playerId)}`);
  return rows.map(toAction);
};

export const recordJournalEntry = async (playerId: string, entry: JournalEntry) => {
  const response = await apiRequest<ActionResponse>('/history', {
    method: 'POST',
    body: {
      player_id: playerId,
      game_month: entry.month,
      action_type: actionTypeFor(entry),
      action_title: entry.title,
      action_description: entry.message,
      amount: entry.amount,
      metadata: { kind: entry.kind, eventId: entry.eventId, choiceText: entry.choiceText, consequence: entry.consequence },
      client_action_id: entry.id,
    },
  });
  return toAction(response);
};
