import { describe, expect, it } from 'vitest';
import { refreshOnce, type Tokens } from '../lib/refresh';

describe('refreshOnce', () => {
  it('shares one refresh between simultaneous requests', async () => {
    let calls = 0;
    const refresh = async (): Promise<Tokens> => {
      calls++;
      await new Promise((r) => setTimeout(r, 20));
      return { accessToken: 'a', refreshToken: 'b', expiresIn: 900 };
    };
    const results = await Promise.all(Array.from({ length: 10 }, () => refreshOnce('token-1', refresh)));
    expect(calls).toBe(1);
    expect(new Set(results.map((r) => r!.refreshToken)).size).toBe(1);
  });

  it('refreshes separately for different tokens', async () => {
    let calls = 0;
    const refresh = async (): Promise<Tokens> => (calls++, { accessToken: 'a', refreshToken: 'b', expiresIn: 1 });
    await Promise.all([refreshOnce('t-a', refresh), refreshOnce('t-b', refresh)]);
    expect(calls).toBe(2);
  });

  it('passes a failed refresh to everyone waiting', async () => {
    const results = await Promise.all([refreshOnce('t-fail', async () => null), refreshOnce('t-fail', async () => null)]);
    expect(results).toEqual([null, null]);
  });
});
