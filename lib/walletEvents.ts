import { createHmac, timingSafeEqual } from 'node:crypto';
import { assetBySymbol } from './assets';
import type { LedgerPort } from './ports';

/** The wallet signs the raw body: `x-signature: sha256=<hex hmac>`. */
export function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  let given: Buffer;
  try {
    given = Buffer.from(header.slice(7), 'hex');
  } catch {
    return false;
  }
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export interface EventResult {
  /** 2xx tells the wallet the event is handled. Anything else makes it try again. */
  status: number;
  note?: string;
}

const ack = (note?: string): EventResult => ({ status: 200, note });

/**
 * Applies a wallet event to the ledger. Every call is safe to repeat: the wallet delivers at least once.
 * Events that can never succeed (unknown asset, unknown withdrawal) are acknowledged so they stop retrying.
 */
export async function handleWalletEvent(ledger: LedgerPort, event: { type?: string; id?: string; data?: any }): Promise<EventResult> {
  const data = event.data ?? {};

  if (event.type === 'deposit.confirmed') {
    const asset = assetBySymbol(String(data.asset));
    if (!asset) return ack(`unknown asset ${data.asset}`);
    const r = await ledger.deposit({ userId: data.userId, currency: asset.ledger, amount: String(data.amount), reference: String(data.txHash), key: `deposit:${data.id}` });
    if (r.status === 200 || r.status === 201) return ack();
    return { status: 502, note: `ledger answered ${r.status}` };
  }

  if (event.type === 'withdrawal.confirmed' || event.type === 'withdrawal.failed') {
    const ledgerId = data.idempotencyKey;
    if (typeof ledgerId !== 'string') return ack('no ledger id');
    const r = await (event.type === 'withdrawal.confirmed' ? ledger.confirmWithdrawal(ledgerId) : ledger.failWithdrawal(ledgerId));
    if (r.status === 200) return ack();
    if (r.status === 404) return ack('withdrawal not known to the ledger');
    if (r.status === 409) return ack(`ledger state conflict: ${r.body?.error?.code}`); // needs a person to look at it
    return { status: 502, note: `ledger answered ${r.status}` };
  }

  return ack(`ignored ${event.type}`);
}
