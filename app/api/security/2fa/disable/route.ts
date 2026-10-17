import { z } from 'zod';
import { authCall, authed, errorJson, forward } from '@/lib/session';

const body = z.object({ password: z.string().min(1).max(128), code: z.string().max(10).optional(), backupCode: z.string().max(30).optional() });

export const POST = authed(async ({ token, req }) => {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorJson(400, 'VALIDATION_ERROR', 'Enter your password and a code.');
  return forward(await authCall('/auth/2fa/disable', { method: 'POST', token, body: parsed.data }));
});
