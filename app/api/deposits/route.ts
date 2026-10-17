import { walletPort } from '@/lib/ports';
import { authed, forward } from '@/lib/session';

export const GET = authed(async ({ user }) => forward(await walletPort().deposits(user.id)));
