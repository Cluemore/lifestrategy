import { useEffect, useMemo, useRef, useState } from 'react';
import { gameSnapshot, useGameStore } from '../store/gameStore';
import { getCompletedEventKeys, recordCompletedEvent } from './eventService';
import { getBackendHistory, recordJournalEntry } from './historyService';
import { ensurePlayer } from './playerService';
import { loadBackendSave, saveBackendGame } from './saveService';
import { getBackendTransactionIds, recordTransaction } from './transactionService';

const PENDING_SAVE_KEY = 'lifestrategy-pending-backend-save';

/**
 * Keeps the traditional API durable without putting fetch calls inside gameplay
 * reducers. Phaser movement never touches this because player pixel position is
 * intentionally not Zustand state; meaningful game actions are debounced here.
 */
export function useGamePersistence() {
  const game = useGameStore();
  const snapshot = useMemo(() => gameSnapshot(game), [game]);
  const serialised = useMemo(() => JSON.stringify(snapshot), [snapshot]);
  const booted = useRef(false);
  const savedSerialised = useRef<string | null>(null);
  const journalIds = useRef(new Set<string>());
  const transactionIds = useRef(new Set<string>());
  const eventKeys = useRef(new Set<string>());
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    const retry = () => setRetryTick((tick) => tick + 1);
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      const store = useGameStore.getState();
      store.setBackendStatus('loading');
      try {
        const playerId = await ensurePlayer(store.profile.name);
        const remote = await loadBackendSave(playerId);
        if (remote) useGameStore.getState().hydrateBackendSave(remote);
        const hydrated = useGameStore.getState();
        const [history, existingTransactions, existingEvents] = await Promise.all([
          getBackendHistory(playerId),
          getBackendTransactionIds(playerId),
          getCompletedEventKeys(playerId),
        ]);
        if (cancelled) return;
        journalIds.current = new Set(history.map((entry) => entry.clientActionId).filter((id): id is string => Boolean(id)));
        transactionIds.current = existingTransactions;
        eventKeys.current = existingEvents;
        savedSerialised.current = remote ? JSON.stringify(remote) : null;
        hydrated.setBackendHistory(history);
        hydrated.setBackendStatus('ready');
      } catch (error) {
        if (cancelled) return;
        useGameStore.getState().setBackendStatus('offline', error instanceof Error ? error.message : 'The save service is unavailable.');
      } finally {
        booted.current = true;
        if (!cancelled) setRetryTick((tick) => tick + 1);
      }
    };
    void bootstrap();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!booted.current || serialised === savedSerialised.current) return;
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      const current = useGameStore.getState();
      const currentSnapshot = gameSnapshot(current);
      const currentSerialised = JSON.stringify(currentSnapshot);
      try {
        current.setBackendStatus('saving');
        const playerId = await ensurePlayer(currentSnapshot.profile.name);
        await saveBackendGame(playerId, currentSnapshot);

        const missingJournal = currentSnapshot.journal.filter((entry) => !journalIds.current.has(entry.id));
        const missingTransactions = currentSnapshot.transactions.filter((entry) => !transactionIds.current.has(entry.id));
        const missingEvents = missingJournal.filter((entry) => entry.kind === 'event' && entry.eventId && !eventKeys.current.has(`${entry.eventId}:${entry.month}`));
        const [recordedHistory] = await Promise.all([
          Promise.all(missingJournal.map((entry) => recordJournalEntry(playerId, entry))),
          Promise.all(missingTransactions.map((entry) => recordTransaction(playerId, entry, currentSnapshot.state))),
          Promise.all(missingEvents.map((entry) => recordCompletedEvent(playerId, entry))),
        ]);
        if (cancelled) return;
        missingJournal.forEach((entry) => journalIds.current.add(entry.id));
        missingTransactions.forEach((entry) => transactionIds.current.add(entry.id));
        missingEvents.forEach((entry) => eventKeys.current.add(`${entry.eventId}:${entry.month}`));
        const fresh = useGameStore.getState();
        fresh.appendBackendHistory(recordedHistory);
        fresh.setBackendStatus('ready');
        savedSerialised.current = currentSerialised;
        window.localStorage.removeItem(PENDING_SAVE_KEY);
      } catch (error) {
        if (cancelled) return;
        window.localStorage.setItem(PENDING_SAVE_KEY, currentSerialised);
        useGameStore.getState().setBackendStatus('offline', error instanceof Error ? error.message : 'Save will retry when the service is available.');
        window.setTimeout(() => setRetryTick((tick) => tick + 1), 8000);
      }
    }, 650);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [retryTick, serialised]);
}
