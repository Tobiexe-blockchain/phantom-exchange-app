import { z } from 'zod';
import { authCall, authed, errorJson, forward } from '@/lib/session';

const body = z.object({ token: z.string().min(20).max(200) });

export const POST = authed(async ({ token, req }) => {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorJson(400, 'VALIDATION_ERROR', 'Paste the confirmation code from the email.');
  return forward(await authCall('/whitelist/confirm', { method: 'POST', token, body: parsed.data }));
});
