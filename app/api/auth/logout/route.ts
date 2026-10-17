import { NextResponse } from 'next/server';
import { authCall, clearSessionCookies, open, readRefreshCookie } from '@/lib/session';

export const POST = open(async () => {
  const refreshToken = await readRefreshCookie();
  if (refreshToken) await authCall('/auth/logout', { method: 'POST', body: { refreshToken } });
  const res = NextResponse.json({ ok: true });
  clearSessionCookies(res);
  return res;
});
