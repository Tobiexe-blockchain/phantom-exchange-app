import { authCall, authed, errorJson, forward } from '@/lib/session';

export const DELETE = authed(async ({ token, params }) => {
  if (!/^[0-9a-f-]{36}$/i.test(params.id ?? '')) return errorJson(400, 'VALIDATION_ERROR', 'Unknown address.');
  return forward(await authCall(`/whitelist/${params.id}`, { method: 'DELETE', token }));
});
