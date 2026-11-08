import type { StampIconName } from "@/lib/types";

export const STAMP_ICONS: { id: StampIconName; label: string }[] = [
  { id: "cafe", label: "Café" },
  { id: "estrella", label: "Estrella" },
  { id: "corazon", label: "Corazón" },
  { id: "cubiertos", label: "Cubiertos" },
  { id: "pan", label: "Pan" },
  { id: "taco", label: "Taco" },
  { id: "hoja", label: "Hoja" },
  { id: "regalo", label: "Regalo" },
];

const PATHS: Record<StampIconName, string[]> = {
  cafe: ["M4 9h12v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9z", "M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16", "M7 3.5v2.5", "M10 3.5v2.5", "M13 3.5v2.5", "M3 21h15"],
  estrella: ["M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"],
  corazon: ["M12 20s-7.5-4.6-9.2-9.4A4.7 4.7 0 0 1 12 6.8a4.7 4.7 0 0 1 9.2 3.8C19.5 15.4 12 20 12 20z"],
  cubiertos: ["M7 3v7", "M4.5 3v5a2.5 2.5 0 0 0 5 0V3", "M7 10.5V21", "M17.5 21V3c-2.2.8-3.5 3.2-3.5 6.5V14h3.5"],
  pan: ["M6 11.5A4 4 0 0 1 6 4h12a4 4 0 0 1 0 7.5V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z", "M10 8v3", "M14 8v3"],
  taco: ["M2.5 18a9.5 9.5 0 0 1 19 0z", "M6 13.5l1.5-1.5", "M10.5 11l1.5-1.5", "M15.5 13l1.5-1.5"],
  hoja: ["M5 19C5 10 11 5 20 4c0 9-5 15-14 15", "M5 19l8.5-8.5"],
  regalo: ["M4 11h16v9H4z", "M3 7.5h18V11H3z", "M12 7.5V20", "M12 7.5C10.5 4.5 7 4 7 6s3 1.5 5 1.5c2 0 5 .5 5-1.5s-3.5-1.5-5 1.5"],
};

export function StampIcon({ name, className, strokeWidth = 1.8 }: { name: StampIconName | string; className?: string; strokeWidth?: number }) {
  const paths = PATHS[(name as StampIconName) in PATHS ? (name as StampIconName) : "estrella"];
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round"
      strokeLinejoin="round" className={className} aria-hidden="true">
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}
