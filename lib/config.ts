function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

/** Read lazily, so building the app does not need the secrets. */
export function config() {
  return {
    authUrl: process.env.AUTH_URL ?? 'http://localhost:3001',
    walletUrl: process.env.WALLET_URL ?? 'http://localhost:3002',
    ledgerUrl: process.env.LEDGER_URL ?? 'http://localhost:3010',
    walletApiKey: need('WALLET_API_KEY'),
    webhookSecret: need('WALLET_WEBHOOK_SECRET'),
    cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production',
  };
}
