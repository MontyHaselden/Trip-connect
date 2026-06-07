"use client";

import { useEffect } from "react";

let viewportLockCount = 0;

function applyViewportLock() {
  document.documentElement.classList.add("student-app-viewport-lock");
  document.body.classList.add("student-app-viewport-lock");
}

function releaseViewportLock() {
  document.documentElement.classList.remove("student-app-viewport-lock");
  document.body.classList.remove("student-app-viewport-lock");
}

/** Prevent document rubber-banding; only designated panels scroll inside the student app. */
export function useStudentViewportLock() {
  useEffect(() => {
    viewportLockCount += 1;
    if (viewportLockCount === 1) {
      applyViewportLock();
    }

    return () => {
      viewportLockCount -= 1;
      if (viewportLockCount === 0) {
        releaseViewportLock();
      }
    };
  }, []);
}
