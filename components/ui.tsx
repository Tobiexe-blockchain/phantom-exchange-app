'use client';

import { AlertCircle, Check, CheckCircle2, Clock, Copy, Info, X } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Button({
  variant = 'primary',
  loading,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger'; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-4 text-base font-medium transition-colors duration-150 lg:text-sm',
        variant === 'primary' && 'border-transparent bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-pressed',
        variant === 'secondary' && 'border-line bg-transparent text-fg hover:bg-raised active:bg-raised',
        variant === 'danger' && 'border-down bg-transparent text-down hover:bg-raised active:bg-raised',
        className,
      )}
    >
      {loading ? 'Working' : children}
    </button>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  mono?: boolean;
}

export function TextField({ label, hint, error, mono, className, ...rest }: FieldProps & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const described = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        {...rest}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        className={cn('min-h-11 rounded-sm border bg-bg px-3 text-base lg:text-sm', error ? 'border-down' : 'border-line', mono && 'num')}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-down">
          {error}
        </p>
      )}
    </div>
  );
}

export function SelectField({ label, hint, error, children, className, ...rest }: FieldProps & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select id={id} {...rest} aria-invalid={error ? true : undefined} className={cn('min-h-11 rounded-sm border bg-bg px-3 text-base lg:text-sm', error ? 'border-down' : 'border-line')}>
        {children}
      </select>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      {error && <p className="text-sm text-down">{error}</p>}
    </div>
  );
}

/** A message that always pairs its color with an icon and words. */
export function Notice({ tone = 'info', title, children, onClose }: { tone?: 'info' | 'success' | 'error'; title?: string; children?: ReactNode; onClose?: () => void }) {
  const Icon = tone === 'error' ? AlertCircle : tone === 'success' ? CheckCircle2 : Info;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-md border p-3 text-sm', tone === 'error' ? 'border-down' : tone === 'success' ? 'border-up' : 'border-line')}
    >
      <Icon size={20} strokeWidth={1.8} aria-hidden className={cn('mt-0.5 shrink-0', tone === 'error' ? 'text-down' : tone === 'success' ? 'text-up' : 'text-muted')} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && 'mt-1', 'text-muted [&_strong]:text-fg')}>{children}</div>}
      </div>
      {onClose && (
        <button type="button" aria-label="Dismiss message" onClick={onClose} className="-m-2 flex min-h-11 min-w-11 items-center justify-center rounded-sm text-muted hover:text-fg">
          <X size={16} strokeWidth={1.8} aria-hidden />
        </button>
      )}
    </div>
  );
}

const BADGES = {
  good: { Icon: CheckCircle2, cls: 'border-up text-up' },
  wait: { Icon: Clock, cls: 'border-line text-muted' },
  bad: { Icon: AlertCircle, cls: 'border-down text-down' },
} as const;

export function Badge({ tone, children }: { tone: keyof typeof BADGES; children: ReactNode }) {
  const { Icon, cls } = BADGES[tone];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-medium', cls)}>
      <Icon size={12} strokeWidth={2} aria-hidden />
      {children}
    </span>
  );
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 2000);
    return () => clearTimeout(t);
  }, [done]);
  return (
    <Button
      type="button"
      variant="secondary"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
        } catch {
          /* the value is on screen, so it can still be selected by hand */
        }
      }}
    >
      {done ? <Check size={16} strokeWidth={1.8} aria-hidden /> : <Copy size={16} strokeWidth={1.8} aria-hidden />}
      {done ? 'Copied' : 'Copy'}
    </Button>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-5 rounded-sm bg-raised" />
      ))}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-line p-4">
      <p className="font-medium">{title}</p>
      {children && <p className="max-w-[60ch] text-muted">{children}</p>}
      {action}
    </div>
  );
}

export function Section({ title, description, children, id }: { title: string; description?: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} aria-labelledby={`${id ?? title}-h`} className="flex flex-col gap-4 border-t border-line pt-6 first:border-t-0 first:pt-0">
      <div className="flex flex-col gap-1">
        <h2 id={`${id ?? title}-h`} className="text-xl font-semibold">
          {title}
        </h2>
        {description && <p className="max-w-[70ch] text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function ErrorSummary({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <div role="alert" className="rounded-md border border-down p-3 text-sm">
      <p className="flex items-center gap-2 font-medium text-down">
        <AlertCircle size={16} strokeWidth={1.8} aria-hidden />
        Fix this to continue
      </p>
      <ul className="mt-1 list-disc pl-6">
        {messages.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}

export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children && <p className="max-w-[70ch] text-muted">{children}</p>}
    </div>
  );
}

export const Table = ({ children, label }: { children: ReactNode; label: string }) => (
  <div className="overflow-x-auto rounded-md border border-line">
    <table aria-label={label} className="w-full min-w-[560px] border-collapse text-left text-sm">
      {children}
    </table>
  </div>
);
export const Th = ({ children, right }: { children?: ReactNode; right?: boolean }) => (
  <th scope="col" className={cn('bg-surface px-3 py-2 text-xs font-medium text-muted', right && 'text-right')}>
    {children}
  </th>
);
export const Td = ({ children, right, mono, className }: { children?: ReactNode; right?: boolean; mono?: boolean; className?: string }) => (
  <td className={cn('border-t border-line px-3 py-2 align-top', right && 'text-right', mono && 'num', className)}>{children}</td>
);
