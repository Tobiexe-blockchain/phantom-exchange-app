import { authCall, authed, forward } from '@/lib/session';

export const GET = authed(async ({ token }) => forward(await authCall('/audit?limit=50', { token })));
