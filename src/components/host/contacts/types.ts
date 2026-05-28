export type HostContact = {
  id: string;
  name: string;
  role: string;
  phoneNumber: string;
  visibility: "students" | "hosts_only";
  sortOrder: number;
  isEmergencyLead: boolean;
};
