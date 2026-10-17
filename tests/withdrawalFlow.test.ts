import { describe, expect, it } from 'vitest';
import { assetBySymbol } from '../lib/assets';
import type { LedgerPort, WalletPort } from '../lib/ports';
import type { UpstreamResult } from '../lib/upstream';
import { startWithdrawal } from '../lib/withdrawalFlow';

const res = (status: number, body: unknown = null, networkError = false): UpstreamResult => ({ status, body, networkError });
const err = (status: number, code: string, message = code) => res(status, { error: { code, message } });
const ETH = assetBySymbol('ETH')!;
const input = { userId: 'u1', requestId: 'r1', asset: ETH, amount: 5n, address: '0xabc' };

function fakes(over: { hold?: UpstreamResult; send?: UpstreamResult; fail?: UpstreamResult } = {}) {
  const calls: string[] = [];
  const ledger = {
    holdWithdrawal: async (p: any) => (calls.push(`hold:${p.key}:${p.currency}:${p.amount}`), over.hold ?? res(201, { withdrawal: { id: 'L1' } })),
    failWithdrawal: async (id: string) => (calls.push(`fail:${id}`), over.fail ?? res(200)),
  } as unknown as LedgerPort;
  const wallet = {
    requestWithdrawal: async (p: any) => (calls.push(`send:${p.key}:${p.asset}:${p.to}`), over.send ?? res(201, { withdrawal: { id: 'W1', status: 'queued' } })),
  } as unknown as WalletPort;
  return { ledger, wallet, calls };
}

describe('startWithdrawal', () => {
  it('locks funds in the ledger, then sends to the wallet using the ledger id as the key', async () => {
    const f = fakes();
    const out = await startWithdrawal(f, input);
    expect(out).toMatchObject({ kind: 'ok', ledgerId: 'L1' });
    expect(f.calls).toEqual(['hold:wd:u1:r1:ETH:5', 'send:L1:ETH:0xabc']);
  });

  it('stops if the user has too little, and never calls the wallet', async () => {
    const f = fakes({ hold: err(422, 'INSUFFICIENT_FUNDS') });
    const out = await startWithdrawal(f, input);
    expect(out).toMatchObject({ kind: 'rejected', status: 422, code: 'INSUFFICIENT_FUNDS' });
    expect(f.calls).toHaveLength(1);
  });

  it('stops safely when the ledger is down, without calling the wallet', async () => {
    for (const hold of [res(0, null, true), err(500, 'INTERNAL'), res(502, null)]) {
      const f = fakes({ hold });
      const out = await startWithdrawal(f, input);
      expect(out).toMatchObject({ kind: 'rejected', code: 'LEDGER_UNAVAILABLE' });
      expect(f.calls.some((c) => c.startsWith('send'))).toBe(false);
    }
  });

  it('gives the funds back when the wallet clearly refuses', async () => {
    for (const send of [err(403, 'NOT_WHITELISTED'), err(422, 'DAILY_LIMIT'), err(400, 'INVALID_ADDRESS'), err(503, 'WHITELIST_UNAVAILABLE')]) {
      const f = fakes({ send });
      const out = await startWithdrawal(f, input);
      expect(out).toMatchObject({ kind: 'rejected', code: send.body.error.code });
      expect(f.calls).toContain('fail:L1');
    }
  });

  it('keeps the funds locked when the wallet answer is unclear', async () => {
    for (const send of [res(0, null, true), err(500, 'INTERNAL'), res(502, null), res(200 + 4, null)]) {
      const f = fakes({ send });
      const out = await startWithdrawal(f, input);
      expect(out, String(send.status)).toMatchObject({ kind: 'processing', ledgerId: 'L1' });
      expect(f.calls.some((c) => c.startsWith('fail'))).toBe(false);
    }
  });

  it('accepts a replayed wallet response', async () => {
    const f = fakes({ send: res(200, { withdrawal: { id: 'W1' } }) });
    expect(await startWithdrawal(f, input)).toMatchObject({ kind: 'ok' });
  });

  it('uses a different ledger key for each user and request', async () => {
    const a = fakes();
    const b = fakes();
    await startWithdrawal(a, input);
    await startWithdrawal(b, { ...input, userId: 'u2' });
    expect(a.calls[0]).not.toBe(b.calls[0]);
  });
});
