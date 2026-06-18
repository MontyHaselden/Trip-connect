"use client";

import { useStudentOverlay } from "@/components/student/StudentOverlayContext";
import { resolveEmergencyHelpPhrase } from "@/lib/student/emergency-phrase";
import { studentOverlayRootClass } from "@/lib/student/overlay-classes";

export type EmergencyAccommodation = {
  name: string | null;
  address: string | null;
  phone: string | null;
  nearestStation: string | null;
  nearestStationNotes: string | null;
  nearestBusStopName: string | null;
  routeNotes: string | null;
  mapsUrl: string | null;
  staticMapUrl: string | null;
};

export function EmergencyCardFullView(props: {
  open: boolean;
  onClose: () => void;
  tripName: string;
  schoolName: string;
  studentName: string;
  localEmergencyNumber?: string | null;
  schoolEmergencyPhone?: string | null;
  emergencyContacts: Array<{ name: string; role: string; phoneNumber: string }>;
  accommodation: EmergencyAccommodation | null;
  phraseCategories: Array<{ id: string; name: string }>;
  phrases: Array<{
    categoryId: string;
    englishText: string;
    translatedText: string;
    pronunciation: string | null;
    sortOrder: number;
  }>;
}) {
  const {
    open,
    onClose,
    tripName,
    schoolName,
    studentName,
    localEmergencyNumber,
    schoolEmergencyPhone,
    emergencyContacts,
    accommodation,
    phraseCategories,
    phrases,
  } = props;
  const { contained } = useStudentOverlay();

  if (!open) return null;

  const helpPhrase = resolveEmergencyHelpPhrase(phraseCategories, phrases);

  return (
    <div className={`${studentOverlayRootClass(contained, { zClass: "z-[80]", align: "full" })} bg-[var(--student-bg)]`}>
      <div className="shrink-0 border-b border-red-200 bg-gradient-to-b from-red-50 to-[var(--student-bg)] px-5 pb-4 pt-[max(env(safe-area-inset-top),1rem)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-red-800/70">
              Safety
            </p>
            <h1 className="mt-1 text-xl font-bold text-red-950">Emergency card</h1>
            <p className="mt-1 text-sm text-red-900/80">Show this if you need help</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="student-btn-secondary shrink-0 px-4 py-2 text-sm"
          >
            Close
          </button>
        </div>
      </div>

      <div className="student-app-scroll no-scrollbar flex-1 overflow-y-auto overscroll-y-contain px-5 py-4">
        <div className="space-y-4 text-sm text-[var(--student-text)]">
          <div className="student-menu-group p-4">
            <div>
              <div className="text-xs text-[var(--student-text-muted)]">Trip</div>
              <div className="mt-0.5 font-semibold">{tripName}</div>
            </div>
            <div className="mt-3">
              <div className="text-xs text-[var(--student-text-muted)]">School</div>
              <div className="mt-0.5 font-semibold">{schoolName}</div>
            </div>
            <div className="mt-3">
              <div className="text-xs text-[var(--student-text-muted)]">Student</div>
              <div className="mt-0.5 font-semibold">{studentName}</div>
            </div>
          </div>

          {accommodation ? (
            <div className="student-menu-group p-4">
              <div className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--student-text-muted)]">
                Tonight&apos;s accommodation
              </div>
              <div className="mt-2 font-semibold">{accommodation.name ?? "—"}</div>
              {accommodation.address ? (
                <p className="mt-1 text-[var(--student-text-muted)]">{accommodation.address}</p>
              ) : null}
              {accommodation.phone ? (
                <a
                  href={`tel:${accommodation.phone}`}
                  className="mt-2 inline-block font-semibold text-[var(--student-nav)]"
                >
                  {accommodation.phone}
                </a>
              ) : null}
              {accommodation.nearestStation ? (
                <p className="mt-3 text-xs text-[var(--student-text-muted)]">
                  Nearest station: {accommodation.nearestStation}
                  {accommodation.nearestStationNotes
                    ? ` — ${accommodation.nearestStationNotes}`
                    : ""}
                </p>
              ) : null}
              {accommodation.nearestBusStopName ? (
                <p className="mt-1 text-xs text-[var(--student-text-muted)]">
                  Nearest bus stop: {accommodation.nearestBusStopName}
                </p>
              ) : null}
              {accommodation.routeNotes ? (
                <p className="mt-2 text-xs leading-relaxed text-[var(--student-text)]">
                  {accommodation.routeNotes}
                </p>
              ) : null}
              {accommodation.staticMapUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={accommodation.staticMapUrl}
                  alt="Route to accommodation"
                  className="mt-3 w-full rounded-xl border border-[var(--student-line)]"
                />
              ) : null}
              {accommodation.mapsUrl ? (
                <a
                  href={accommodation.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex font-semibold text-[var(--student-nav)] underline decoration-[var(--student-line)] underline-offset-2"
                >
                  Open in Maps
                </a>
              ) : null}
            </div>
          ) : null}

          {emergencyContacts.length ? (
            <div className="student-menu-group p-4">
              <div className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--student-text-muted)]">
                Call teacher
              </div>
              <ul className="mt-2 space-y-3">
                {emergencyContacts.map((c) => (
                  <li key={`${c.name}-${c.phoneNumber}`}>
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-xs text-[var(--student-text-muted)]">{c.role}</div>
                    <a
                      href={`tel:${c.phoneNumber}`}
                      className="mt-1 inline-block font-semibold text-[var(--student-nav)]"
                    >
                      {c.phoneNumber}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {schoolEmergencyPhone ? (
            <div className="student-menu-group p-4">
              <div className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--student-text-muted)]">
                School emergency contact
              </div>
              <a
                href={`tel:${schoolEmergencyPhone}`}
                className="mt-2 inline-block text-base font-semibold text-[var(--student-nav)]"
              >
                {schoolEmergencyPhone}
              </a>
            </div>
          ) : null}

          {localEmergencyNumber ? (
            <div className="student-menu-group p-4">
              <div className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--student-text-muted)]">
                Local emergency number
              </div>
              <a
                href={`tel:${localEmergencyNumber}`}
                className="mt-2 inline-block text-base font-semibold text-[var(--student-nav)]"
              >
                {localEmergencyNumber}
              </a>
            </div>
          ) : null}

          {helpPhrase ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-950">
              <div className="text-xs font-bold uppercase tracking-[0.06em] text-red-800/80">
                Show this phrase
              </div>
              <p className="mt-2 text-sm font-medium">{helpPhrase.englishText}</p>
              <p className="mt-2 text-lg font-bold leading-snug">{helpPhrase.translatedText}</p>
              {helpPhrase.pronunciation ? (
                <p className="mt-2 text-sm text-red-900/80">{helpPhrase.pronunciation}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
