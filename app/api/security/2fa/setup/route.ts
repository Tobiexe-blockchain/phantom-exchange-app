import { authCall, authed, forward } from '@/lib/session';

export const POST = authed(async ({ token }) => forward(await authCall('/auth/2fa/setup', { method: 'POST', token })));
