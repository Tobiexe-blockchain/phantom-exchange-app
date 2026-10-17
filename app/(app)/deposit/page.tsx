'use client';

import { useState } from 'react';
import { DepositBadge } from '@/components/status';
import { CopyButton, Empty, Notice, PageTitle, SelectField, Skeleton, Table, Td, Th } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { ASSETS, assetBySymbol, formatUnits } from '@/lib/assets';
import { fmtDate } from '@/lib/time';
import type { DepositRow } from '@/lib/types';

export default function DepositPage() {
  const [symbol, setSymbol] = useState(ASSETS[0].symbol);
  const addr = useApi<{ address: string; qr: string }>('/api/deposit-address');
  const deposits = useApi<DepositRow[]>('/api/deposits');
  const asset = assetBySymbol(symbol)!;

  return (
    <div className="flex flex-col gap-8">
      <PageTitle title="Deposit">Send funds to your personal address. They are credited to your balance after the network confirms them.</PageTitle>

      <section aria-labelledby="addr-h" className="flex flex-col gap-4">
        <h2 id="addr-h" className="text-xl font-semibold">
          Your deposit address
        </h2>
        <SelectField label="Asset" value={symbol} onChange={(e) => setSymbol(e.target.value)} className="max-w-xs" hint="The address is the same for every asset on this network.">
          {ASSETS.map((a) => (
            <option key={a.symbol} value={a.symbol}>
              {a.symbol} ({a.name})
            </option>
          ))}
        </SelectField>

        {addr.loading ? (
          <Skeleton rows={4} />
        ) : addr.error ? (
          <Notice tone="error" title="Your address could not be loaded">
            {addr.error.message}
          </Notice>
        ) : (
          <div className="flex flex-col gap-4 rounded-md border border-line p-4 sm:flex-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={addr.data!.qr} width={192} height={192} alt={`QR code for your ${symbol} deposit address`} className="shrink-0 rounded-sm bg-white p-2" />
            <div className="flex min-w-0 flex-col gap-3">
              <div>
                <p className="text-sm text-muted">Address</p>
                <p className="num break-all text-base">{addr.data!.address}</p>
              </div>
              <div>
                <CopyButton value={addr.data!.address} label={`Copy your ${symbol} deposit address`} />
              </div>
            </div>
          </div>
        )}

        <Notice title={`Send only ${asset.symbol} on the test network`}>
          Funds sent on a different network or in a different asset can be lost for good. Do not send real money to this address.
        </Notice>
      </section>

      <section aria-labelledby="hist-h" className="flex flex-col gap-3">
        <h2 id="hist-h" className="text-xl font-semibold">
          Deposit history
        </h2>
        {deposits.loading ? (
          <Skeleton rows={3} />
        ) : deposits.error ? (
          <Notice tone="error" title="History could not be loaded">
            {deposits.error.message}
          </Notice>
        ) : !deposits.data || deposits.data.length === 0 ? (
          <Empty title="No deposits yet">After you send funds, the deposit appears here while it waits for confirmations.</Empty>
        ) : (
          <Table label="Deposit history">
            <thead>
              <tr>
                <Th>Time</Th>
                <Th>Asset</Th>
                <Th right>Amount</Th>
                <Th>Status</Th>
                <Th>Transaction</Th>
              </tr>
            </thead>
            <tbody>
              {deposits.data.map((d) => {
                const a = assetBySymbol(d.asset);
                return (
                  <tr key={d.id}>
                    <Td className="text-muted">{fmtDate(d.createdAt)}</Td>
                    <Td>{d.asset}</Td>
                    <Td right mono>
                      {a ? formatUnits(d.amount, a.decimals, a.decimals) : d.amount}
                    </Td>
                    <Td>
                      <DepositBadge status={d.status} />
                    </Td>
                    <Td mono className="max-w-[16rem] break-all text-muted">
                      {d.txHash}
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
