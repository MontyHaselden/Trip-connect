import type { BookingStatus, TransportType } from "./types";

export type DbBookingStatus = "booked" | "not_booked" | "placeholder";
export type DbTransportType = Exclude<TransportType, "unsure">;

/** Map wizard-only booking statuses to DB enum values. */
export function toDbBookingStatus(status: BookingStatus): DbBookingStatus {
  if (status === "flexible") return "placeholder";
  return status;
}

/** Map wizard-only transport types to DB enum values. */
export function toDbTransportType(type: TransportType): DbTransportType {
  if (type === "unsure") return "other";
  return type;
}
