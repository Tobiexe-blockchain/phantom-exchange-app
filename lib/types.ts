export interface BalanceRow {
  symbol: string;
  name: string;
  decimals: number;
  shown: number;
  available: string;
  locked: string;
}
export interface DepositRow {
  id: string;
  asset: string;
  amount: string;
  address: string;
  txHash: string;
  blockNumber: number;
  status: 'pending' | 'confirmed' | 'orphaned';
  createdAt: string;
}
export interface WithdrawalRow {
  id: string;
  idempotencyKey: string;
  asset: string;
  amount: string;
  to: string;
  status: 'queued' | 'broadcasting' | 'broadcast' | 'confirmed' | 'failed';
  txHash: string | null;
  error: string | null;
  createdAt: string;
}
export interface AddressRow {
  id: string;
  network: string;
  address: string;
  label: string | null;
  status: 'pending_confirmation' | 'cooling_down' | 'active' | 'revoked';
  createdAt: string;
  activeAt: string;
  confirmedAt: string | null;
}
export interface AuditRow {
  id: number;
  event: string;
  ip: string | null;
  createdAt: string;
}
