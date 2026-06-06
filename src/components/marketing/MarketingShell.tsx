import Link from "next/link";

export function MarketingShell(props: {
  children: React.ReactNode;
  active?: "home" | "features" | "pricing" | "demo";
}) {
  const { children, active } = props;

  const navLink = (href: string, key: typeof active, label: string) => (
    <Link
      href={href}
      className={[
        "text-sm font-medium transition-colors",
        active === key ? "text-zinc-900" : "text-zinc-600 hover:text-zinc-900",
      ].join(" ")}
    >
      {label}
    </Link>
  );

  return (
    <div className="min-h-dvh bg-gradient-to-b from-sky-50/80 via-zinc-50 to-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-30 border-b border-zinc-200/60 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Trip Connect
          </Link>
          <nav className="hidden items-center gap-6 sm:flex">
            {navLink("/features", "features", "Features")}
            {navLink("/pricing", "pricing", "Pricing")}
            {navLink("/demo", "demo", "Demo")}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 sm:inline-flex"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white"
            >
              Create account
            </Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Trip Connect</p>
            <p className="mt-1 text-sm text-zinc-600">
              The school trip booklet, rebuilt for phones.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-zinc-600">
            <Link href="/features" className="hover:text-zinc-900">
              Features
            </Link>
            <Link href="/pricing" className="hover:text-zinc-900">
              Pricing
            </Link>
            <Link href="/demo" className="hover:text-zinc-900">
              Demo
            </Link>
            <Link href="/login" className="hover:text-zinc-900">
              Log in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
