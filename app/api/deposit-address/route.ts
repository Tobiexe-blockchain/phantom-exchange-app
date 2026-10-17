import QRCode from 'qrcode';
import { NextResponse } from 'next/server';
import { walletPort } from '@/lib/ports';
import { authed, forward } from '@/lib/session';

export const GET = authed(async ({ user }) => {
  const r = await walletPort().address(user.id);
  if (r.status !== 200) return forward(r);
  const address = String(r.body.address);
  return NextResponse.json({ address, qr: await QRCode.toDataURL(address, { margin: 1, width: 192 }) });
});

export const dynamic = 'force-dynamic';
