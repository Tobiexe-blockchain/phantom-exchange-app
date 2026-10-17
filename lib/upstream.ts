export interface UpstreamResult<T = any> {
  /** HTTP status, or 0 when the service could not be reached. */
  status: number;
  body: T;
  networkError: boolean;
}

export async function upstream(
  base: string,
  path: string,
  opts: { method?: string; headers?: Record<string, string>; body?: unknown; timeoutMs?: number } = {},
): Promise<UpstreamResult> {
  try {
    const res = await fetch(`${base}${path}`, {
      method: opts.method ?? 'GET',
      headers: { ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}), ...opts.headers },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
      cache: 'no-store',
    });
    const text = await res.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    return { status: res.status, body, networkError: false };
  } catch {
    return { status: 0, body: null, networkError: true };
  }
}

/** A well-formed error from the service means it looked at the request and said no. */
export function definiteRejection(r: UpstreamResult): boolean {
  const code = r.body?.error?.code;
  return typeof code === 'string' && !(r.status >= 500 && code === 'INTERNAL');
}
