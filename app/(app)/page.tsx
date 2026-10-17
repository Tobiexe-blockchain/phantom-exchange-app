'use client';

import Link from 'next/link';
import type { Me } from '@/components/Shell';
import { DepositBadge, WithdrawalBadge } from '@/components/status';
import { Empty, Notice, PageTitle, Skeleton, Table, Td, Th } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { assetBySymbol, formatUnits } from '@/lib/assets';
import { fmtDate } from '@/lib/time';
import type { BalanceRow, DepositRow, WithdrawalRow } from '@/lib/types';

const linkBtn = 'inline-flex min-h-11 items-center justify-center rounded-md border px-4 text-base font-medium lg:text-sm';

export default function Overview() {
  const me = useApi<Me>('/api/me');
  const balances = useApi<{ assets: BalanceRow[] }>('/api/balances');
  const deposits = useApi<DepositRow[]>('/api/deposits');
  const withdrawals = useApi<WithdrawalRow[]>('/api/withdrawals');

  const hasFunds = balances.data?.assets.some((a) => BigInt(a.available) > 0n || BigInt(a.locked) > 0n);

  return (
    <div className="flex flex-col gap-8">
      <PageTitle title="Overview">Your balances and recent activity.</PageTitle>

      {me.data && !me.data.twoFactorEnabled && (
        <Notice title="Two-factor sign-in is off">
          Turn it on to protect your sign-in and your withdrawal addresses.{' '}
          <Link href="/security#twofa" className="text-fg underline underline-offset-4">
            Set up two-factor
          </Link>
        </Notice>
      )}

      <section aria-labelledby="bal-h" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="bal-h" className="text-xl font-semibold">
            Balances
          </h2>
          <div className="flex gap-2">
            <Link href="/deposit" className={`${linkBtn} border-transparent bg-accent text-on-accent hover:bg-accent-hover`}>
              Deposit
            </Link>
            <Link href="/withdraw" className={`${linkBtn} border-line hover:bg-raised`}>
              Withdraw
            </Link>
          </div>
        </div>
        {balances.loading ? (
          <Skeleton rows={3} />
        ) : balances.error ? (
          <Notice tone="error" title="Balances could not be loaded">
            {balances.error.message}
          </Notice>
        ) : (
          <>
            <Table label="Balances">
              <thead>
                <tr>
                  <Th>Asset</Th>
                  <Th right>Available</Th>
                  <Th right>On hold</Th>
                </tr>
              </thead>
              <tbody>
                {balances.data!.assets.map((a) => (
                  <tr key={a.symbol}>
                    <Td>
                      <span className="font-medium">{a.symbol}</span> <span className="text-muted">{a.name}</span>
                    </Td>
                    <Td right mono>
                      {formatUnits(a.available, a.decimals, a.shown)}
                    </Td>
                    <Td right mono className="text-muted">
                      {formatUnits(a.locked, a.decimals, a.shown)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {!hasFunds && (
              <Empty title="No funds yet">
                Deposit test funds to your address to start. Money on hold is set aside for withdrawals that are still being sent.
              </Empty>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="dep-h" className="flex flex-col gap-3">
        <h2 id="dep-h" className="text-xl font-semibold">
          Recent deposits
        </h2>
        {deposits.loading ? (
          <Skeleton rows={2} />
        ) : !deposits.data || deposits.data.length === 0 ? (
          <Empty title="No deposits yet">Deposits show up here as soon as the network sees them.</Empty>
        ) : (
          <Table label="Recent deposits">
            <thead>
              <tr>
                <Th>Time</Th>
                <Th>Asset</Th>
                <Th right>Amount</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {deposits.data.slice(0, 5).map((d) => {
                const a = assetBySymbol(d.asset);
                return (
                  <tr key={d.id}>
                    <Td className="text-muted">{fmtDate(d.createdAt)}</Td>
                    <Td>{d.asset}</Td>
                    <Td right mono>
                      {a ? formatUnits(d.amount, a.decimals, a.shown) : d.amount}
                    </Td>
                    <Td>
                      <DepositBadge status={d.status} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </section>

      <section aria-labelledby="wd-h" className="flex flex-col gap-3">
        <h2 id="wd-h" className="text-xl font-semibold">
          Recent withdrawals
        </h2>
        {withdrawals.loading ? (
          <Skeleton rows={2} />
        ) : !withdrawals.data || withdrawals.data.length === 0 ? (
          <Empty title="No withdrawals yet">Withdrawals go to addresses you have added and confirmed.</Empty>
        ) : (
          <Table label="Recent withdrawals">
            <thead>
              <tr>
                <Th>Time</Th>
                <Th>Asset</Th>
                <Th right>Amount</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.data.slice(0, 5).map((w) => {
                const a = assetBySymbol(w.asset);
                return (
                  <tr key={w.id}>
                    <Td className="text-muted">{fmtDate(w.createdAt)}</Td>
                    <Td>{w.asset}</Td>
                    <Td right mono>
                      {a ? formatUnits(w.amount, a.decimals, a.shown) : w.amount}
                    </Td>
                    <Td>
                      <WithdrawalBadge status={w.status} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}
