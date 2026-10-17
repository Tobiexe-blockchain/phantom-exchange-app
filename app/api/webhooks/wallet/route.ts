import { NextResponse, type NextRequest } from 'next/server';
import { config } from '@/lib/config';
import { ledgerPort } from '@/lib/ports';
import { handleWalletEvent, verifySignature } from '@/lib/walletEvents';

/** Receives signed events from the wallet service and applies them to the ledger. Not for browsers. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get('x-signature'), config().webhookSecret)) {
    return NextResponse.json({ error: { code: 'BAD_SIGNATURE', message: 'Signature check failed.' } }, { status: 401 });
  }
  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Body is not JSON.' } }, { status: 400 });
  }
  const result = await handleWalletEvent(ledgerPort(), event);
  if (result.note) console.log(`wallet event ${event?.type} ${event?.id}: ${result.note}`);
  return NextResponse.json({ ok: result.status < 300, note: result.note }, { status: result.status });
}
