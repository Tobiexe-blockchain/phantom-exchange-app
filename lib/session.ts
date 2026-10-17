import { cookies, headers } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { config } from './config';
import { refreshOnce, type Tokens } from './refresh';
import { upstream, type UpstreamResult } from './upstream';

const ACCESS = 'pa_at';
const REFRESH = 'pa_rt';
const REFRESH_DAYS = 30;

export interface User {
  id: string;
  email: string;
  twoFactorEnabled: boolean;
}

export const errorJson = (status: number, code: string, message: string, details?: unknown) =>
  NextResponse.json({ error: { code, message, details } }, { status });

/** Passes a service answer straight through. A service that cannot be reached becomes a clear 503. */
export function forward(r: UpstreamResult, okBody?: (body: any) => unknown): NextResponse {
  if (r.networkError) return errorJson(503, 'SERVICE_UNAVAILABLE', 'A required service is not answering. Try again in a moment.');
  if (r.status === 204) return NextResponse.json({ ok: true });
  if (r.status >= 200 && r.status < 300) return NextResponse.json(okBody ? okBody(r.body) : r.body, { status: r.status });
  return NextResponse.json(r.body?.error ? r.body : { error: { code: 'UPSTREAM_ERROR', message: 'The request could not be completed.' } }, { status: r.status || 502 });
}

/**
 * Calls the auth service for the signed-in user's request. The user's IP and browser are passed along, so the
 * auth service applies rate limits per person and records the real address in the audit log. Run the auth
 * service with TRUST_PROXY=true, and only on a private network where this app is the one reaching it.
 */
export async function authCall(path: string, o: { method?: string; token?: string; body?: unknown } = {}) {
  const extra: Record<string, string> = {};
  try {
    const h = await headers();
    const ip = h.get('x-forwarded-for');
    const ua = h.get('user-agent');
    if (ip) extra['x-forwarded-for'] = ip;
    if (ua) extra['user-agent'] = ua;
  } catch {
    /* not inside a request */
  }
  return upstream(config().authUrl, path, { method: o.method, body: o.body, headers: { ...extra, ...(o.token ? { authorization: `Bearer ${o.token}` } : {}) } });
}

export function setSessionCookies(res: NextResponse, t: Tokens): void {
  const secure = config().cookieSecure;
  const base = { httpOnly: true, sameSite: 'lax' as const, secure, path: '/' };
  res.cookies.set(ACCESS, t.accessToken, { ...base, maxAge: t.expiresIn });
  res.cookies.set(REFRESH, t.refreshToken, { ...base, maxAge: REFRESH_DAYS * 86400 });
}

export function clearSessionCookies(res: NextResponse): void {
  for (const name of [ACCESS, REFRESH]) res.cookies.set(name, '', { httpOnly: true, sameSite: 'lax', secure: config().cookieSecure, path: '/', maxAge: 0 });
}

/** A browser always sends Origin on a cross-site POST. Anything that does not match this host is refused. */
export function sameOrigin(req: NextRequest): NextResponse | null {
  if (req.method === 'GET' || req.method === 'HEAD') return null;
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  try {
    if (origin && host && new URL(origin).host === host) return null;
  } catch {
    /* fall through */
  }
  return errorJson(403, 'BAD_ORIGIN', 'This request did not come from this site.');
}

async function refreshWithAuth(refreshToken: string): Promise<Tokens | null> {
  const r = await authCall('/auth/refresh', { method: 'POST', body: { refreshToken } });
  return r.status === 200 && r.body?.accessToken ? { accessToken: r.body.accessToken, refreshToken: r.body.refreshToken, expiresIn: r.body.expiresIn } : null;
}

async function authenticate(): Promise<{ user: User; token: string; fresh?: Tokens } | null> {
  const jar = await cookies();
  const access = jar.get(ACCESS)?.value;
  const refresh = jar.get(REFRESH)?.value;

  if (access) {
    const me = await authCall('/auth/me', { token: access });
    if (me.status === 200) return { user: me.body, token: access };
  }
  if (refresh) {
    const fresh = await refreshOnce(refresh, refreshWithAuth);
    if (fresh) {
      const me = await authCall('/auth/me', { token: fresh.accessToken });
      if (me.status === 200) return { user: me.body, token: fresh.accessToken, fresh };
    }
  }
  return null;
}

export interface Ctx {
  user: User;
  token: string;
  req: NextRequest;
  params: Record<string, string>;
}
type Handler = (c: Ctx) => Promise<NextResponse | object>;
type RouteCtx = { params: Promise<Record<string, string>> };

/** A route that needs a signed-in user. Refreshes the session when the access token has expired. */
export function authed(handler: Handler) {
  return async (req: NextRequest, rc: RouteCtx): Promise<NextResponse> => {
    const bad = sameOrigin(req);
    if (bad) return bad;
    const session = await authenticate();
    if (!session) {
      const res = errorJson(401, 'UNAUTHENTICATED', 'Sign in to continue.');
      clearSessionCookies(res);
      return res;
    }
    let res: NextResponse;
    try {
      const out = await handler({ user: session.user, token: session.token, req, params: (await rc?.params) ?? {} });
      res = out instanceof NextResponse ? out : NextResponse.json(out);
    } catch (err) {
      console.error(`route failed: ${(err as Error).message}`);
      res = errorJson(500, 'INTERNAL', 'Something went wrong on our side.');
    }
    if (session.fresh) setSessionCookies(res, session.fresh);
    return res;
  };
}

/** A route that does not need a session (sign in, register). Still checks the origin. */
export function open(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const bad = sameOrigin(req);
    if (bad) return bad;
    try {
      return await handler(req);
    } catch (err) {
      console.error(`route failed: ${(err as Error).message}`);
      return errorJson(500, 'INTERNAL', 'Something went wrong on our side.');
    }
  };
}

export async function readRefreshCookie(): Promise<string | undefined> {
  return (await cookies()).get(REFRESH)?.value;
}
