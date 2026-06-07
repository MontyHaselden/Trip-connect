"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/accounts", label: "Accounts" },
  { href: "/admin/plans", label: "Plans" },
  { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/invoices", label: "Invoices" },
  { href: "/admin/trips", label: "Trips" },
  { href: "/admin/usage", label: "Usage" },
  { href: "/admin/payshare", label: "PayShare" },
  { href: "/admin/xero", label: "Xero" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/audit-log", label: "Audit log" },
];

export function AdminShell(props: {
  children: React.ReactNode;
  adminName: string;
  adminRole: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-4 py-4">
          <p className="text-sm font-semibold text-zinc-900">Trip Connect</p>
          <p className="text-xs text-zinc-500">Admin</p>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {NAV.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "block rounded-lg px-3 py-2 text-sm",
                  active
                    ? "bg-zinc-900 font-medium text-white"
                    : "text-zinc-700 hover:bg-zinc-100",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-zinc-200 p-4">
          <p className="truncate text-sm font-medium text-zinc-900">
            {props.adminName}
          </p>
          <p className="text-xs text-zinc-500">{props.adminRole}</p>
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-2 text-xs text-zinc-600 underline"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6">{props.children}</main>
    </div>
  );
}
