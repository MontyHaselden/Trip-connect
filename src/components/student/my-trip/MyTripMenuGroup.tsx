"use client";

import type { ReactNode } from "react";

export function MyTripMenuGroup(props: { children: ReactNode }) {
  return <div className="student-menu-group">{props.children}</div>;
}
