import type { Asset } from './assets';
import type { LedgerPort, WalletPort } from './ports';
import { definiteRejection } from './upstream';

export type WithdrawalOutcome =
  | { kind: 'ok'; ledgerId: string; withdrawal: unknown }
  | { kind: 'processing'; ledgerId: string }
  | { kind: 'rejected'; status: number; code: string; message: string };

/**
 * Starts a withdrawal across two services without ever letting money go missing or be spent twice.
 *
 *  1. The ledger locks the funds. Its withdrawal id becomes the wallet's idempotency key.
 *  2. The wallet queues the payout.
 *  3. If the wallet clearly refuses, the ledger releases the funds.
 *     If the answer is unclear (timeout, crash), the funds stay locked: releasing them could allow a double
 *     spend if the wallet did accept the request. The wallet event settles it later.
 *
 * Calling this again with the same requestId is safe at every step.
 */
export async function startWithdrawal(
  d: { ledger: LedgerPort; wallet: WalletPort },
  i: { userId: string; requestId: string; asset: Asset; amount: bigint; address: string },
): Promise<WithdrawalOutcome> {
  const held = await d.ledger.holdWithdrawal({
    userId: i.userId,
    currency: i.asset.ledger,
    amount: i.amount.toString(),
    destination: i.address,
    key: `wd:${i.userId}:${i.requestId}`,
  });

  if (held.status !== 200 && held.status !== 201) {
    const code = held.body?.error?.code as string | undefined;
    if (code === 'INSUFFICIENT_FUNDS') {
      return { kind: 'rejected', status: 422, code, message: `You do not have enough ${i.asset.symbol} available for this withdrawal.` };
    }
    if (code === 'IDEMPOTENCY_MISMATCH') {
      return { kind: 'rejected', status: 409, code, message: 'This request was already used with different details. Start a new withdrawal.' };
    }
    return { kind: 'rejected', status: 503, code: 'LEDGER_UNAVAILABLE', message: 'Balances could not be updated. Nothing was sent. Try again in a moment.' };
  }
  const ledgerId = held.body?.withdrawal?.id as string | undefined;
  if (!ledgerId) return { kind: 'rejected', status: 502, code: 'LEDGER_UNAVAILABLE', message: 'Balances could not be updated. Nothing was sent. Try again in a moment.' };

  const sent = await d.wallet.requestWithdrawal({ userId: i.userId, asset: i.asset.symbol, amount: i.amount.toString(), to: i.address, key: ledgerId });
  if (sent.status === 200 || sent.status === 201) return { kind: 'ok', ledgerId, withdrawal: sent.body?.withdrawal };

  if (definiteRejection(sent)) {
    await d.ledger.failWithdrawal(ledgerId); // give the locked funds back
    return { kind: 'rejected', status: sent.status >= 400 && sent.status < 600 ? sent.status : 502, code: sent.body.error.code, message: sent.body.error.message ?? 'The withdrawal was refused.' };
  }
  return { kind: 'processing', ledgerId };
}
