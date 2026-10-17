'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, api } from '@/hooks/useApi';
import { Button, ErrorSummary, TextField } from '@/components/ui';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const passwordError = touched && password.length < 12 ? 'Use at least 12 characters. A phrase of several words works well.' : undefined;
  const emailError = touched && !/^\S+@\S+\.\S+$/.test(email) ? 'Enter a valid email address, for example name@example.com.' : undefined;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (password.length < 12 || !/^\S+@\S+\.\S+$/.test(email)) return;
    setBusy(true);
    try {
      await api('/api/auth/register', { method: 'POST', body: { email, password } });
      const res = await api<{ mfaRequired: boolean }>('/api/auth/login', { method: 'POST', body: { email, password } });
      router.replace(res.mfaRequired ? '/login' : '/security');
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-sm flex-col gap-4">
      <h2 className="text-2xl font-semibold">Create an account</h2>
      <ErrorSummary messages={[emailError, passwordError, error].filter(Boolean) as string[]} />
      <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" inputMode="email" error={emailError} />
      <TextField
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        hint="At least 12 characters. It cannot contain the first part of your email."
        error={passwordError}
      />
      <Button type="submit" loading={busy}>
        Create account
      </Button>
      <p className="text-muted">
        Already have an account?{' '}
        <Link href="/login" className="text-fg underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  );
}
