import type { DepositRow, WithdrawalRow } from '@/lib/types';
import { Badge } from './ui';

export function DepositBadge({ status }: { status: DepositRow['status'] }) {
  if (status === 'confirmed') return <Badge tone="good">Credited</Badge>;
  if (status === 'pending') return <Badge tone="wait">Waiting for confirmations</Badge>;
  return <Badge tone="bad">Dropped by the network</Badge>;
}

export function WithdrawalBadge({ status }: { status: WithdrawalRow['status'] }) {
  if (status === 'confirmed') return <Badge tone="good">Sent</Badge>;
  if (status === 'failed') return <Badge tone="bad">Failed</Badge>;
  if (status === 'queued') return <Badge tone="wait">Queued</Badge>;
  return <Badge tone="wait">Sending</Badge>;
}
