import { z } from 'zod';
import { authCall, authed, errorJson, forward } from '@/lib/session';

const body = z.object({
  network: z.literal('ethereum'),
  address: z.string().min(10).max(100),
  label: z.string().max(60).optional(),
  code: z.string().max(10).optional(),
  backupCode: z.string().max(30).optional(),
});

export const GET = authed(async ({ token }) => forward(await authCall('/whitelist', { token })));

export const POST = authed(async ({ token, req }) => {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorJson(400, 'VALIDATION_ERROR', 'Enter a valid address.');
  return forward(await authCall('/whitelist', { method: 'POST', token, body: parsed.data }));
});
