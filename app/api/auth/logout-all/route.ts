import { NextResponse } from 'next/server';
import { authCall, authed, clearSessionCookies } from '@/lib/session';

export const POST = authed(async ({ token }) => {
  await authCall('/auth/logout-all', { method: 'POST', token });
  const res = NextResponse.json({ ok: true });
  clearSessionCookies(res);
  return res;
});
