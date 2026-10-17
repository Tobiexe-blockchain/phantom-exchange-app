'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, api } from '@/hooks/useApi';
import { Button, ErrorSummary, TextField } from '@/components/ui';

function explain(err: ApiError): string {
  const wait = (err.details as { retryAfterSec?: number } | undefined)?.retryAfterSec;
  if ((err.code === 'ACCOUNT_LOCKED' || err.code === 'RATE_LIMITED') && wait) return `Too many attempts. Try again in ${Math.max(1, Math.ceil(wait / 60))} minute${wait > 90 ? 's' : ''}.`;
  return err.message;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [useBackup, setUseBackup] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function done() {
    const next = new URLSearchParams(window.location.search).get('next');
    router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api<{ mfaRequired: boolean; mfaToken?: string }>('/api/auth/login', { method: 'POST', body: { email, password } });
      if (res.mfaRequired && res.mfaToken) setMfaToken(res.mfaToken);
      else done();
    } catch (err) {
      setError(explain(err as ApiError));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api('/api/auth/login/2fa', { method: 'POST', body: { mfaToken, ...(useBackup ? { backupCode: code.trim() } : { code: code.trim() }) } });
      done();
    } catch (err) {
      setError(explain(err as ApiError));
    } finally {
      setBusy(false);
    }
  }

  if (mfaToken) {
    return (
      <form onSubmit={submitCode} noValidate className="flex max-w-sm flex-col gap-4">
        <h2 className="text-2xl font-semibold">Enter your code</h2>
        <p className="text-muted">{useBackup ? 'Enter one of your backup codes. Each works once.' : 'Open your authenticator app and enter the 6 digit code for Phantom Exchange.'}</p>
        <ErrorSummary messages={error ? [error] : []} />
        <TextField
          label={useBackup ? 'Backup code' : 'Authenticator code'}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode={useBackup ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          autoFocus
          mono
        />
        <Button type="submit" loading={busy}>
          Sign in
        </Button>
        <button
          type="button"
          onClick={() => {
            setUseBackup(!useBackup);
            setCode('');
            setError(null);
          }}
          className="min-h-11 self-start text-left text-sm underline underline-offset-4"
        >
          {useBackup ? 'Use my authenticator app instead' : 'Use a backup code instead'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submitPassword} noValidate className="flex max-w-sm flex-col gap-4">
      <h2 className="text-2xl font-semibold">Sign in</h2>
      <ErrorSummary messages={error ? [error] : []} />
      <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" inputMode="email" />
      <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      <Button type="submit" loading={busy}>
        Sign in
      </Button>
      <p className="text-muted">
        New here?{' '}
        <Link href="/register" className="text-fg underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </form>
  );
}
