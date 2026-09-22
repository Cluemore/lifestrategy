import type { GameSaveData } from '../store/gameStore';
import { ApiError, apiRequest } from './apiClient';

type SaveResponse = { state: unknown; updated_at: string };

export const loadBackendSave = async (playerId: string): Promise<GameSaveData | null> => {
  try {
    const response = await apiRequest<SaveResponse>(`/save/${encodeURIComponent(playerId)}`);
    return response.state as GameSaveData;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
};

export const saveBackendGame = (playerId: string, state: GameSaveData) => apiRequest<SaveResponse>('/save', {
  method: 'POST',
  body: { player_id: playerId, save_version: state.saveVersion, state },
});

export const deleteBackendSave = (playerId: string) => apiRequest<void>(`/save/${encodeURIComponent(playerId)}`, { method: 'DELETE' });
