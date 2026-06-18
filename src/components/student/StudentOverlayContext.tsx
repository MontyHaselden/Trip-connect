"use client";

import { createContext, useContext, type ReactNode } from "react";

type StudentOverlayContextValue = {
  /** When true, overlays position inside the preview phone frame instead of the viewport. */
  contained: boolean;
};

const StudentOverlayContext = createContext<StudentOverlayContextValue>({
  contained: false,
});

export function StudentOverlayProvider(props: {
  contained?: boolean;
  children: ReactNode;
}) {
  return (
    <StudentOverlayContext.Provider value={{ contained: props.contained ?? false }}>
      {props.children}
    </StudentOverlayContext.Provider>
  );
}

export function useStudentOverlay() {
  return useContext(StudentOverlayContext);
}
