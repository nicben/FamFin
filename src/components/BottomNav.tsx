type Tab = "overview" | "transactions" | "tags" | "settings";

type BottomNavProps = {
  active: Tab;
  onChange: (tab: Tab) => void;
};

export function BottomNav({ active, onChange }: BottomNavProps) {
  const items: { id: Tab; label: string; icon: string }[] = [
    { id: "overview", label: "Oversikt", icon: "🏠" },
    { id: "transactions", label: "Poster", icon: "📄" },
    { id: "tags", label: "Tagger", icon: "🏷️" },
    { id: "settings", label: "Innst.", icon: "⚙️" },
  ];

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: "env(safe-area-inset-bottom)",
        background: "#ffffff",
        borderTop: "1px solid #e5e7eb",
        display: "flex",
        justifyContent: "space-around",
        zIndex: 50,
      }}
    >
      {items.map((item) => {
        const activeItem = active === item.id;

        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            style={{
              flex: 1,
              padding: "10px 0",
              background: "none",
              border: "none",
              fontSize: 12,
              color: activeItem ? "#6d3a7c" : "#6b7280",
              fontWeight: activeItem ? 600 : 500,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
