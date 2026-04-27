import type { ReactNode } from "react";

type KpiProps = {
  title: string;
  value: ReactNode;
};

export function Kpi({ title, value }: KpiProps) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 12,
        padding: "clamp(12px, 3vw, 16px)",
      }}
    >
      <div
        style={{
          fontSize: "clamp(12px, 2.5vw, 13px)",
          color: "#64748b",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: "clamp(18px, 4vw, 22px)", fontWeight: 600 }}>
        {value}
      </div>
    </div>
  );
}
