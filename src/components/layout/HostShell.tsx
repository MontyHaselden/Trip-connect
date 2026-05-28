"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

function NavLink(props: {
  href: string;
  label: string;
  active: boolean;
}) {
  const { href, label, active } = props;
  return (
    <Link
      href={href}
      className={[
        "rounded-lg px-3 py-2 text-sm font-medium",
        active ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export function HostShell(props: {
  inviteCode: string;
  children: React.ReactNode;
}) {
  const { inviteCode, children } = props;
  const pathname = usePathname();
  const router = useRouter();
  const base = `/host/${encodeURIComponent(inviteCode)}`;

  async function onLogout() {
    await fetch(`/api/host/${encodeURIComponent(inviteCode)}/logout`, {
      method: "POST",
    });
    router.replace(base);
  }

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Trip Connect Host
            </p>
            <p className="text-sm text-zinc-600">Invite: {inviteCode}</p>
          </div>
          <nav className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-1">
            <NavLink
              href={`${base}/dashboard`}
              label="Dashboard"
              active={pathname === `${base}/dashboard`}
            />
            <NavLink
              href={`${base}/itinerary`}
              label="Itinerary"
              active={pathname === `${base}/itinerary`}
            />
            <NavLink
              href={`${base}/participants`}
              label="Participants"
              active={pathname === `${base}/participants`}
            />
            <NavLink
              href={`${base}/contacts`}
              label="Contacts"
              active={pathname === `${base}/contacts`}
            />
            <NavLink
              href={`${base}/phrases`}
              label="Phrases"
              active={pathname === `${base}/phrases`}
            />
            <NavLink
              href={`${base}/settings`}
              label="Settings"
              active={pathname === `${base}/settings`}
            />
            <NavLink
              href={`${base}/publish`}
              label="Publish"
              active={pathname === `${base}/publish`}
            />
            <button
              type="button"
              onClick={onLogout}
              className="ml-1 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
            >
              Log out
            </button>
          </nav>
        </div>
      </header>
      <div className="mx-auto w-full max-w-3xl px-5 py-6">{children}</div>
    </div>
  );
}
