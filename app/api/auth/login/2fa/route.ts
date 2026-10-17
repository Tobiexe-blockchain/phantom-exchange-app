import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authCall, errorJson, forward, open, setSessionCookies } from '@/lib/session';

const body = z.object({ mfaToken: z.string().min(20).max(2000), code: z.string().max(10).optional(), backupCode: z.string().max(30).optional() });

export const POST = open(async (req) => {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorJson(400, 'VALIDATION_ERROR', 'Enter the code from your authenticator app.');
  const r = await authCall('/auth/login/2fa', { method: 'POST', body: parsed.data });
  if (r.status !== 200) return forward(r);
  const res = NextResponse.json({ mfaRequired: false });
  setSessionCookies(res, r.body);
  return res;
});
