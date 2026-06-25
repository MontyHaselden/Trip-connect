import Link from "next/link";

import { DEFAULT_SUPPORT_EMAIL, LEGAL_OPERATOR, PRODUCT_NAME } from "@/lib/brand";

export function MarketingShell(props: {
  children: React.ReactNode;
  active?: "home" | "features" | "pricing" | "demo" | "contact";
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
    <div className="min-h-dvh bg-gradient-to-b from-sky-50/60 via-white to-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-30 border-b border-zinc-200/60 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-zinc-900">
            {PRODUCT_NAME}
          </Link>
          <nav className="hidden items-center gap-6 sm:flex">
            {navLink("/features", "features", "Features")}
            {navLink("/pricing", "pricing", "Pricing")}
            {navLink("/demo", "demo", "Example trip")}
            {navLink("/contact", "contact", "Contact")}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:text-zinc-900 sm:inline-flex"
            >
              Log in
            </Link>
            <Link
              href="/signup?type=school"
              className="inline-flex h-9 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Create school account
            </Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-semibold">{PRODUCT_NAME}</p>
              <p className="mt-1 max-w-sm text-sm text-zinc-600">
                Live trip operations for schools. One itinerary — staff, students, and parents always
                on the latest version.
              </p>
              <p className="mt-2 text-xs text-zinc-500">{LEGAL_OPERATOR}</p>
              <p className="mt-1 text-xs text-zinc-500">
                <a href={`mailto:${DEFAULT_SUPPORT_EMAIL}`} className="hover:text-zinc-800">
                  {DEFAULT_SUPPORT_EMAIL}
                </a>
              </p>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-zinc-600">
              <Link href="/features" className="hover:text-zinc-900">
                Features
              </Link>
              <Link href="/pricing" className="hover:text-zinc-900">
                Pricing
              </Link>
              <Link href="/demo" className="hover:text-zinc-900">
                Example trip
              </Link>
              <Link href="/contact" className="hover:text-zinc-900">
                Contact
              </Link>
              <Link href="/terms" className="hover:text-zinc-900">
                Terms
              </Link>
              <Link href="/privacy" className="hover:text-zinc-900">
                Privacy
              </Link>
              <Link href="/login" className="hover:text-zinc-900">
                Log in
              </Link>
              <Link href="/signup?type=school" className="font-medium hover:text-zinc-900">
                Create school account
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
