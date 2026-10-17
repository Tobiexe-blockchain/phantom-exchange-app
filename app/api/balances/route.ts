import { ASSETS } from '@/lib/assets';
import { ledgerPort } from '@/lib/ports';
import { authed, forward } from '@/lib/session';

export const GET = authed(async ({ user }) =>
  forward(await ledgerPort().balances(user.id), (body: Record<string, { available: string; locked: string }>) => ({
    assets: ASSETS.map((a) => ({ symbol: a.symbol, name: a.name, decimals: a.decimals, shown: a.shown, available: body?.[a.ledger]?.available ?? '0', locked: body?.[a.ledger]?.locked ?? '0' })),
  })),
);
