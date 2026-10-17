import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AmountError, assetBySymbol, parseUnits } from '@/lib/assets';
import { ledgerPort, walletPort } from '@/lib/ports';
import { authCall, authed, errorJson, forward } from '@/lib/session';
import { startWithdrawal } from '@/lib/withdrawalFlow';

const body = z.object({ requestId: z.string().uuid(), asset: z.string().min(2).max(10), amount: z.string().min(1).max(40), addressId: z.string().uuid() });

export const GET = authed(async ({ user }) => forward(await walletPort().withdrawals(user.id)));

export const POST = authed(async ({ user, token, req }) => {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorJson(400, 'VALIDATION_ERROR', 'Choose an asset, an address, and an amount.');
  const asset = assetBySymbol(parsed.data.asset);
  if (!asset) return errorJson(400, 'UNKNOWN_ASSET', 'That asset is not supported.');

  let amount: bigint;
  try {
    amount = parseUnits(parsed.data.amount, asset.decimals);
  } catch (err) {
    if (err instanceof AmountError) return errorJson(400, 'INVALID_AMOUNT', err.message);
    throw err;
  }

  // The address comes from the user's own whitelist on the server, never from the browser.
  const list = await authCall('/whitelist', { token });
  if (list.status !== 200) return forward(list);
  const entry = (list.body as { id: string; address: string; status: string }[]).find((e) => e.id === parsed.data.addressId);
  if (!entry) return errorJson(400, 'ADDRESS_NOT_FOUND', 'That address is not on your list.');
  if (entry.status !== 'active') {
    const why = entry.status === 'pending_confirmation' ? 'It still needs its email confirmation.' : 'It is still in its waiting period.';
    return errorJson(400, 'ADDRESS_NOT_READY', `You cannot withdraw to this address yet. ${why}`);
  }

  const out = await startWithdrawal({ ledger: ledgerPort(), wallet: walletPort() }, { userId: user.id, requestId: parsed.data.requestId, asset, amount, address: entry.address });
  if (out.kind === 'ok') return NextResponse.json({ status: 'queued', ledgerId: out.ledgerId, withdrawal: out.withdrawal }, { status: 201 });
  if (out.kind === 'processing') {
    return NextResponse.json({ status: 'processing', ledgerId: out.ledgerId, message: 'We could not confirm the withdrawal yet. Your funds are held and it will update here shortly.' }, { status: 202 });
  }
  return errorJson(out.status, out.code, out.message);
});
