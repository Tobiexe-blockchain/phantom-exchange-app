'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Me } from '@/components/Shell';
import { Badge, Button, CopyButton, Empty, ErrorSummary, Notice, PageTitle, Section, Skeleton, Table, Td, TextField, Th } from '@/components/ui';
import { ApiError, api, useApi } from '@/hooks/useApi';
import { fmtDate, fmtWait } from '@/lib/time';
import type { AddressRow, AuditRow } from '@/lib/types';

const EVENTS: Record<string, string> = {
  register: 'Account created',
  login_success: 'Signed in',
  login_failed: 'Failed sign-in attempt',
  login_blocked_locked: 'Sign-in blocked because the account was locked',
  login_password_ok_mfa_required: 'Password accepted, code requested',
  account_locked: 'Account locked after too many failed attempts',
  mfa_failed: 'Wrong two-factor code',
  mfa_enable_failed: 'Wrong code while turning on two-factor',
  mfa_disable_failed: 'Failed attempt to turn off two-factor',
  '2fa_enabled': 'Two-factor turned on',
  '2fa_disabled': 'Two-factor turned off',
  backup_code_used: 'Backup code used',
  refresh_reuse_detected: 'Session ended because a sign-in token was used twice',
  logout: 'Signed out',
  logout_all: 'Signed out of all devices',
  whitelist_added: 'Withdrawal address added',
  whitelist_confirmed: 'Withdrawal address confirmed',
  whitelist_removed: 'Withdrawal address removed',
  whitelist_mfa_failed: 'Wrong code while adding an address',
};

export default function SecurityPage() {
  return (
    <div className="flex flex-col gap-10">
      <PageTitle title="Security">Protect your sign-in, control where withdrawals can go, and review what happened on your account.</PageTitle>
      <TwoFactor />
      <Addresses />
      <Sessions />
      <Activity />
    </div>
  );
}

// ---------------------------------------------------------------- two-factor
function TwoFactor() {
  const me = useApi<Me>('/api/me');
  const [phase, setPhase] = useState<'idle' | 'setup' | 'codes'>('idle');
  const [setup, setSetup] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const start = () =>
    run(async () => {
      setSetup(await api('/api/security/2fa/setup', { method: 'POST' }));
      setCode('');
      setPhase('setup');
    });
  const enable = (e: React.FormEvent) => {
    e.preventDefault();
    return run(async () => {
      const res = await api<{ backupCodes: string[] }>('/api/security/2fa/enable', { method: 'POST', body: { code: code.trim() } });
      setCodes(res.backupCodes);
      setSaved(false);
      setPhase('codes');
      setCode('');
      void me.reload();
    });
  };
  const disable = (e: React.FormEvent) => {
    e.preventDefault();
    return run(async () => {
      await api('/api/security/2fa/disable', { method: 'POST', body: { password, ...(useBackup ? { backupCode: code.trim() } : { code: code.trim() }) } });
      setPassword('');
      setCode('');
      void me.reload();
    });
  };

  return (
    <Section id="twofa" title="Two-factor sign-in" description="Asks for a code from an authenticator app each time you sign in, and when you add a withdrawal address.">
      {me.loading ? (
        <Skeleton rows={2} />
      ) : phase === 'codes' ? (
        <div className="flex max-w-xl flex-col gap-4">
          <Notice tone="success" title="Two-factor is on">
            Save your backup codes now. Each one works once if you lose your phone. They are not shown again.
          </Notice>
          <ul className="num grid grid-cols-2 gap-2 rounded-md border border-line p-4" aria-label="Backup codes">
            {codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div>
            <CopyButton value={codes.join('\n')} label="Copy all backup codes" />
          </div>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="size-5" />I saved my backup codes somewhere safe
          </label>
          <Button disabled={!saved} onClick={() => setPhase('idle')} className="self-start">
            Done
          </Button>
        </div>
      ) : phase === 'setup' && setup ? (
        <form onSubmit={enable} noValidate className="flex max-w-xl flex-col gap-4">
          <ErrorSummary messages={error ? [error] : []} />
          <ol className="flex list-decimal flex-col gap-4 pl-5">
            <li>
              Scan this QR code with an authenticator app.
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={setup.qrCodeDataUrl} width={192} height={192} alt="QR code for your authenticator app" className="shrink-0 rounded-sm bg-white p-2" />
                <div className="min-w-0">
                  <p className="text-sm text-muted">Cannot scan? Enter this key by hand.</p>
                  <p className="num break-all">{setup.secret}</p>
                  <div className="mt-2">
                    <CopyButton value={setup.secret} label="Copy the setup key" />
                  </div>
                </div>
              </div>
            </li>
            <li>
              <TextField label="Enter the 6 digit code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" mono />
            </li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={busy}>
              Turn on two-factor
            </Button>
            <Button type="button" variant="secondary" onClick={() => setPhase('idle')}>
              Cancel
            </Button>
          </div>
        </form>
      ) : me.data?.twoFactorEnabled ? (
        <form onSubmit={disable} noValidate className="flex max-w-md flex-col gap-4">
          <p>
            <Badge tone="good">On</Badge>
          </p>
          <details className="rounded-md border border-line p-3">
            <summary className="flex min-h-11 items-center font-medium">Turn off two-factor</summary>
            <div className="mt-3 flex flex-col gap-4">
              <ErrorSummary messages={error ? [error] : []} />
              <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              <TextField label={useBackup ? 'Backup code' : 'Authenticator code'} value={code} onChange={(e) => setCode(e.target.value)} mono autoComplete="one-time-code" />
              <button type="button" onClick={() => setUseBackup(!useBackup)} className="min-h-11 self-start text-sm underline underline-offset-4">
                {useBackup ? 'Use my authenticator app instead' : 'Use a backup code instead'}
              </button>
              <Button type="submit" variant="danger" loading={busy} className="self-start">
                Turn off two-factor
              </Button>
            </div>
          </details>
        </form>
      ) : (
        <div className="flex max-w-xl flex-col gap-4">
          <p>
            <Badge tone="wait">Off</Badge>
          </p>
          <ErrorSummary messages={error ? [error] : []} />
          <Button onClick={start} loading={busy} className="self-start">
            Set up two-factor
          </Button>
        </div>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- addresses
function AddressStatus({ a }: { a: AddressRow }) {
  if (a.status === 'active') return <Badge tone="good">Ready to use</Badge>;
  if (a.status === 'pending_confirmation') return <Badge tone="wait">Needs email confirmation</Badge>;
  return <Badge tone="wait">Ready {fmtDate(a.activeAt)}</Badge>;
}

function Addresses() {
  const me = useApi<Me>('/api/me');
  const list = useApi<AddressRow[]>('/api/whitelist');
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const rows = (list.data ?? []).filter((a) => a.status !== 'revoked');
  const twoFactor = me.data?.twoFactorEnabled;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const entry = await api<AddressRow>('/api/whitelist', { method: 'POST', body: { network: 'ethereum', address: address.trim(), label: label.trim() || undefined, code: code.trim() || undefined } });
      const wait = fmtWait(new Date(entry.activeAt).getTime() - new Date(entry.createdAt).getTime());
      setNotice(`Address added. We sent a confirmation code to your email. Enter it below. After that, the address can be used once ${wait} have passed since you added it.`);
      setAddress('');
      setLabel('');
      setCode('');
      void list.reload();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await api('/api/whitelist/confirm', { method: 'POST', body: { token: token.trim() } });
      setToken('');
      setNotice('Address confirmed.');
      void list.reload();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await api(`/api/whitelist/${id}`, { method: 'DELETE' });
      setRemoving(null);
      void list.reload();
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  return (
    <Section id="addresses" title="Withdrawal addresses" description="Withdrawals can only go to addresses on this list. A new address needs an email confirmation and a waiting period, so someone who gets into your account cannot send your funds away at once. Removing an address takes effect immediately.">
      <ErrorSummary messages={error ? [error] : []} />
      {notice && <Notice tone="success">{notice}</Notice>}

      {list.loading ? (
        <Skeleton rows={3} />
      ) : rows.length === 0 ? (
        <Empty title="No addresses yet">Add the address you want to withdraw to.</Empty>
      ) : (
        <Table label="Withdrawal addresses">
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Address</Th>
              <Th>Status</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <Td>{a.label ?? <span className="text-muted">No name</span>}</Td>
                <Td mono className="max-w-[18rem] break-all">
                  {a.address}
                </Td>
                <Td>
                  <AddressStatus a={a} />
                </Td>
                <Td right>
                  {removing === a.id ? (
                    <span className="inline-flex gap-2">
                      <Button type="button" variant="danger" onClick={() => remove(a.id)}>
                        Remove
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => setRemoving(null)}>
                        Keep
                      </Button>
                    </span>
                  ) : (
                    <Button type="button" variant="secondary" aria-label={`Remove address ${a.label ?? a.address}`} onClick={() => setRemoving(a.id)}>
                      Remove
                    </Button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <form onSubmit={add} noValidate className="flex flex-col gap-4">
          <h3 className="text-base font-semibold">Add an address</h3>
          <p className="text-sm text-muted">Ethereum test network. Check every character: a wrong address cannot be recovered.</p>
          <TextField label="Address" value={address} onChange={(e) => setAddress(e.target.value)} mono autoComplete="off" spellCheck={false} />
          <TextField label="Name (optional)" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} />
          {twoFactor && <TextField label="Authenticator code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" mono hint="Needed because two-factor is on." />}
          <Button type="submit" loading={busy} className="self-start">
            Add address
          </Button>
        </form>

        <form onSubmit={confirm} noValidate className="flex flex-col gap-4">
          <h3 className="text-base font-semibold">Confirm an address</h3>
          <p className="text-sm text-muted">Paste the confirmation code from the email we sent when you added the address.</p>
          <TextField label="Confirmation code" value={token} onChange={(e) => setToken(e.target.value)} mono autoComplete="off" spellCheck={false} />
          <Button type="submit" variant="secondary" loading={busy} className="self-start">
            Confirm address
          </Button>
        </form>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------- sessions and activity
function Sessions() {
  const router = useRouter();
  const [sure, setSure] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function out() {
    try {
      await api('/api/auth/logout-all', { method: 'POST' });
      router.replace('/login');
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  return (
    <Section id="sessions" title="Sessions" description="If you think someone else has used your account, sign out everywhere. Every device will need to sign in again.">
      <ErrorSummary messages={error ? [error] : []} />
      {sure ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="danger" onClick={out}>
            Sign out of all devices
          </Button>
          <Button variant="secondary" onClick={() => setSure(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setSure(true)} className="self-start">
          Sign out of all devices
        </Button>
      )}
    </Section>
  );
}

function Activity() {
  const audit = useApi<AuditRow[]>('/api/audit');
  return (
    <Section id="activity" title="Recent activity" description="The latest security events on your account. If something here is not you, sign out of all devices and change your password.">
      {audit.loading ? (
        <Skeleton rows={4} />
      ) : audit.error ? (
        <Notice tone="error" title="Activity could not be loaded">
          {audit.error.message}
        </Notice>
      ) : !audit.data || audit.data.length === 0 ? (
        <Empty title="Nothing yet">Security events appear here.</Empty>
      ) : (
        <Table label="Recent account activity">
          <thead>
            <tr>
              <Th>Time</Th>
              <Th>Event</Th>
              <Th>IP address</Th>
            </tr>
          </thead>
          <tbody>
            {audit.data.map((e) => (
              <tr key={e.id}>
                <Td className="whitespace-nowrap text-muted">{fmtDate(e.createdAt)}</Td>
                <Td>{EVENTS[e.event] ?? e.event.replace(/_/g, ' ')}</Td>
                <Td mono className="text-muted">
                  {e.ip ?? ''}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Section>
  );
}
