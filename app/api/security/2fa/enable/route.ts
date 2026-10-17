import { z } from 'zod';
import { authCall, authed, errorJson, forward } from '@/lib/session';

const body = z.object({ code: z.string().min(1).max(10) });

export const POST = authed(async ({ token, req }) => {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorJson(400, 'VALIDATION_ERROR', 'Enter the 6 digit code.');
  return forward(await authCall('/auth/2fa/enable', { method: 'POST', token, body: parsed.data }));
});
