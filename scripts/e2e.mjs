// Full-stack check: runs a real user journey through the app against live auth, ledger, and wallet services
// and a local chain. See README ("Run the whole stack").
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { HDNodeWallet, JsonRpcProvider, Wallet, parseEther } from 'ethers';

const env = (k, d) => process.env[k] ?? d;
const APP = env('APP_URL', 'http://localhost:3100');
const WALLET = env('WALLET_URL', 'http://localhost:3002');
const LEDGER = env('LEDGER_URL', 'http://localhost:3010');
const RPC = env('RPC_URL', 'http://127.0.0.1:8545');
const WALLET_KEY = env('WALLET_API_KEY');
const WEBHOOK_SECRET = env('WALLET_WEBHOOK_SECRET');
const AUTH_LOG = env('AUTH_LOG');

let jar = {};
const results = [];
const ok = (name, cond, extra = '') => {
  results.push(cond);
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : `  ${extra}`}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 20000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await sleep(250);
  }
  return null;
};

async function app(method, path, body, { origin = APP, cookies = true } = {}) {
  const headers = { ...(body !== undefined ? { 'content-type': 'application/json' } : {}) };
  if (origin) headers.origin = origin;
  if (cookies && Object.keys(jar).length) headers.cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
  const res = await fetch(APP + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  // A request sent without cookies must not change the cookies we hold.
  for (const c of cookies ? res.headers.getSetCookie() : []) {
    const [pair] = c.split(';');
    const i = pair.indexOf('=');
    const name = pair.slice(0, i);
    const value = pair.slice(i + 1);
    if (value === '' || /Max-Age=0/i.test(c)) delete jar[name];
    else jar[name] = value;
  }
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, body: json };
}

function totp(secretB32, offsetSteps = 0) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const ch of secretB32.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Math.floor(Date.now() / 30000) + offsetSteps;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', key).update(buf).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, '0');
}

const provider = new JsonRpcProvider(RPC);
const funder = new Wallet(HDNodeWallet.fromPhrase('test test test test test test test test test test test junk').privateKey, provider);
const mine = (n) => provider.send('hardhat_mine', [`0x${n.toString(16)}`]);
const balances = async () => Object.fromEntries((await app('GET', '/api/balances')).body.assets.map((a) => [a.symbol, a]));

const email = `e2e-${Date.now()}@example.com`;
const password = 'a long passphrase for testing 2026';
const recipient = Wallet.createRandom().address;
const recipient2 = Wallet.createRandom().address;

// ---- sign up, sign in
let r = await app('POST', '/api/auth/register', { email, password });
ok('register', r.status === 201, JSON.stringify(r.body));
r = await app('POST', '/api/auth/login', { email, password });
ok('login sets a session', r.status === 200 && r.body.mfaRequired === false && jar.pa_at && jar.pa_rt, JSON.stringify(r.body));
r = await app('GET', '/api/me');
ok('me returns the user', r.body?.email === email && r.body.twoFactorEnabled === false);

// ---- protections on the app itself
r = await app('POST', '/api/auth/logout-all', {}, { origin: null });
ok('POST without an Origin header is refused', r.status === 403 && r.body.error.code === 'BAD_ORIGIN');
r = await app('POST', '/api/auth/logout-all', {}, { origin: 'https://evil.example' });
ok('POST from another site is refused', r.status === 403);
r = await app('GET', '/api/balances', undefined, { cookies: false });
ok('no session gives 401', r.status === 401 && r.body.error.code === 'UNAUTHENTICATED');

// ---- two-factor
r = await app('POST', '/api/security/2fa/setup', {});
const secret = r.body.secret;
ok('2FA setup returns a QR code and secret', r.status === 200 && r.body.qrCodeDataUrl?.startsWith('data:image/png') && secret, JSON.stringify(r.body));
r = await app('POST', '/api/security/2fa/enable', { code: '000000' });
ok('2FA enable rejects a wrong code', r.status === 401);
r = await app('POST', '/api/security/2fa/enable', { code: totp(secret) });
const backupCodes = r.body.backupCodes;
ok('2FA enable returns 10 backup codes', r.status === 200 && backupCodes?.length === 10);

r = await app('POST', '/api/auth/logout', {});
ok('logout clears the session', r.status === 200 && !jar.pa_at && !jar.pa_rt);
r = await app('POST', '/api/auth/login', { email, password });
ok('login now asks for a code and sets no session', r.body.mfaRequired === true && !jar.pa_at);
const mfaToken = r.body.mfaToken;
r = await app('POST', '/api/auth/login/2fa', { mfaToken, code: '000000' });
ok('wrong code is refused', r.status === 401 && !jar.pa_at);
r = await app('POST', '/api/auth/login/2fa', { mfaToken, code: totp(secret, 1) });
ok('right code signs in', r.status === 200 && jar.pa_at);

// ---- whitelist
r = await app('POST', '/api/whitelist', { network: 'ethereum', address: recipient, label: 'Cold wallet' });
ok('adding an address needs a second factor when 2FA is on', r.status === 400 && r.body.error.code === 'SECOND_FACTOR_REQUIRED', JSON.stringify(r.body));
r = await app('POST', '/api/whitelist', { network: 'ethereum', address: recipient, label: 'Cold wallet', backupCode: backupCodes[0] });
ok('adding an address with a backup code', r.status === 201 && r.body.status === 'pending_confirmation', JSON.stringify(r.body));
const entryId = r.body.id;

let list = (await app('GET', '/api/whitelist')).body;
ok('the new address is listed as pending', list[0]?.status === 'pending_confirmation');
r = await app('POST', '/api/withdrawals', { requestId: crypto.randomUUID(), asset: 'ETH', amount: '0.1', addressId: entryId });
ok('withdrawing to an unconfirmed address is refused', r.status === 400 && r.body.error.code === 'ADDRESS_NOT_READY', JSON.stringify(r.body));

await sleep(500);
const log = readFileSync(AUTH_LOG, 'utf8');
const token = [...log.matchAll(/with token (\S+)/g)].pop()?.[1];
ok('the confirmation email carries a code', !!token);
r = await app('POST', '/api/whitelist/confirm', { token: 'x'.repeat(43) });
ok('a wrong confirmation code is refused', r.status === 400);
r = await app('POST', '/api/whitelist/confirm', { token });
ok('confirming the address', r.status === 200, JSON.stringify(r.body));
const active = await until(async () => (await app('GET', '/api/whitelist')).body.find((e) => e.id === entryId && e.status === 'active'), 15000);
ok('the address becomes ready after its waiting period', !!active);

// ---- deposit
r = await app('GET', '/api/deposit-address');
const depositAddress = r.body.address;
ok('deposit address and QR code', /^0x[0-9a-fA-F]{40}$/.test(depositAddress) && r.body.qr.startsWith('data:image/png'));
r = await app('GET', '/api/deposit-address');
ok('the deposit address is stable', r.body.address === depositAddress);

await (await funder.sendTransaction({ to: depositAddress, value: parseEther('2') })).wait();
const seen = await until(async () => (await app('GET', '/api/deposits')).body?.[0]);
ok('the deposit is seen while pending', seen?.status === 'pending' || seen?.status === 'confirmed');
await mine(3);
const credited = await until(async () => (await balances()).ETH.available === parseEther('2').toString());
ok('the confirmed deposit is credited in the ledger', !!credited, JSON.stringify(await balances()));
const deps = (await app('GET', '/api/deposits')).body;
ok('deposit history shows it as credited, once', deps.length === 1 && deps[0].status === 'confirmed');

// ---- withdraw
const hot = (await (await fetch(`${WALLET}/hot-wallet`, { headers: { 'x-api-key': WALLET_KEY } })).json()).address;
await (await funder.sendTransaction({ to: hot, value: parseEther('5') })).wait();

const requestId = crypto.randomUUID();
const startBal = BigInt(await provider.getBalance(recipient));
r = await app('POST', '/api/withdrawals', { requestId, asset: 'ETH', amount: '0.5', addressId: entryId });
ok('withdrawal is accepted', r.status === 201 && r.body.status === 'queued', JSON.stringify(r.body));
let b = await balances();
ok('funds are held straight away', b.ETH.available === parseEther('1.5').toString() && b.ETH.locked === parseEther('0.5').toString(), JSON.stringify(b.ETH));
const paid = await until(async () => (await provider.getBalance(recipient)) - startBal === parseEther('0.5'));
ok('the recipient receives exactly the amount', !!paid);

r = await app('POST', '/api/withdrawals', { requestId, asset: 'ETH', amount: '0.5', addressId: entryId });
ok('repeating the same request does not pay twice', (r.status === 200 || r.status === 201) && (await balances()).ETH.available === parseEther('1.5').toString());
ok('the wallet holds a single withdrawal', (await app('GET', '/api/withdrawals')).body.length === 1);

await mine(3);
const settled = await until(async () => (await balances()).ETH.locked === '0');
b = await balances();
ok('after confirmation the hold is released from the ledger', !!settled && b.ETH.available === parseEther('1.5').toString(), JSON.stringify(b.ETH));
const wds = await until(async () => {
  const w = (await app('GET', '/api/withdrawals')).body;
  return w[0]?.status === 'confirmed' ? w : null;
});
ok('withdrawal history shows it as sent', !!wds);

// ---- things that must fail safely
r = await app('POST', '/api/withdrawals', { requestId: crypto.randomUUID(), asset: 'ETH', amount: '100', addressId: entryId });
ok('more than the balance is refused', r.status === 422 && r.body.error.code === 'INSUFFICIENT_FUNDS', JSON.stringify(r.body));
b = await balances();
ok('and nothing is held', b.ETH.locked === '0' && b.ETH.available === parseEther('1.5').toString());

r = await app('POST', '/api/withdrawals', { requestId: crypto.randomUUID(), asset: 'ETH', amount: '1.2', addressId: entryId });
ok('the wallet refuses an amount over its per-withdrawal limit', r.status >= 400 && r.body.error?.code === 'LIMIT_PER_TX', JSON.stringify(r.body));
b = await balances();
ok('the held funds are given back after the wallet refuses', b.ETH.locked === '0' && b.ETH.available === parseEther('1.5').toString(), JSON.stringify(b.ETH));

for (const amount of ['abc', '-1', '0', '0.0000000000000000001', '1e18']) {
  r = await app('POST', '/api/withdrawals', { requestId: crypto.randomUUID(), asset: 'ETH', amount, addressId: entryId });
  ok(`amount "${amount}" is refused`, r.status === 400, JSON.stringify(r.body));
}
r = await app('POST', '/api/withdrawals', { requestId: crypto.randomUUID(), asset: 'ETH', amount: '0.1', addressId: crypto.randomUUID() });
ok('an address that is not on the list is refused', r.status === 400 && r.body.error.code === 'ADDRESS_NOT_FOUND');

// ---- removal is immediate
r = await app('POST', '/api/whitelist', { network: 'ethereum', address: recipient2, backupCode: backupCodes[1] });
const id2 = r.body.id;
r = await app('DELETE', `/api/whitelist/${id2}`);
ok('removing an address works', r.status === 200);
list = (await app('GET', '/api/whitelist')).body;
ok('the removed address is gone from the active list', !list.some((e) => e.id === id2 && e.status !== 'revoked'));

// ---- activity log
const audit = (await app('GET', '/api/audit')).body.map((e) => e.event);
for (const ev of ['register', 'login_success', '2fa_enabled', 'backup_code_used', 'whitelist_added', 'whitelist_confirmed', 'whitelist_removed']) ok(`audit log has ${ev}`, audit.includes(ev));

// ---- webhook protection
const body = JSON.stringify({ type: 'deposit.confirmed', id: 'x', data: { id: 'x', userId: 'attacker', asset: 'ETH', amount: '999000000000000000000', txHash: '0x1' } });
let hook = await fetch(`${APP}/api/webhooks/wallet`, { method: 'POST', body, headers: { 'content-type': 'application/json', 'x-signature': 'sha256=' + '00'.repeat(32) } });
ok('a forged wallet event is refused', hook.status === 401);
hook = await fetch(`${APP}/api/webhooks/wallet`, { method: 'POST', body });
ok('an unsigned wallet event is refused', hook.status === 401);
const sig = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
hook = await fetch(`${APP}/api/webhooks/wallet`, { method: 'POST', body, headers: { 'content-type': 'application/json', 'x-signature': `sha256=${sig}` } });
ok('a correctly signed event is accepted (and the ledger decides what to do with it)', hook.status === 200 || hook.status === 502);

// ---- books
const rec = await (await fetch(`${LEDGER}/reconcile`)).json();
ok('the ledger books balance', rec.ok === true, JSON.stringify(rec));

// ---- sign out everywhere
const oldAccess = jar.pa_at;
r = await app('POST', '/api/auth/logout-all', {});
ok('sign out of all devices', r.status === 200);
jar = { pa_at: oldAccess };
r = await app('GET', '/api/me');
ok('the old access token stops working at once', r.status === 401);

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
provider.destroy();
process.exit(failed ? 1 : 0);
