import { z } from 'zod';
import { authCall, errorJson, forward, open } from '@/lib/session';

const body = z.object({ email: z.string().min(3).max(254), password: z.string().min(1).max(128) });

export const POST = open(async (req) => {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorJson(400, 'VALIDATION_ERROR', 'Enter an email and a password.');
  return forward(await authCall('/auth/register', { method: 'POST', body: parsed.data }));
});
