import type { ReactNode } from "react";
import { theme } from "../theme";

type KpiProps = {
  title: string;
  value: ReactNode;
};

export function Kpi({ title, value }: KpiProps) {
  return (
    <div
      style={{
        background: theme.color.card,
        borderRadius: theme.radius.card,
        padding: 16,
        boxShadow: theme.shadow.card,
      }}
    >
      <div style={{ fontSize: 13, color: theme.color.muted }}>{title}</div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          marginTop: 6,
          color: theme.color.text,
        }}
      >
        {value}
      </div>
    </div>
  );
}
