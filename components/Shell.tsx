'use client';

import { ArrowDownToLine, ArrowUpFromLine, LayoutList, LogOut, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { api, useApi } from '@/hooks/useApi';
import { cn } from '@/lib/cn';
import { Skeleton } from './ui';

export interface Me {
  id: string;
  email: string;
  twoFactorEnabled: boolean;
}

const NAV = [
  { href: '/', label: 'Overview', Icon: LayoutList },
  { href: '/deposit', label: 'Deposit', Icon: ArrowDownToLine },
  { href: '/withdraw', label: 'Withdraw', Icon: ArrowUpFromLine },
  { href: '/security', label: 'Security', Icon: ShieldCheck },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const me = useApi<Me>('/api/me');

  useEffect(() => {
    const go = () => router.replace(`/login?next=${encodeURIComponent(path)}`);
    window.addEventListener('auth:expired', go);
    return () => window.removeEventListener('auth:expired', go);
  }, [router, path]);

  async function signOut() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/login');
    }
  }

  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="hidden w-60 shrink-0 flex-col justify-between border-r border-line bg-surface p-4 lg:flex">
        <div className="flex flex-col gap-6">
          <p className="text-base font-semibold">Phantom Exchange</p>
          <nav aria-label="Main" className="flex flex-col gap-1">
            {NAV.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={active(href) ? 'page' : undefined}
                className={cn('flex min-h-11 items-center gap-3 rounded-sm border-l-2 px-3', active(href) ? 'border-accent bg-raised font-medium' : 'border-transparent text-muted hover:text-fg')}
              >
                <Icon size={18} strokeWidth={1.8} aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex flex-col gap-2">
          <p className="break-all text-sm text-muted">{me.data?.email ?? ''}</p>
          <button type="button" onClick={signOut} className="flex min-h-11 items-center gap-3 rounded-sm px-3 text-muted hover:text-fg">
            <LogOut size={18} strokeWidth={1.8} aria-hidden />
            Sign out
          </button>
        </div>
      </aside>

      <header className="flex items-center justify-between border-b border-line bg-surface px-4 pt-[max(8px,env(safe-area-inset-top))] pb-2 lg:hidden">
        <p className="font-semibold">Phantom Exchange</p>
        <button type="button" aria-label="Sign out" onClick={signOut} className="flex min-h-11 min-w-11 items-center justify-center rounded-sm text-muted hover:text-fg">
          <LogOut size={20} strokeWidth={1.8} aria-hidden />
        </button>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 p-4 pb-24 lg:p-8 lg:pb-8">{me.loading ? <Skeleton rows={6} /> : children}</main>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-[var(--z-sticky)] grid grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        {NAV.map(({ href, label, Icon }) => (
          <Link key={href} href={href} aria-current={active(href) ? 'page' : undefined} className={cn('flex min-h-14 flex-col items-center justify-center gap-1 text-xs', active(href) ? 'text-fg' : 'text-muted')}>
            <Icon size={20} strokeWidth={active(href) ? 2 : 1.6} aria-hidden />
            <span className={active(href) ? 'font-medium underline underline-offset-4' : ''}>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
