export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,28rem)]">
      <div className="flex flex-col justify-between border-b border-line p-6 lg:border-b-0 lg:border-r lg:p-12">
        <p className="text-base font-semibold">Phantom Exchange</p>
        <div className="my-12 flex max-w-[48ch] flex-col gap-3 lg:my-0">
          <h1 className="text-3xl font-semibold lg:text-4xl">Your account, your keys to it.</h1>
          <p className="text-muted">Deposit, withdraw, and check balances. Turn on two-factor sign-in and keep a short list of withdrawal addresses that only you can change.</p>
        </div>
        <p className="text-sm text-muted">This is a test network. Use test funds only.</p>
      </div>
      <div className="flex flex-col justify-center p-6 pb-[max(24px,env(safe-area-inset-bottom))] lg:p-12">{children}</div>
    </div>
  );
}
