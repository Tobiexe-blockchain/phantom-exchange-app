export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

type Refresher = (refreshToken: string) => Promise<Tokens | null>;

const inflight = new Map<string, Promise<Tokens | null>>();

/**
 * Refresh tokens work once, and using one twice ends the whole session. When several requests find the
 * access token expired at the same moment, they must share one refresh instead of each trying their own.
 * (This covers one server process. With several, send a user's requests to the same one or share the result.)
 */
export function refreshOnce(refreshToken: string, refresh: Refresher): Promise<Tokens | null> {
  const existing = inflight.get(refreshToken);
  if (existing) return existing;
  const p = refresh(refreshToken).finally(() => setTimeout(() => inflight.delete(refreshToken), 10_000));
  inflight.set(refreshToken, p);
  return p;
}
