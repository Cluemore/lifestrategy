import type { JournalEntry } from '../game/types';
import { apiRequest } from './apiClient';

type CompletedEventResponse = { event_id: string; game_month: number };

export const getCompletedEventKeys = async (playerId: string) => {
  const rows = await apiRequest<CompletedEventResponse[]>(`/events/completed/${encodeURIComponent(playerId)}`);
  return new Set(rows.map((row) => `${row.event_id}:${row.game_month}`));
};

export const recordCompletedEvent = (playerId: string, entry: JournalEntry) => {
  if (!entry.eventId) return Promise.resolve(null);
  return apiRequest<CompletedEventResponse>('/events/completed', {
    method: 'POST',
    body: {
      player_id: playerId,
      event_id: entry.eventId,
      event_name: entry.title,
      game_month: entry.month,
      choice_id: entry.choiceText || 'selected',
      choice_text: entry.choiceText || entry.message,
      consequence: entry.consequence,
    },
  });
};
