export const fmtDate = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export function fmtWait(ms: number): string {
  const mins = Math.max(1, Math.round(ms / 60000));
  if (mins < 90) return `${mins} minute${mins === 1 ? '' : 's'}`;
  const hours = Math.round(mins / 60);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}
