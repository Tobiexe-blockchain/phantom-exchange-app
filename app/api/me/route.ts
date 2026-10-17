import { authed } from '@/lib/session';

export const GET = authed(async ({ user }) => user);
