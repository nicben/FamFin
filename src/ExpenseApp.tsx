import { useEffect, useMemo, useState } from "react";
import { Kpi } from "./components/Kpi";
import { BottomNav } from "./components/BottomNav";
import { theme } from "./theme";
import {
  extractCategories,
  extractMonths,
  extractParties,
  filterTransactions,
  parseCsvTransactions,
  sumTransactions,
} from "./features/expenses/model";
import type { CategoryFilter, Transaction } from "./features/expenses/model";

const TAGS_STORAGE_KEY = "famfin-transaction-tags";
const TAGS_API_URL = "/api/tags";
const AUTH_STORAGE_KEY = "famfin-auth";
const BUDGET_STORAGE_KEY = "famfin-budget";

const VALID_USERNAME = "BenduVollan";
const VALID_PASSWORD = "qwer1234";

type TagsByTransactionId = Record<string, string[]>;
type BudgetByCategory = Record<string, number>;
type Tab = "overview" | "transactions" | "budget" | "settings";

export default function ExpenseApp() {
  // -----------------------------
  // AUTH
  // -----------------------------
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // -----------------------------
  // DATA
  // -----------------------------
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [month, setMonth] = useState<string | "ALL">("ALL");
  const [party, setParty] = useState("ALL");
  const [tagFilter, setTagFilter] = useState("ALL");

  const [tagsByTransactionId, setTagsByTransactionId] =
    useState<TagsByTransactionId>({});
  const [tagDraftByTransactionId, setTagDraftByTransactionId] = useState<
    Record<string, string>
  >({});
  const [tagInputOpen, setTagInputOpen] = useState<Record<string, boolean>>({});

  const [tagsHydrated, setTagsHydrated] = useState(false);

  const [budget, setBudget] = useState<BudgetByCategory>({});

  const [loadSource, setLoadSource] = useState<"auto" | "manual" | "none">(
    "none",
  );

  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // -----------------------------
  // AUTH EFFECT
  // -----------------------------
  useEffect(() => {
    if (localStorage.getItem(AUTH_STORAGE_KEY)) {
      setIsLoggedIn(true);
    }
  }, []);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (username === VALID_USERNAME && password === VALID_PASSWORD) {
      localStorage.setItem(AUTH_STORAGE_KEY, "ok");
      setIsLoggedIn(true);
    } else {
      setLoginError("Ugyldig brukernavn eller passord");
    }
  }

  function handleLogout() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setIsLoggedIn(false);
    setActiveTab("overview");
  }

  // -----------------------------
  // TAGS LOAD / SAVE
  // -----------------------------
  useEffect(() => {
    let cancelled = false;

    async function loadTags() {
      try {
        const r = await fetch(TAGS_API_URL, { cache: "no-store" });
        if (r.ok) {
          const parsed = (await r.json()) as TagsByTransactionId;
          if (!cancelled) setTagsByTransactionId(parsed);
          return;
        }
      } catch {}

      const local = localStorage.getItem(TAGS_STORAGE_KEY);
      if (!cancelled && local) {
        setTagsByTransactionId(JSON.parse(local));
      }
    }

    loadTags().finally(() => !cancelled && setTagsHydrated(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!tagsHydrated) return;
    const payload = JSON.stringify(tagsByTransactionId);
    localStorage.setItem(TAGS_STORAGE_KEY, payload);
    fetch(TAGS_API_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: payload,
    }).catch(() => {});
  }, [tagsByTransactionId, tagsHydrated]);

  // -----------------------------
  // BUDGET LOAD / SAVE
  // -----------------------------
  useEffect(() => {
    const stored = localStorage.getItem(BUDGET_STORAGE_KEY);
    if (stored) {
      setBudget(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(budget));
  }, [budget]);

  // -----------------------------
  // CSV
  // -----------------------------
  useEffect(() => {
    fetch("/transactions.csv", { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : null))
      .then((text) => {
        if (!text) return;
        const parsed = parseCsvTransactions(text);
        if (parsed.length) {
          setTransactions(parsed);
          setLoadSource("auto");
        }
      })
      .catch(() => {});
  }, []);

  function onCsv(file: File) {
    const r = new FileReader();
    r.onload = () => {
      setTransactions(parseCsvTransactions(String(r.result)));
      setLoadSource("manual");
    };
    r.readAsText(file);
  }

  // -----------------------------
  // TAG ACTIONS
  // -----------------------------
  function updateTagDraft(transactionId: string, value: string): void {
    setTagDraftByTransactionId((prev) => ({ ...prev, [transactionId]: value }));
  }

  function addTag(transactionId: string, tagRaw: string): void {
    const tag = tagRaw.trim().toLowerCase();
    if (!tag) return;
    setTagsByTransactionId((prev) => {
      const current = prev[transactionId] ?? [];
      if (current.includes(tag)) return prev;
      return { ...prev, [transactionId]: [...current, tag] };
    });
    setTagDraftByTransactionId((prev) => ({ ...prev, [transactionId]: "" }));
  }

  function removeTag(transactionId: string, tag: string): void {
    setTagsByTransactionId((prev) => {
      const nextTags = (prev[transactionId] ?? []).filter((t) => t !== tag);
      if (nextTags.length === 0) {
        const { [transactionId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [transactionId]: nextTags };
    });
  }

  // -----------------------------
  // MEMOS
  // -----------------------------
  const months = useMemo(() => extractMonths(transactions), [transactions]);
  const categories = useMemo(
    () => extractCategories(transactions),
    [transactions],
  );
  const parties = useMemo(() => extractParties(transactions), [transactions]);

  const filteredBase = useMemo(
    () => filterTransactions(transactions, category, month, party),
    [transactions, category, month, party],
  );

  const filtered = useMemo(() => {
    if (tagFilter === "ALL") return filteredBase;
    return filteredBase.filter((t) =>
      (tagsByTransactionId[t.id] ?? []).includes(tagFilter),
    );
  }, [filteredBase, tagFilter, tagsByTransactionId]);

  const total = useMemo(() => sumTransactions(filtered), [filtered]);

  const tags = useMemo(() => {
    const unique = new Set<string>();
    Object.values(tagsByTransactionId).forEach((txTags) => {
      txTags.forEach((tag) => unique.add(tag));
    });
    return [
      "ALL",
      ...Array.from(unique).sort((a, b) => a.localeCompare(b, "nb")),
    ];
  }, [tagsByTransactionId]);

  const actualByCategory = useMemo(() => {
    const result: Record<string, number> = {};
    for (const t of transactions) {
      if (t.amount < 0) {
        result[t.category] = (result[t.category] ?? 0) + Math.abs(t.amount);
      }
    }
    return result;
  }, [transactions]);

  // -----------------------------
  // LOGIN UI
  // -----------------------------
  if (!isLoggedIn) {
    return (
      <form
        onSubmit={handleLogin}
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg,#667eea,#764ba2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ background: "white", padding: 32, borderRadius: 16 }}>
          <h1>FamFin</h1>
          <input
            placeholder="Brukernavn"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: "100%", marginBottom: 12 }}
          />
          <input
            type="password"
            placeholder="Passord"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", marginBottom: 12 }}
          />
          <button>Logg inn</button>
          {loginError && <p style={{ color: "red" }}>{loginError}</p>}
        </div>
      </form>
    );
  }

  // -----------------------------
  // APP UI
  // -----------------------------
  return (
    <div
      style={{
        minHeight: "100vh",
        background: theme.color.bg,
        padding: "env(safe-area-inset-top) 16px 96px",
        fontFamily: "Inter, system-ui",
      }}
    >
      <h1>Økonomioversikt</h1>

      {activeTab === "overview" && (
        <div style={{ display: "flex", gap: 12, overflowX: "auto" }}>
          <Kpi title="Netto" value={`${total.toLocaleString("nb-NO")} kr`} />
          <Kpi title="Transaksjoner" value={filtered.length} />
        </div>
      )}

      {activeTab === "transactions" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Filtre */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                fontSize: 14,
              }}
            >
              <option value="ALL">Alle måneder</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryFilter)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                fontSize: 14,
              }}
            >
              <option value="ALL">Alle kategorier</option>
              {categories
                .filter((c) => c !== "ALL")
                .map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
            </select>

            <select
              value={party}
              onChange={(e) => setParty(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                fontSize: 14,
              }}
            >
              <option value="ALL">Alle fra/til</option>
              {parties
                .filter((p) => p !== "ALL")
                .map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
            </select>

            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                fontSize: 14,
              }}
            >
              <option value="ALL">Alle tagger</option>
              {tags
                .filter((t) => t !== "ALL")
                .map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
            </select>
          </div>
          {filtered.map((t) => (
            <div
              key={t.id}
              style={{
                background: theme.color.card,
                borderRadius: 16,
                padding: "18px 16px",
                boxShadow: theme.shadow.card,
              }}
            >
              <div
                style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
              >
                {/* Venstre: beskrivelse, dato, kategori */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 15,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      marginBottom: 3,
                    }}
                  >
                    {t.description}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: theme.color.muted,
                      marginBottom: 8,
                    }}
                  >
                    {t.date}
                  </div>
                  <span
                    style={{
                      background: theme.color.primarySoft,
                      padding: "4px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      display: "inline-block",
                      maxWidth: "100%",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {t.category}
                  </span>
                </div>

                {/* Høyre: beløp + tagg */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 8,
                    flexShrink: 0,
                  }}
                >
                  <strong
                    style={{
                      fontSize: 17,
                      color: t.amount < 0 ? "#dc2626" : "#16a34a",
                      letterSpacing: "-0.3px",
                    }}
                  >
                    {t.amount.toLocaleString("nb-NO")} kr
                  </strong>

                  {(tagsByTransactionId[t.id] ?? []).length > 0 ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 2,
                        background: "#e0e7ff",
                        color: "#3730a3",
                        padding: "5px 10px 5px 12px",
                        borderRadius: 999,
                        fontSize: 12,
                      }}
                    >
                      <span
                        style={{
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {tagsByTransactionId[t.id][0]}
                      </span>
                      <button
                        onClick={() =>
                          removeTag(t.id, tagsByTransactionId[t.id][0])
                        }
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#6366f1",
                          padding: "0 2px",
                          lineHeight: 1,
                          fontSize: 16,
                          minWidth: 24,
                          minHeight: 24,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        aria-label={`Fjern tagg ${tagsByTransactionId[t.id][0]}`}
                      >
                        ×
                      </button>
                    </span>
                  ) : tagInputOpen[t.id] ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        addTag(t.id, tagDraftByTransactionId[t.id] ?? "");
                        setTagInputOpen((prev) => ({ ...prev, [t.id]: false }));
                      }}
                      style={{ display: "flex", gap: 6 }}
                    >
                      <input
                        autoFocus
                        value={tagDraftByTransactionId[t.id] ?? ""}
                        onChange={(e) => updateTagDraft(t.id, e.target.value)}
                        onBlur={() =>
                          setTagInputOpen((prev) => ({
                            ...prev,
                            [t.id]: false,
                          }))
                        }
                        placeholder="Tagg…"
                        style={{
                          width: 80,
                          padding: "7px 10px",
                          borderRadius: 8,
                          border: "1px solid #ddd",
                          fontSize: 14,
                        }}
                      />
                      <button
                        type="submit"
                        style={{
                          padding: "7px 14px",
                          borderRadius: 8,
                          border: "none",
                          background: "#6366f1",
                          color: "white",
                          cursor: "pointer",
                          fontSize: 14,
                          minWidth: 40,
                        }}
                      >
                        +
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() =>
                        setTagInputOpen((prev) => ({ ...prev, [t.id]: true }))
                      }
                      style={{
                        background: "#f0f0ff",
                        border: "1.5px dashed #a5b4fc",
                        cursor: "pointer",
                        color: "#6366f1",
                        fontSize: 13,
                        borderRadius: 999,
                        padding: "4px 12px",
                        minHeight: 32,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                      aria-label="Legg til tagg"
                    >
                      <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>{" "}
                      tagg
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "budget" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 13, color: theme.color.muted, marginTop: 0 }}>
            Sett månedlig budsjett per kategori. Tallene viser faktisk forbruk
            fra alle transaksjoner.
          </p>
          {categories
            .filter((c) => c !== "ALL")
            .map((c) => {
              const planned = budget[c] ?? 0;
              const actual = actualByCategory[c] ?? 0;
              const pct =
                planned > 0 ? Math.min((actual / planned) * 100, 100) : 0;
              const over = planned > 0 && actual > planned;
              const diff = planned - actual;

              return (
                <div
                  key={c}
                  style={{
                    background: theme.color.card,
                    padding: "14px 16px",
                    borderRadius: 16,
                    boxShadow: theme.shadow.card,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 6,
                    }}
                  >
                    <strong style={{ fontSize: 14 }}>{c}</strong>
                    {planned > 0 && (
                      <span
                        style={{
                          fontSize: 13,
                          color: over
                            ? theme.color.danger
                            : theme.color.success,
                          fontWeight: 600,
                        }}
                      >
                        {diff < 0
                          ? `-${Math.abs(diff).toLocaleString("nb-NO")} kr`
                          : `+${diff.toLocaleString("nb-NO")} kr`}
                      </span>
                    )}
                  </div>
                  {planned > 0 && (
                    <div
                      style={{
                        background: "#f3f4f6",
                        borderRadius: 999,
                        height: 6,
                        marginBottom: 8,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: over
                            ? theme.color.danger
                            : theme.color.primary,
                          borderRadius: 999,
                          transition: "width 0.3s",
                        }}
                      />
                    </div>
                  )}
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: theme.color.muted,
                        flex: 1,
                      }}
                    >
                      Brukt: {actual.toLocaleString("nb-NO")} kr
                    </span>
                    <input
                      type="number"
                      value={planned || ""}
                      placeholder="Budsjett kr"
                      onChange={(e) =>
                        setBudget((prev) => ({
                          ...prev,
                          [c]: Number(e.target.value),
                        }))
                      }
                      style={{
                        width: 110,
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #ddd",
                        fontSize: 14,
                        textAlign: "right",
                      }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {activeTab === "settings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label
              style={{ display: "block", marginBottom: 8, fontWeight: 500 }}
            >
              Last opp CSV
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => e.target.files && onCsv(e.target.files[0])}
            />
            {loadSource === "auto" && (
              <p style={{ marginTop: 8, fontSize: 13, color: "#666" }}>
                Bruker transactions.csv fra public
              </p>
            )}
            {loadSource === "manual" && (
              <p style={{ marginTop: 8, fontSize: 13, color: "#666" }}>
                Bruker manuelt opplastet CSV
              </p>
            )}
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: "10px 16px",
              background: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Logg ut
          </button>
        </div>
      )}

      <BottomNav active={activeTab} onChange={setActiveTab} />
    </div>
  );
}
