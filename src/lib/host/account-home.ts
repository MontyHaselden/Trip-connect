/** Home city and default airport copied from host account onto new trips. */
export type HostHomeDefaults = {
  homeCity: string;
  defaultAirport: string;
  schoolName?: string | null;
};

export function tripHomeDefaultsFromAccount(account: HostHomeDefaults): {
  departureCity: string;
  returnCity: string;
  defaultDepartureAirport: string | null;
  schoolName?: string;
} {
  const home = account.homeCity.trim();
  const airport = account.defaultAirport.trim();
  return {
    departureCity: home,
    returnCity: home,
    defaultDepartureAirport: airport || null,
    schoolName: account.schoolName?.trim() || undefined,
  };
}
