import type { ReactNode } from "react";

type KpiProps = {
  title: string;
  value: ReactNode;
};

export function Kpi({ title, value }: KpiProps) {
  return (
    <div style={{ background: "white", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
