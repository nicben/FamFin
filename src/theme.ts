type AppTheme = {
  color: {
    bg: string;
    card: string;
    primary: string;
    primarySoft: string;
    text: string;
    muted: string;
    danger: string;
    success: string;
    tagBg: string;
    tagText: string;
    incomeBg: string;
    incomeText: string;
    incomeSubText: string;
    expenseBg: string;
    rowAlt: string;
    rowBorder: string;
    drillBorder: string;
    progressTrack: string;
    inputBorder: string;
    navBg: string;
    navBorder: string;
  };
  radius: { card: number; pill: number };
  shadow: { card: string };
};

export const lightTheme: AppTheme = {
  color: {
    bg: "#f6f5f9",
    card: "#ffffff",
    primary: "#6d3a7c",
    primarySoft: "#f1eaf4",
    text: "#1f2937",
    muted: "#6b7280",
    danger: "#dc2626",
    success: "#16a34a",
    tagBg: "#e0e7ff",
    tagText: "#3730a3",
    incomeBg: "#f0fdf4",
    incomeText: "#16a34a",
    incomeSubText: "#15803d",
    expenseBg: "#fef2f2",
    rowAlt: "#faf5fc",
    rowBorder: "#f3f4f6",
    drillBorder: "#f0e6f4",
    progressTrack: "#f3f4f6",
    inputBorder: "#ddd",
    navBg: "#ffffff",
    navBorder: "#e5e7eb",
  },
  radius: { card: 16, pill: 999 },
  shadow: { card: "0 8px 24px rgba(0,0,0,0.06)" },
};

export const darkTheme: AppTheme = {
  color: {
    bg: "#0f1117",
    card: "#1a1d27",
    primary: "#a855f7",
    primarySoft: "#2d1f3d",
    text: "#e5e7eb",
    muted: "#9ca3af",
    danger: "#f87171",
    success: "#4ade80",
    tagBg: "#1e1b4b",
    tagText: "#a5b4fc",
    incomeBg: "#052e16",
    incomeText: "#4ade80",
    incomeSubText: "#4ade80",
    expenseBg: "#450a0a",
    rowAlt: "#1e2030",
    rowBorder: "#2d3748",
    drillBorder: "#3d2048",
    progressTrack: "#374151",
    inputBorder: "#374151",
    navBg: "#1a1d27",
    navBorder: "#2d3748",
  },
  radius: { card: 16, pill: 999 },
  shadow: { card: "0 8px 24px rgba(0,0,0,0.3)" },
};

// backward compat
export const theme = lightTheme;
