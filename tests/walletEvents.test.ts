import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { LedgerPort } from '../lib/ports';
import type { UpstreamResult } from '../lib/upstream';
import { handleWalletEvent, verifySignature } from '../lib/walletEvents';

const res = (status: number, body: unknown = null): UpstreamResult => ({ status, body, networkError: status === 0 });
const sign = (body: string, secret: string) => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

describe('verifySignature', () => {
  const body = '{"type":"deposit.confirmed"}';
  it('accepts a correct signature', () => expect(verifySignature(body, sign(body, 'secret-secret-1234'), 'secret-secret-1234')).toBe(true));
  it('rejects wrong secrets, changed bodies, and malformed headers', () => {
    expect(verifySignature(body, sign(body, 'other-secret-12345'), 'secret-secret-1234')).toBe(false);
    expect(verifySignature(body + ' ', sign(body, 'secret-secret-1234'), 'secret-secret-1234')).toBe(false);
    for (const h of [null, '', 'sha256=', 'sha256=zz', 'sha1=abcd', sign(body, 'secret-secret-1234').slice(7)]) {
      expect(verifySignature(body, h, 'secret-secret-1234'), String(h)).toBe(false);
    }
  });
});

function ledger(over: Partial<Record<'deposit' | 'confirm' | 'fail', UpstreamResult>> = {}) {
  const calls: string[] = [];
  const port = {
    deposit: async (p: any) => (calls.push(`deposit:${p.key}:${p.userId}:${p.currency}:${p.amount}:${p.reference}`), over.deposit ?? res(201)),
    confirmWithdrawal: async (id: string) => (calls.push(`confirm:${id}`), over.confirm ?? res(200)),
    failWithdrawal: async (id: string) => (calls.push(`fail:${id}`), over.fail ?? res(200)),
  } as unknown as LedgerPort;
  return { port, calls };
}

describe('handleWalletEvent', () => {
  const deposit = { type: 'deposit.confirmed', id: 'D1', data: { id: 'D1', userId: 'u1', asset: 'tUSD', amount: '5000000', txHash: '0xabc' } };

  it('credits a confirmed deposit using the event id as the idempotency key, with the ledger currency name', async () => {
    const l = ledger();
    expect(await handleWalletEvent(l.port, deposit)).toMatchObject({ status: 200 });
    expect(l.calls).toEqual(['deposit:deposit:D1:u1:TUSD:5000000:0xabc']);
  });

  it('asks the wallet to retry when the ledger fails, and accepts replays', async () => {
    for (const r of [res(0), res(500), res(503)]) expect((await handleWalletEvent(ledger({ deposit: r }).port, deposit)).status).toBe(502);
    expect((await handleWalletEvent(ledger({ deposit: res(200) }).port, deposit)).status).toBe(200); // replayed
  });

  it('acknowledges deposits of assets it does not know, so they stop retrying', async () => {
    const l = ledger();
    const out = await handleWalletEvent(l.port, { ...deposit, data: { ...deposit.data, asset: 'DOGE' } });
    expect(out.status).toBe(200);
    expect(l.calls).toHaveLength(0);
  });

  it('confirms and fails the ledger withdrawal named by the idempotency key', async () => {
    const l = ledger();
    await handleWalletEvent(l.port, { type: 'withdrawal.confirmed', data: { idempotencyKey: 'L1' } });
    await handleWalletEvent(l.port, { type: 'withdrawal.failed', data: { idempotencyKey: 'L2' } });
    expect(l.calls).toEqual(['confirm:L1', 'fail:L2']);
  });

  it('retries on ledger outages but acknowledges unknown or conflicting withdrawals', async () => {
    const ev = { type: 'withdrawal.confirmed', data: { idempotencyKey: 'L1' } };
    expect((await handleWalletEvent(ledger({ confirm: res(500) }).port, ev)).status).toBe(502);
    expect((await handleWalletEvent(ledger({ confirm: res(0) }).port, ev)).status).toBe(502);
    expect((await handleWalletEvent(ledger({ confirm: res(404) }).port, ev)).status).toBe(200);
    expect((await handleWalletEvent(ledger({ confirm: res(409, { error: { code: 'INVALID_STATE' } }) }).port, ev)).status).toBe(200);
  });

  it('ignores events it does not understand', async () => {
    const l = ledger();
    expect((await handleWalletEvent(l.port, { type: 'something.else' })).status).toBe(200);
    expect((await handleWalletEvent(l.port, { type: 'withdrawal.confirmed', data: {} })).status).toBe(200);
    expect(l.calls).toHaveLength(0);
  });
});
