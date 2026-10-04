import type { FinancialState, Transaction } from '../game/types';
import { apiRequest } from './apiClient';

type TransactionResponse = { id: number; client_transaction_id?: string | null };

export const getBackendTransactionIds = async (playerId: string) => {
  const rows = await apiRequest<TransactionResponse[]>(`/transactions/${encodeURIComponent(playerId)}`);
  return new Set(rows.map((row) => row.client_transaction_id).filter((id): id is string => Boolean(id)));
};

const balanceAfter = (transaction: Transaction, state: FinancialState) => {
  if (transaction.to === 'savings' || transaction.from === 'savings') return state.savings;
  if (transaction.to === 'emergencyFund' || transaction.from === 'emergencyFund') return state.emergencyFund;
  if (transaction.to === 'investments' || transaction.type === 'investment' || transaction.type === 'return') return state.investments;
  if (transaction.to === 'debt' || transaction.type === 'debt') return state.debt;
  return state.cash;
};

export const recordTransaction = (playerId: string, transaction: Transaction, state: FinancialState) => apiRequest<TransactionResponse>('/transactions', {
  method: 'POST',
  body: {
    player_id: playerId,
    game_month: transaction.month,
    transaction_type: transaction.type,
    category: transaction.to || transaction.from || transaction.type,
    amount: transaction.amount,
    balance_after: balanceAfter(transaction, state),
    description: transaction.description,
    client_transaction_id: transaction.id,
  },
});
