import { config } from './config';
import { upstream, type UpstreamResult } from './upstream';

export interface LedgerPort {
  holdWithdrawal(p: { userId: string; currency: string; amount: string; destination: string; key: string }): Promise<UpstreamResult>;
  confirmWithdrawal(id: string): Promise<UpstreamResult>;
  failWithdrawal(id: string): Promise<UpstreamResult>;
  deposit(p: { userId: string; currency: string; amount: string; reference: string; key: string }): Promise<UpstreamResult>;
  balances(userId: string): Promise<UpstreamResult>;
}

export interface WalletPort {
  requestWithdrawal(p: { userId: string; asset: string; amount: string; to: string; key: string }): Promise<UpstreamResult>;
  address(userId: string): Promise<UpstreamResult>;
  deposits(userId: string): Promise<UpstreamResult>;
  withdrawals(userId: string): Promise<UpstreamResult>;
}

export function ledgerPort(): LedgerPort {
  const base = config().ledgerUrl;
  const post = (path: string, body: unknown, key?: string) => upstream(base, path, { method: 'POST', body, headers: key ? { 'idempotency-key': key } : {} });
  return {
    holdWithdrawal: (p) => post('/withdrawals', { userId: p.userId, currency: p.currency, amount: p.amount, destination: p.destination }, p.key),
    confirmWithdrawal: (id) => post(`/withdrawals/${encodeURIComponent(id)}/confirm`, {}),
    failWithdrawal: (id) => post(`/withdrawals/${encodeURIComponent(id)}/fail`, {}),
    deposit: (p) => post('/deposits', { userId: p.userId, currency: p.currency, amount: p.amount, reference: p.reference }, p.key),
    balances: (userId) => upstream(base, `/balances/${encodeURIComponent(userId)}`),
  };
}

export function walletPort(): WalletPort {
  const c = config();
  const headers = { 'x-api-key': c.walletApiKey };
  return {
    requestWithdrawal: (p) => upstream(c.walletUrl, '/withdrawals', { method: 'POST', headers: { ...headers, 'idempotency-key': p.key }, body: { userId: p.userId, asset: p.asset, amount: p.amount, to: p.to } }),
    address: (userId) => upstream(c.walletUrl, '/addresses', { method: 'POST', headers, body: { userId } }),
    deposits: (userId) => upstream(c.walletUrl, `/deposits?userId=${encodeURIComponent(userId)}`, { headers }),
    withdrawals: (userId) => upstream(c.walletUrl, `/withdrawals?userId=${encodeURIComponent(userId)}`, { headers }),
  };
}
