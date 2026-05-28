"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function NavItem(props: {
  href: string;
  label: string;
  active: boolean;
}) {
  const { href, label, active } = props;
  return (
    <Link
      href={href}
      className={[
        "flex flex-1 items-center justify-center rounded-xl px-3 py-2 text-sm font-medium",
        active ? "bg-zinc-900 text-white" : "text-zinc-700",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export function StudentBottomNav() {
  const pathname = usePathname();
  const onToday = pathname === "/app/today";
  const onMyTrip = pathname === "/app/my-trip";

  return (
    <nav className="sticky bottom-0 z-10 mt-auto bg-zinc-50 pb-[max(env(safe-area-inset-bottom),0px)]">
      <div className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
        <div className="flex gap-2">
          <NavItem href="/app/today" label="Today" active={onToday} />
          <NavItem href="/app/my-trip" label="My Trip" active={onMyTrip} />
        </div>
      </div>
    </nav>
  );
}

