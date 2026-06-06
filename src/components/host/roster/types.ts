export type RosterParticipant = {
  id: string;
  fullName: string;
  phoneNumberE164: string;
  role: "student" | "helper" | "teacher" | "host";
  hasPassword?: boolean;
  roomId: string | null;
  groupIds: string[];
};

export type RosterRoom = {
  id: string;
  roomName: string;
  hotelName: string | null;
  hotelAddress: string | null;
  nearestStation: string | null;
  notes: string | null;
  sortOrder: number;
};

export type RosterGroup = {
  id: string;
  name: string;
  type: "activity" | "bus" | "week" | "other";
  description: string | null;
  sortOrder: number;
};

export type RosterPayload = {
  participants: RosterParticipant[];
  rooms: RosterRoom[];
  groups: RosterGroup[];
};
