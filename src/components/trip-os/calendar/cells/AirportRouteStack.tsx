export function AirportRouteStack({ codes }: { codes: string[] }) {
  return (
    <div className="flex flex-col items-center justify-center gap-px py-1">
      {codes.map((code, i) => (
        <span key={`${code}-${i}`} className="text-[8px] font-bold leading-none text-zinc-700">
          {code}
        </span>
      ))}
    </div>
  );
}
