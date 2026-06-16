"use client";

import { useMemo, useState, type ReactNode } from "react";

import { formatNightPairLabel } from "@/lib/host/setup/night-pair-selection";
import { staysForGroup } from "@/lib/trip-engine/selectors";
import type { TripCommand } from "@/lib/trip-engine/commands";
import type {
  CalendarRenderModel,
  EngineConflict,
  TripEntityGraph,
} from "@/lib/trip-engine/types";
import { newId } from "@/lib/host/wizard/types";

import type { CalendarSelection } from "./calendar/useCalendarInteraction";
import { daysInSelection } from "./calendar/useCalendarInteraction";

type FormKind = "location" | "stay" | "transport" | "activity" | null;

export function CalendarContextPanel(props: {
  graph: TripEntityGraph;
  groupId: string;
  model: CalendarRenderModel;
  selection: CalendarSelection;
  conflicts: EngineConflict[];
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
  onClearSelection: () => void;
}) {
  const { selection, model, graph, groupId } = props;
  const [form, setForm] = useState<FormKind>(null);
  const [tab, setTab] = useState<"add" | "overview">("add");

  const rangeStart = selection.rangeStart;
  const rangeEnd = selection.rangeEnd || rangeStart;
  const rangeLabel = rangeStart ? formatNightPairLabel(selection) : "";

  const selectedDays = useMemo(
    () => daysInSelection(selection, model.projectedDays.map((d) => ({
      date: d.date,
      primaryCity: d.primaryCity,
      secondaryCity: d.secondaryCity,
      primaryShare: d.primaryShare,
      dayType: d.dayType,
      includeBuffer: false,
    }))),
    [selection, model.projectedDays],
  );

  const projectedSlice = useMemo(() => {
    if (!rangeStart) return [];
    return model.projectedDays.filter((d) => d.date >= rangeStart && d.date <= rangeEnd);
  }, [model.projectedDays, rangeStart, rangeEnd]);

  const rangeConflicts = useMemo(() => {
    if (!rangeStart) return [];
    return props.conflicts.filter(
      (c) => !c.date || (c.date >= rangeStart && c.date <= rangeEnd),
    );
  }, [props.conflicts, rangeStart, rangeEnd]);

  const hasPaint = selectedDays.some(
    (d) => d.primaryCity.trim() || d.secondaryCity?.trim(),
  );
  const hasStay = model.accommodationStays.some(
    (s) => s.checkInDate <= rangeEnd && s.checkOutDate >= rangeStart,
  );
  const isTransport = selection.intent === "transport";

  const [location, setLocation] = useState("");
  const [stayName, setStayName] = useState("");
  const [stayCity, setStayCity] = useState("");
  const [fromCity, setFromCity] = useState(
    projectedSlice[0]?.primaryCity || graph.basics.departureCity || "",
  );
  const [toCity, setToCity] = useState("");
  const [travelDate, setTravelDate] = useState(rangeStart);
  const [depart, setDepart] = useState("");
  const [arrive, setArrive] = useState("");
  const [flight, setFlight] = useState("");
  const [actTitle, setActTitle] = useState("");
  const [actTime, setActTime] = useState("10:00");
  const [actLocation, setActLocation] = useState("");

  if (!rangeStart) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">
        Select days on the calendar to add locations, stays, transport, or activities.
      </div>
    );
  }

  async function paintLocation() {
    if (!location.trim()) return;
    const ok = await props.onDispatch([
      {
        type: "paintDayRange",
        groupId,
        rangeStart,
        rangeEnd,
        location: location.trim(),
        startHalf: selection.startHalf,
        endHalf: selection.endHalf,
      },
    ]);
    if (ok) {
      setLocation("");
      setForm(null);
    }
  }

  async function addStay() {
    if (!stayName.trim()) return;
    const ok = await props.onDispatch([
      {
        type: "addStay",
        groupId,
        stay: {
          id: newId(),
          cityLabel: stayCity.trim() || stayName.trim(),
          stayType: "hotel",
          name: stayName.trim(),
          url: null,
          address: null,
          phone: null,
          checkInDate: rangeStart,
          checkOutDate: rangeEnd,
          notes: null,
          isHomestayGroup: false,
          multipleInCity: false,
        },
      },
    ]);
    if (ok) {
      setStayName("");
      setStayCity("");
      setForm(null);
    }
  }

  async function addTransport() {
    if (!travelDate || !fromCity.trim() || !toCity.trim()) return;
    const ok = await props.onDispatch([
      {
        type: "addTransportLeg",
        groupId,
        bucket: "intercity",
        leg: {
          id: newId(),
          transportType: "plane",
          bookingStatus: "not_booked",
          travelDate,
          arrivalDate: travelDate,
          departureTime: depart || null,
          arrivalTime: arrive || null,
          fromCity: fromCity.trim(),
          toCity: toCity.trim(),
          fromStation: fromCity.trim(),
          toStation: toCity.trim(),
          operator: null,
          referenceNumber: null,
          flightNumber: flight.trim() || null,
          notes: null,
          intercityFromCity: fromCity.trim(),
          intercityToCity: toCity.trim(),
          originGroupId: groupId,
        },
      },
    ]);
    if (ok) setForm(null);
  }

  async function addActivity() {
    if (!actTitle.trim()) return;
    const ok = await props.onDispatch([
      {
        type: "addActivity",
        groupId,
        activity: {
          id: newId(),
          title: actTitle.trim(),
          date: rangeStart,
          endDate: rangeStart !== rangeEnd ? rangeEnd : null,
          startTime: actTime,
          endTime: null,
          isTimeTbc: false,
          category: "activity",
          locationName: actLocation.trim() || null,
          address: null,
          isLocationTbc: !actLocation.trim(),
          transportNote: null,
          leaveByTime: null,
          bringNote: null,
          description: null,
          audienceType: "everyone",
          audienceId: null,
          bookingStatus: "not_booked",
        },
      },
    ]);
    if (ok) {
      setActTitle("");
      setForm(null);
    }
  }

  async function clearRange() {
    if (!window.confirm(`Clear content for ${rangeLabel}?`)) return;
    await props.onDispatch([
      { type: "clearDayRange", groupId, rangeStart, rangeEnd },
    ]);
    props.onClearSelection();
  }

  const stays = staysForGroup(graph, groupId).filter(
    (s) => s.checkInDate <= rangeEnd && s.checkOutDate >= rangeStart,
  );
  const legs = [
    ...graph.outboundLegs,
    ...graph.returnLegs,
    ...graph.intercityLegs,
  ].filter((l) => l.travelDate >= rangeStart && l.travelDate <= rangeEnd);
  const activities = graph.activities.filter(
    (a) => a.date >= rangeStart && a.date <= (a.endDate || a.date) && a.date <= rangeEnd,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Calendar selection</h2>
          <p className="text-sm text-zinc-600">{rangeLabel}</p>
        </div>
        <button
          type="button"
          onClick={props.onClearSelection}
          className="text-sm text-zinc-600 hover:underline"
        >
          Dismiss
        </button>
      </div>

      {projectedSlice.length ? (
        <ul className="space-y-1 rounded-lg border border-zinc-100 bg-zinc-50 p-3 text-sm">
          {projectedSlice.map((d) => (
            <li key={d.date}>
              <span className="font-medium">{d.date}</span>
              {d.primaryCity ? ` · ${d.primaryCity}` : ""}
              {d.secondaryCity ? ` / ${d.secondaryCity}` : ""}
              {d.accommodationLabel ? ` · ${d.accommodationLabel}` : ""}
            </li>
          ))}
        </ul>
      ) : null}

      {rangeConflicts.length ? (
        <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          {rangeConflicts.map((c) => (
            <li key={c.id}>{c.message}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex gap-2 border-b border-zinc-200 pb-2">
        <button
          type="button"
          onClick={() => setTab("add")}
          className={`text-sm font-medium ${tab === "add" ? "text-zinc-900" : "text-zinc-500"}`}
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => setTab("overview")}
          className={`text-sm font-medium ${tab === "overview" ? "text-zinc-900" : "text-zinc-500"}`}
        >
          Overview
        </button>
      </div>

      {tab === "add" ? (
        <div className="space-y-4">
          <p className="text-sm text-zinc-600">What do you want to add?</p>
          <div className="flex flex-wrap gap-2">
            <ActionButton label="Paint location" onClick={() => setForm("location")} />
            <ActionButton label="Add stay" onClick={() => setForm("stay")} />
            {(isTransport || !hasPaint) && (
              <ActionButton label="Add transport" onClick={() => setForm("transport")} />
            )}
            <ActionButton label="Add activity" onClick={() => setForm("activity")} />
            {(hasPaint || hasStay) && (
              <ActionButton label="Clear range" onClick={() => void clearRange()} variant="danger" />
            )}
          </div>

          {form === "location" ? (
            <MiniForm title="Paint location" onSubmit={() => void paintLocation()}>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City name"
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </MiniForm>
          ) : null}

          {form === "stay" ? (
            <MiniForm title="Add stay" onSubmit={() => void addStay()}>
              <input
                value={stayName}
                onChange={(e) => setStayName(e.target.value)}
                placeholder="Property name"
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
              <input
                value={stayCity}
                onChange={(e) => setStayCity(e.target.value)}
                placeholder="City"
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
              <p className="text-xs text-zinc-500">
                Check-in {rangeStart} · check-out {rangeEnd}
              </p>
            </MiniForm>
          ) : null}

          {form === "transport" ? (
            <MiniForm title="Add transport leg" onSubmit={() => void addTransport()}>
              <div className="grid gap-2 sm:grid-cols-2">
                <input type="date" value={travelDate} onChange={(e) => setTravelDate(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" />
                <input value={flight} onChange={(e) => setFlight(e.target.value)} placeholder="Flight #" className="rounded-lg border px-3 py-2 text-sm" />
                <input value={fromCity} onChange={(e) => setFromCity(e.target.value)} placeholder="From" className="rounded-lg border px-3 py-2 text-sm" />
                <input value={toCity} onChange={(e) => setToCity(e.target.value)} placeholder="To" className="rounded-lg border px-3 py-2 text-sm" />
                <input value={depart} onChange={(e) => setDepart(e.target.value)} placeholder="Depart time" className="rounded-lg border px-3 py-2 text-sm" />
                <input value={arrive} onChange={(e) => setArrive(e.target.value)} placeholder="Arrive time" className="rounded-lg border px-3 py-2 text-sm" />
              </div>
            </MiniForm>
          ) : null}

          {form === "activity" ? (
            <MiniForm title="Add activity" onSubmit={() => void addActivity()}>
              <input value={actTitle} onChange={(e) => setActTitle(e.target.value)} placeholder="Title" className="w-full rounded-lg border px-3 py-2 text-sm" />
              <input value={actTime} onChange={(e) => setActTime(e.target.value)} placeholder="Start time" className="w-full rounded-lg border px-3 py-2 text-sm" />
              <input value={actLocation} onChange={(e) => setActLocation(e.target.value)} placeholder="Location (optional)" className="w-full rounded-lg border px-3 py-2 text-sm" />
            </MiniForm>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          {stays.length ? (
            <EntityList
              title="Stays"
              items={stays.map((s) => `${s.name || "Stay"} · ${s.checkInDate} → ${s.checkOutDate}`)}
              onDelete={(i) =>
                props.onDispatch([{ type: "removeStay", groupId, stayId: stays[i].id }])
              }
            />
          ) : null}
          {legs.length ? (
            <EntityList
              title="Transport"
              items={legs.map((l) => `${l.travelDate} · ${"fromCity" in l ? l.fromCity : ""} → ${"toCity" in l ? l.toCity : ""}`)}
              onDelete={(i) =>
                props.onDispatch([
                  {
                    type: "removeTransportLeg",
                    groupId,
                    bucket: graph.intercityLegs.some((x) => x.id === legs[i].id)
                      ? "intercity"
                      : graph.outboundLegs.some((x) => x.id === legs[i].id)
                        ? "outbound"
                        : "return",
                    legId: legs[i].id,
                  },
                ])
              }
            />
          ) : null}
          {activities.length ? (
            <EntityList
              title="Activities"
              items={activities.map((a) => `${a.date} · ${a.title}`)}
              onDelete={(i) =>
                props.onDispatch([
                  { type: "removeActivity", groupId, activityId: activities[i].id },
                ])
              }
            />
          ) : null}
          {!stays.length && !legs.length && !activities.length ? (
            <p className="text-zinc-500">Nothing saved in this range yet.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ActionButton(props: {
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
        props.variant === "danger"
          ? "border-red-200 text-red-800 hover:bg-red-50"
          : "border-zinc-200 hover:bg-zinc-50"
      }`}
    >
      {props.label}
    </button>
  );
}

function MiniForm(props: {
  title: string;
  children: ReactNode;
  onSubmit: () => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4">
      <h3 className="text-sm font-semibold">{props.title}</h3>
      <div className="mt-3 space-y-2">{props.children}</div>
      <button
        type="button"
        onClick={props.onSubmit}
        className="mt-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
      >
        Save
      </button>
    </div>
  );
}

function EntityList(props: {
  title: string;
  items: string[];
  onDelete: (index: number) => void;
}) {
  return (
    <div>
      <h3 className="font-medium">{props.title}</h3>
      <ul className="mt-2 space-y-1">
        {props.items.map((label, i) => (
          <li key={label} className="flex items-center justify-between rounded border border-zinc-100 px-2 py-1">
            <span>{label}</span>
            <button type="button" onClick={() => props.onDelete(i)} className="text-red-700 hover:underline">
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
