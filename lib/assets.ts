export interface Asset {
  /** Name the wallet service uses. */
  symbol: string;
  /** Name the ledger uses (upper case letters and digits only). */
  ledger: string;
  name: string;
  decimals: number;
  /** Decimal places to show on screen. */
  shown: number;
}

/** Keep in step with ASSETS_JSON in the wallet service. */
export const ASSETS: Asset[] = [
  { symbol: 'ETH', ledger: 'ETH', name: 'Ether', decimals: 18, shown: 6 },
  { symbol: 'tUSD', ledger: 'TUSD', name: 'Test USD', decimals: 6, shown: 2 },
];

export const assetBySymbol = (symbol: string) => ASSETS.find((a) => a.symbol === symbol);
export const assetByLedger = (currency: string) => ASSETS.find((a) => a.ledger === currency);

/** Shows base units as a decimal, cutting (never rounding up) to `shown` places. */
export function formatUnits(value: string | bigint, decimals: number, shown = decimals): string {
  const v = BigInt(value);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const base = 10n ** BigInt(decimals);
  const whole = (abs / base).toString();
  const frac = (abs % base).toString().padStart(decimals, '0').slice(0, shown);
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}${grouped}${shown > 0 ? `.${frac.padEnd(shown, '0')}` : ''}`;
}

export class AmountError extends Error {}

/** Turns what a person typed ("0.25") into base units. Rejects anything that is not a plain positive decimal. */
export function parseUnits(text: string, decimals: number): bigint {
  const s = text.trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new AmountError('Enter the amount as a number, for example 0.25.');
  const [whole, frac = ''] = s.split('.');
  if (frac.length > decimals) throw new AmountError(`Use at most ${decimals} decimal places.`);
  const value = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, '0') || '0');
  if (value <= 0n) throw new AmountError('Enter an amount greater than 0.');
  return value;
}
