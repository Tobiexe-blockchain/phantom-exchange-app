'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { WithdrawalBadge } from '@/components/status';
import { Button, Empty, ErrorSummary, Notice, PageTitle, SelectField, Skeleton, Table, Td, TextField, Th } from '@/components/ui';
import { ApiError, api, useApi } from '@/hooks/useApi';
import { ASSETS, AmountError, assetBySymbol, formatUnits, parseUnits } from '@/lib/assets';
import { fmtDate } from '@/lib/time';
import type { AddressRow, BalanceRow, WithdrawalRow } from '@/lib/types';

export default function WithdrawPage() {
  const balances = useApi<{ assets: BalanceRow[] }>('/api/balances');
  const addresses = useApi<AddressRow[]>('/api/whitelist');
  const history = useApi<WithdrawalRow[]>('/api/withdrawals');

  const [symbol, setSymbol] = useState(ASSETS[0].symbol);
  const [addressId, setAddressId] = useState('');
  const [amount, setAmount] = useState('');
  const [touched, setTouched] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ tone: 'success' | 'info'; text: string } | null>(null);

  const asset = assetBySymbol(symbol)!;
  const ready = (addresses.data ?? []).filter((a) => a.status === 'active');
  const waiting = (addresses.data ?? []).filter((a) => a.status === 'pending_confirmation' || a.status === 'cooling_down');
  const balance = balances.data?.assets.find((b) => b.symbol === symbol);

  useEffect(() => {
    if (!addressId && ready.length > 0) setAddressId(ready[0].id);
  }, [addressId, ready]);

  // A new attempt with different details gets a new id, so the server never mistakes it for a repeat.
  const touchRequest = () => setRequestId(crypto.randomUUID());

  let amountError: string | undefined;
  let parsed: bigint | null = null;
  if (touched) {
    try {
      parsed = parseUnits(amount, asset.decimals);
      if (balance && parsed > BigInt(balance.available)) amountError = `You have ${formatUnits(balance.available, asset.decimals, asset.shown)} ${symbol} available. Lower the amount.`;
    } catch (e) {
      amountError = e instanceof AmountError ? e.message : 'Enter a valid amount.';
    }
  }
  const addressError = touched && !addressId ? 'Choose an address to send to.' : undefined;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    setResult(null);
    let value: bigint;
    try {
      value = parseUnits(amount, asset.decimals);
    } catch {
      return;
    }
    if (!addressId || (balance && value > BigInt(balance.available))) return;

    setBusy(true);
    try {
      const res = await api<{ status: string; message?: string }>('/api/withdrawals', { method: 'POST', body: { requestId, asset: symbol, amount: amount.trim(), addressId } });
      setResult(
        res.status === 'processing'
          ? { tone: 'info', text: res.message ?? 'Your withdrawal is being processed.' }
          : { tone: 'success', text: `Withdrawal of ${amount.trim()} ${symbol} queued. It was taken from your available balance and will be sent shortly.` },
      );
      setAmount('');
      setTouched(false);
      setRequestId(crypto.randomUUID());
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
      void balances.reload();
      void history.reload();
    }
  }

  // Follow a withdrawal that is still being sent.
  const moving = history.data?.some((w) => w.status === 'queued' || w.status === 'broadcasting' || w.status === 'broadcast');
  useEffect(() => {
    if (!moving) return;
    const t = setInterval(() => {
      void history.reload();
      void balances.reload();
    }, 5000);
    return () => clearInterval(t);
  }, [moving, history, balances]);

  const loading = balances.loading || addresses.loading;

  return (
    <div className="flex flex-col gap-8">
      <PageTitle title="Withdraw">Send funds to one of your saved addresses. New addresses need an email confirmation and a waiting period before first use.</PageTitle>

      {loading ? (
        <Skeleton rows={5} />
      ) : addresses.error ? (
        <Notice tone="error" title="Your addresses could not be loaded">
          {addresses.error.message}
        </Notice>
      ) : ready.length === 0 ? (
        <Empty
          title="Add a withdrawal address first"
          action={
            <Link href="/security#addresses" className="inline-flex min-h-11 items-center justify-center rounded-md border border-transparent bg-accent px-4 text-base font-medium text-on-accent hover:bg-accent-hover lg:text-sm">
              Add an address
            </Link>
          }
        >
          {waiting.length > 0
            ? `You have ${waiting.length} address${waiting.length === 1 ? '' : 'es'} that cannot be used yet. Each needs its email confirmation and then a waiting period.`
            : 'You can only withdraw to addresses you have saved and confirmed. This keeps your funds safe if someone gets into your account.'}
        </Empty>
      ) : (
        <form onSubmit={submit} noValidate className="flex max-w-xl flex-col gap-4">
          <ErrorSummary messages={[amountError, addressError, error].filter(Boolean) as string[]} />
          {result && <Notice tone={result.tone} title={result.tone === 'success' ? 'Withdrawal started' : 'Withdrawal pending'}>{result.text}</Notice>}

          <SelectField
            label="Asset"
            value={symbol}
            onChange={(e) => {
              setSymbol(e.target.value);
              setAmount('');
              touchRequest();
            }}
          >
            {ASSETS.map((a) => (
              <option key={a.symbol} value={a.symbol}>
                {a.symbol} ({a.name})
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Send to"
            value={addressId}
            error={addressError}
            onChange={(e) => {
              setAddressId(e.target.value);
              touchRequest();
            }}
            hint="Only addresses that have finished their waiting period are listed."
          >
            {ready.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label ? `${a.label} (${a.address.slice(0, 8)}...${a.address.slice(-6)})` : a.address}
              </option>
            ))}
          </SelectField>
          {addressId && <p className="num break-all text-sm text-muted">{ready.find((a) => a.id === addressId)?.address}</p>}

          <div className="flex flex-col gap-2">
            <TextField
              label={`Amount (${symbol})`}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                touchRequest();
              }}
              onBlur={() => setTouched(true)}
              inputMode="decimal"
              autoComplete="off"
              mono
              error={amountError}
              hint={balance ? `Available: ${formatUnits(balance.available, asset.decimals, asset.shown)} ${symbol}` : undefined}
            />
            {balance && BigInt(balance.available) > 0n && (
              <Button
                type="button"
                variant="secondary"
                className="self-start"
                onClick={() => {
                  setAmount(formatUnits(balance.available, asset.decimals, asset.decimals).replace(/,/g, '').replace(/\.?0+$/, ''));
                  setTouched(true);
                  touchRequest();
                }}
              >
                Use the full amount
              </Button>
            )}
          </div>

          <Button type="submit" loading={busy}>
            Withdraw {symbol}
          </Button>
        </form>
      )}

      <section aria-labelledby="wh-h" className="flex flex-col gap-3">
        <h2 id="wh-h" className="text-xl font-semibold">
          Withdrawal history
        </h2>
        {history.loading ? (
          <Skeleton rows={3} />
        ) : history.error ? (
          <Notice tone="error" title="History could not be loaded">
            {history.error.message}
          </Notice>
        ) : !history.data || history.data.length === 0 ? (
          <Empty title="No withdrawals yet">Withdrawals appear here with their progress.</Empty>
        ) : (
          <Table label="Withdrawal history">
            <thead>
              <tr>
                <Th>Time</Th>
                <Th>Asset</Th>
                <Th right>Amount</Th>
                <Th>To</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {history.data.map((w) => {
                const a = assetBySymbol(w.asset);
                return (
                  <tr key={w.id}>
                    <Td className="text-muted">{fmtDate(w.createdAt)}</Td>
                    <Td>{w.asset}</Td>
                    <Td right mono>
                      {a ? formatUnits(w.amount, a.decimals, a.decimals) : w.amount}
                    </Td>
                    <Td mono className="max-w-[14rem] break-all text-muted">
                      {w.to}
                    </Td>
                    <Td>
                      <div className="flex flex-col items-start gap-1">
                        <WithdrawalBadge status={w.status} />
                        {w.status === 'failed' && w.error && <span className="text-xs text-muted">{w.error} The amount returns to your balance.</span>}
                      </div>
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
