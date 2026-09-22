import { apiRequest } from './apiClient';

const PLAYER_ID_KEY = 'lifestrategy-player-id';

type PlayerResponse = { id: string; name: string };

export const currentPlayerId = () => {
  const existing = window.localStorage.getItem(PLAYER_ID_KEY);
  if (existing) return existing;
  const generated = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `player-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(PLAYER_ID_KEY, generated);
  return generated;
};

export const ensurePlayer = async (name: string) => {
  const playerId = currentPlayerId();
  const player = await apiRequest<PlayerResponse>('/players', { method: 'POST', body: { player_id: playerId, name: name.trim() || 'Player' } });
  return player.id;
};
