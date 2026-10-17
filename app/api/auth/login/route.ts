import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authCall, errorJson, forward, open, setSessionCookies } from '@/lib/session';

const body = z.object({ email: z.string().min(3).max(254), password: z.string().min(1).max(128) });

export const POST = open(async (req) => {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorJson(400, 'VALIDATION_ERROR', 'Enter your email and password.');
  const r = await authCall('/auth/login', { method: 'POST', body: parsed.data });
  if (r.status !== 200) return forward(r);
  if (r.body.mfaRequired) return NextResponse.json({ mfaRequired: true, mfaToken: r.body.mfaToken });
  const res = NextResponse.json({ mfaRequired: false });
  setSessionCookies(res, r.body);
  return res;
});
