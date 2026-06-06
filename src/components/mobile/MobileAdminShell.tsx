"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function MobileAdminShell(props: {
  tripId: string;
  tripName: string;
  children: React.ReactNode;
}) {
  const { tripId, tripName, children } = props;
  const pathname = usePathname();
  const base = `/mobile/admin/trip/${tripId}`;

  const tabs = [
    { href: `${base}/people`, label: "People" },
    { href: `${base}/accommodation`, label: "Rooms" },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Trip admin
        </p>
        <h1 className="truncate text-lg font-semibold">{tripName}</h1>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto p-4">{children}</main>
      <nav className="flex border-t border-zinc-200 bg-white">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={[
              "flex-1 py-3 text-center text-sm font-medium",
              pathname.startsWith(tab.href)
                ? "text-zinc-900"
                : "text-zinc-500",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
