import { useEffect, useMemo, useState } from "react";
import { Kpi } from "./components/Kpi";
import { BottomNav } from "./components/BottomNav";
import { lightTheme, darkTheme } from "./theme";
import {
  ALL_CATEGORIES,
  extractCategories,
  extractMonths,
  extractParties,
  extractYears,
  filterTransactions,
  parseCsvTransactions,
  sumTransactions,
} from "./features/expenses/model";
import type { CategoryFilter, Transaction } from "./features/expenses/model";

const TAGS_STORAGE_KEY = "famfin-transaction-tags";
const TAGS_API_URL = "/api/tags";
const BUDGET_API_URL = "/api/budget";
const AUTH_STORAGE_KEY = "famfin-auth";
const BUDGET_STORAGE_KEY = "famfin-budget";
const TAG_BUDGET_KEYS = ["Nicole", "Helge"] as const;
type TagBudgetKey = (typeof TAG_BUDGET_KEYS)[number];

const NOW = new Date();
const CURRENT_YEAR = NOW.getFullYear().toString();
const CURRENT_MONTH = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, "0")}`;

const VALID_USERNAME = "BenduVollan";
const VALID_PASSWORD = "qwer1234";

type TagsByTransactionId = Record<string, string[]>;
type BudgetByCategory = Record<string, number>;
type BudgetVersion = { id: number; label: string; created_at: string };
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
  const [year, setYear] = useState<string>(CURRENT_YEAR);
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
  const [budgetHydrated, setBudgetHydrated] = useState(false);
  const [budgetVersions, setBudgetVersions] = useState<BudgetVersion[]>([]);
  const [budgetVersionLabel, setBudgetVersionLabel] = useState("");
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [expandedBudgetCat, setExpandedBudgetCat] = useState<string | null>(
    null,
  );

  const [loadSource, setLoadSource] = useState<"auto" | "manual" | "none">(
    "none",
  );

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [darkMode, setDarkMode] = useState<boolean>(
    () => localStorage.getItem("famfin-darkmode") === "true",
  );
  const theme = darkMode ? darkTheme : lightTheme;

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
    let cancelled = false;
    async function loadBudget() {
      try {
        const r = await fetch(BUDGET_API_URL, { cache: "no-store" });
        if (r.ok) {
          const parsed = (await r.json()) as BudgetByCategory;
          if (!cancelled) setBudget(parsed);
          return;
        }
      } catch {}
      const local = localStorage.getItem(BUDGET_STORAGE_KEY);
      if (!cancelled && local) setBudget(JSON.parse(local));
    }
    loadBudget().finally(() => {
      if (!cancelled) setBudgetHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!budgetHydrated) return;
    const payload = JSON.stringify(budget);
    localStorage.setItem(BUDGET_STORAGE_KEY, payload);
    fetch(BUDGET_API_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: payload,
    }).catch(() => {});
  }, [budget, budgetHydrated]);

  useEffect(() => {
    fetch(`${BUDGET_API_URL}/versions`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((v) => setBudgetVersions(v))
      .catch(() => {});
  }, []);

  async function saveBudgetVersion() {
    if (!budgetVersionLabel.trim()) return;
    try {
      const r = await fetch(`${BUDGET_API_URL}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: budgetVersionLabel.trim() }),
      });
      if (r.ok) {
        const v = (await r.json()) as BudgetVersion;
        setBudgetVersions((prev) => [v, ...prev]);
        setBudgetVersionLabel("");
      }
    } catch {}
  }

  async function loadBudgetVersion(id: number) {
    try {
      const r = await fetch(`${BUDGET_API_URL}/versions/${id}`, {
        cache: "no-store",
      });
      if (r.ok) {
        const data = (await r.json()) as BudgetByCategory;
        setBudget(data);
        setShowVersionHistory(false);
      }
    } catch {}
  }

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

  // Sett standard mnd til gjeldende mnd, eller forrige mnd hvis ingen data
  useEffect(() => {
    if (!transactions.length) return;
    const hasCurrent = transactions.some((t) =>
      t.date.startsWith(CURRENT_MONTH),
    );
    if (hasCurrent) {
      setMonth(CURRENT_MONTH);
    } else {
      const d = new Date(NOW.getFullYear(), NOW.getMonth() - 1, 1);
      const prevMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      setMonth(prevMonth);
    }
  }, [transactions]);

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
  const years = useMemo(() => extractYears(transactions), [transactions]);
  const categories = useMemo(
    () => extractCategories(transactions),
    [transactions],
  );
  const parties = useMemo(() => extractParties(transactions), [transactions]);

  const monthsForYear = useMemo(
    () => (year === "ALL" ? months : months.filter((m) => m.startsWith(year))),
    [months, year],
  );

  const filteredBase = useMemo(() => {
    let base = filterTransactions(transactions, category, month, party);
    if (year !== "ALL" && month === "ALL") {
      base = base.filter((t) => t.date.startsWith(year));
    }
    return base;
  }, [transactions, category, month, party, year]);

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
    const txs =
      month !== "ALL"
        ? transactions.filter((t) => t.date.startsWith(month))
        : year !== "ALL"
          ? transactions.filter((t) => t.date.startsWith(year))
          : transactions;
    const TAG_ROUTED = new Set(TAG_BUDGET_KEYS.map((k) => k.toLowerCase()));
    const REROUTE_CATS = new Set(["Diverse", "Overføringer – Privat"]);
    // Kart fra lowercase kategorinavn → original CategoryId
    const catLowerMap = new Map(
      ALL_CATEGORIES.map((c) => [c.toLowerCase(), c]),
    );
    for (const t of txs) {
      const tTags = tagsByTransactionId[t.id] ?? [];
      // Hvis en tag er et gyldig kategorinavn, tell alltid beløpet der (uansett fortegn)
      let usedCategoryTag = false;
      for (const tag of tTags) {
        const resolvedCat = catLowerMap.get(tag.toLowerCase());
        if (resolvedCat) {
          result[resolvedCat] = (result[resolvedCat] ?? 0) + Math.abs(t.amount);
          usedCategoryTag = true;
          break;
        }
      }
      if (usedCategoryTag) continue;

      // Ellers: tell bare negative beløp (utgifter)
      if (t.amount < 0) {
        // Hvis kategorien er Diverse/Overføringer og transaksjonen har en tag-budsjett-nøkkel,
        // la tag-budsjettet håndtere den – ikke tell den under kategorien
        if (REROUTE_CATS.has(t.category)) {
          if (tTags.some((tag) => TAG_ROUTED.has(tag))) continue;
        }
        result[t.category] = (result[t.category] ?? 0) + Math.abs(t.amount);
      }
    }
    return result;
  }, [transactions, month, year, tagsByTransactionId]);

  const actualByTag = useMemo(() => {
    const result: Record<string, number> = {};
    const txs =
      month !== "ALL"
        ? transactions.filter((t) => t.date.startsWith(month))
        : year !== "ALL"
          ? transactions.filter((t) => t.date.startsWith(year))
          : transactions;
    for (const t of txs) {
      if (t.amount < 0) {
        const tTags = tagsByTransactionId[t.id] ?? [];
        for (const key of TAG_BUDGET_KEYS) {
          if (tTags.includes(key.toLowerCase())) {
            result[key] = (result[key] ?? 0) + Math.abs(t.amount);
          }
        }
      }
    }
    return result;
  }, [transactions, month, year, tagsByTransactionId]);

  const totalIncome = useMemo(() => {
    const txs =
      month !== "ALL"
        ? transactions.filter((t) => t.date.startsWith(month))
        : year !== "ALL"
          ? transactions.filter((t) => t.date.startsWith(year))
          : transactions;
    return txs
      .filter((t) => t.amount > 0 && t.category === "Inntekt")
      .reduce((s, t) => s + t.amount, 0);
  }, [transactions, month, year]);

  const totalTransfersIn = useMemo(() => {
    const txs =
      month !== "ALL"
        ? transactions.filter((t) => t.date.startsWith(month))
        : year !== "ALL"
          ? transactions.filter((t) => t.date.startsWith(year))
          : transactions;
    return txs
      .filter((t) => t.amount > 0 && t.category !== "Inntekt")
      .reduce((s, t) => s + t.amount, 0);
  }, [transactions, month, year]);

  const totalExpenses = useMemo(() => {
    const txs =
      month !== "ALL"
        ? transactions.filter((t) => t.date.startsWith(month))
        : year !== "ALL"
          ? transactions.filter((t) => t.date.startsWith(year))
          : transactions;
    return txs
      .filter((t) => t.amount < 0)
      .reduce((s, t) => s + Math.abs(t.amount), 0);
  }, [transactions, month, year]);

  const PERSON_CATS = new Set(["Victoria"]);
  const budgetDisplayCategories: string[] = [
    ...ALL_CATEGORIES.filter(
      (c) =>
        c !== "Overføringer – Privat" && c !== "Inntekt" && !PERSON_CATS.has(c),
    )
      .slice()
      .sort((a, b) => a.localeCompare(b, "nb")),
    "Victoria",
    ...TAG_BUDGET_KEYS,
  ];

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
        color: theme.color.text,
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
            <div style={{ display: "flex", gap: 8 }}>
              <select
                value={year}
                onChange={(e) => {
                  setYear(e.target.value);
                  setMonth("ALL");
                }}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: `1px solid ${theme.color.inputBorder}`,
                  fontSize: 14,
                }}
              >
                <option value="ALL">Alle år</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: `1px solid ${theme.color.inputBorder}`,
                  fontSize: 14,
                }}
              >
                <option value="ALL">Alle måneder</option>
                {monthsForYear.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryFilter)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: `1px solid ${theme.color.inputBorder}`,
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
                border: `1px solid ${theme.color.inputBorder}`,
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
                border: `1px solid ${theme.color.inputBorder}`,
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
                {/* Venstre: beskrivelse, dato */}
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
                  {/* Kategori + tagg på samme linje */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        background: theme.color.primarySoft,
                        padding: "4px 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        lineHeight: "normal",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "100%",
                      }}
                    >
                      {t.category}
                    </span>

                    {(tagsByTransactionId[t.id] ?? []).length > 0 ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 2,
                          background: theme.color.tagBg,
                          color: theme.color.tagText,
                          padding: "4px 6px 4px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          lineHeight: "normal",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {tagsByTransactionId[t.id][0]}
                        <button
                          onClick={() =>
                            removeTag(t.id, tagsByTransactionId[t.id][0])
                          }
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: theme.color.tagText,
                            padding: "0 2px",
                            lineHeight: 1,
                            fontSize: 14,
                            display: "inline-flex",
                            alignItems: "center",
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
                          setTagInputOpen((prev) => ({
                            ...prev,
                            [t.id]: false,
                          }));
                        }}
                        style={{ display: "flex", gap: 4 }}
                      >
                        <datalist id={`cat-suggestions-${t.id}`}>
                          {ALL_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat} />
                          ))}
                        </datalist>
                        <input
                          autoFocus
                          list={`cat-suggestions-${t.id}`}
                          value={tagDraftByTransactionId[t.id] ?? ""}
                          onChange={(e) => updateTagDraft(t.id, e.target.value)}
                          placeholder="Tagg eller kategori…"
                          style={{
                            width: 80,
                            padding: "4px 8px",
                            borderRadius: 8,
                            border: `1px solid ${theme.color.inputBorder}`,
                            fontSize: 13,
                            background: theme.color.card,
                            color: theme.color.text,
                          }}
                        />
                        <button
                          type="submit"
                          style={{
                            padding: "4px 10px",
                            borderRadius: 8,
                            border: "none",
                            background: "#6366f1",
                            color: "white",
                            cursor: "pointer",
                            fontSize: 14,
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
                          background: theme.color.tagBg,
                          color: theme.color.tagText,
                          border: "none",
                          cursor: "pointer",
                          fontSize: 12,
                          borderRadius: 999,
                          padding: "4px 10px",
                          display: "inline-flex",
                          alignItems: "center",
                          lineHeight: "normal",
                          gap: 3,
                          whiteSpace: "nowrap",
                        }}
                        aria-label="Legg til tagg"
                      >
                        <span style={{ fontSize: 15, lineHeight: 1 }}>+</span>{" "}
                        tagg
                      </button>
                    )}
                  </div>
                </div>

                {/* Høyre: beløp */}
                <div style={{ flexShrink: 0 }}>
                  <strong
                    style={{
                      fontSize: 17,
                      color: t.amount < 0 ? "#dc2626" : "#16a34a",
                      letterSpacing: "-0.3px",
                    }}
                  >
                    {t.amount.toLocaleString("nb-NO")} kr
                  </strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "budget" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Periode-info */}
          <div style={{ display: "flex", gap: 8 }}>
            <select
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                setMonth("ALL");
              }}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 8,
                border: `1px solid ${theme.color.inputBorder}`,
                fontSize: 14,
              }}
            >
              <option value="ALL">Alle år</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 8,
                border: `1px solid ${theme.color.inputBorder}`,
                fontSize: 14,
              }}
            >
              <option value="ALL">Alle måneder</option>
              {monthsForYear.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Lagre versjon */}
          <div
            style={{
              background: theme.color.card,
              borderRadius: 12,
              padding: "12px 14px",
              boxShadow: theme.shadow.card,
              display: "flex",
              gap: 8,
            }}
          >
            <input
              value={budgetVersionLabel}
              onChange={(e) => setBudgetVersionLabel(e.target.value)}
              placeholder="Versjonsnavn (f.eks. Mai 2026)"
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: 8,
                border: `1px solid ${theme.color.inputBorder}`,
                fontSize: 14,
              }}
              onKeyDown={(e) => e.key === "Enter" && saveBudgetVersion()}
            />
            <button
              onClick={saveBudgetVersion}
              disabled={!budgetVersionLabel.trim()}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "none",
                background: budgetVersionLabel.trim()
                  ? theme.color.primary
                  : "#e5e7eb",
                color: budgetVersionLabel.trim() ? "white" : "#9ca3af",
                cursor: budgetVersionLabel.trim() ? "pointer" : "default",
                fontSize: 14,
                whiteSpace: "nowrap",
              }}
            >
              Lagre versjon
            </button>
          </div>

          <p style={{ fontSize: 13, color: theme.color.muted, margin: 0 }}>
            Faktisk forbruk vises for:{" "}
            {month !== "ALL" ? month : year !== "ALL" ? year : "alle perioder"}
          </p>

          {/* Sammendrag: inntekt og utgifter */}
          <div style={{ display: "flex", gap: 10 }}>
            <div
              style={{
                flex: 1,
                background: theme.color.incomeBg,
                borderRadius: 16,
                padding: "12px 16px",
                boxShadow: theme.shadow.card,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: theme.color.muted,
                  marginBottom: 2,
                }}
              >
                Lønn / inntekt
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: theme.color.incomeText,
                }}
              >
                {totalIncome.toLocaleString("nb-NO")} kr
              </div>
              {totalTransfersIn > 0 && (
                <div
                  style={{
                    fontSize: 12,
                    color: theme.color.incomeSubText,
                    marginTop: 4,
                  }}
                >
                  + {totalTransfersIn.toLocaleString("nb-NO")} kr overføringer
                  inn
                </div>
              )}
            </div>
            <div
              style={{
                flex: 1,
                background: theme.color.expenseBg,
                borderRadius: 16,
                padding: "12px 16px",
                boxShadow: theme.shadow.card,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: theme.color.muted,
                  marginBottom: 2,
                }}
              >
                Total utgifter
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: theme.color.danger,
                }}
              >
                {totalExpenses.toLocaleString("nb-NO")} kr
              </div>
            </div>
          </div>

          {budgetDisplayCategories
            .filter(
              (c) =>
                !TAG_BUDGET_KEYS.includes(
                  c as (typeof TAG_BUDGET_KEYS)[number],
                ),
            )
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
                      marginBottom: 4,
                    }}
                  >
                    <div style={{ textAlign: "left" }}>
                      <strong style={{ fontSize: 14 }}>{c}</strong>
                    </div>
                    {planned > 0 && (
                      <span
                        style={{
                          fontSize: 13,
                          color: over
                            ? theme.color.danger
                            : theme.color.success,
                          fontWeight: 600,
                          alignSelf: "flex-start",
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
                        background: theme.color.progressTrack,
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
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 6,
                    }}
                  >
                    <div
                      onClick={() =>
                        setExpandedBudgetCat((prev) => (prev === c ? null : c))
                      }
                      style={{
                        background: "#e0e7ff",
                        color: "#3730a3",
                        padding: "4px 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        whiteSpace: "nowrap",
                        cursor: actual > 0 ? "pointer" : "default",
                      }}
                    >
                      Brukt: {actual.toLocaleString("nb-NO")} kr{" "}
                      {actual > 0 ? (expandedBudgetCat === c ? "▲" : "▼") : ""}
                    </div>
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
                        border: `1px solid ${theme.color.inputBorder}`,
                        fontSize: 14,
                        textAlign: "right",
                      }}
                    />
                  </div>
                  {expandedBudgetCat === c &&
                    (() => {
                      const periodTxs =
                        month !== "ALL"
                          ? transactions.filter((t) => t.date.startsWith(month))
                          : year !== "ALL"
                            ? transactions.filter((t) =>
                                t.date.startsWith(year),
                              )
                            : transactions;
                      const catLowerMap = new Map(
                        ALL_CATEGORIES.map((cat) => [cat.toLowerCase(), cat]),
                      );
                      const catTxs = periodTxs.filter((t) => {
                        const tTags = tagsByTransactionId[t.id] ?? [];
                        const tagCat = tTags
                          .map((tag) => catLowerMap.get(tag.toLowerCase()))
                          .find(Boolean);
                        if (tagCat) return tagCat === c;
                        return t.category === c && t.amount < 0;
                      });
                      return (
                        <div
                          style={{
                            marginBottom: 8,
                            border: `1px solid ${theme.color.drillBorder}`,
                            borderRadius: 10,
                            overflow: "hidden",
                          }}
                        >
                          {catTxs.length === 0 ? (
                            <div
                              style={{
                                padding: "8px 12px",
                                fontSize: 12,
                                color: theme.color.muted,
                              }}
                            >
                              Ingen poster
                            </div>
                          ) : (
                            catTxs.map((t, i) => (
                              <div
                                key={i}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  padding: "6px 12px",
                                  fontSize: 12,
                                  borderBottom:
                                    i < catTxs.length - 1
                                      ? `1px solid ${theme.color.rowBorder}`
                                      : "none",
                                  background:
                                    i % 2 === 0
                                      ? theme.color.rowAlt
                                      : theme.color.card,
                                }}
                              >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontWeight: 500,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {t.description}
                                  </div>
                                  <div style={{ color: theme.color.muted }}>
                                    {t.date}
                                  </div>
                                  {/* Tagg */}
                                  <div style={{ marginTop: 4 }}>
                                    {(tagsByTransactionId[t.id] ?? []).length >
                                    0 ? (
                                      <span
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 2,
                                          background: theme.color.tagBg,
                                          color: theme.color.tagText,
                                          padding: "2px 6px 2px 8px",
                                          borderRadius: 999,
                                          fontSize: 11,
                                          lineHeight: "normal",
                                        }}
                                      >
                                        {tagsByTransactionId[t.id][0]}
                                        <button
                                          onClick={() =>
                                            removeTag(
                                              t.id,
                                              tagsByTransactionId[t.id][0],
                                            )
                                          }
                                          style={{
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            color: theme.color.tagText,
                                            padding: "0 2px",
                                            lineHeight: 1,
                                            fontSize: 13,
                                            display: "inline-flex",
                                            alignItems: "center",
                                          }}
                                        >
                                          ×
                                        </button>
                                      </span>
                                    ) : tagInputOpen[t.id] ? (
                                      <form
                                        onSubmit={(e) => {
                                          e.preventDefault();
                                          addTag(
                                            t.id,
                                            tagDraftByTransactionId[t.id] ?? "",
                                          );
                                          setTagInputOpen((prev) => ({
                                            ...prev,
                                            [t.id]: false,
                                          }));
                                        }}
                                        style={{ display: "flex", gap: 4 }}
                                      >
                                        <datalist
                                          id={`cat-suggestions-budget-${t.id}`}
                                        >
                                          {ALL_CATEGORIES.map((cat) => (
                                            <option key={cat} value={cat} />
                                          ))}
                                        </datalist>
                                        <input
                                          autoFocus
                                          list={`cat-suggestions-budget-${t.id}`}
                                          value={
                                            tagDraftByTransactionId[t.id] ?? ""
                                          }
                                          onChange={(e) =>
                                            updateTagDraft(t.id, e.target.value)
                                          }
                                          placeholder="Tagg…"
                                          style={{
                                            width: 90,
                                            padding: "2px 6px",
                                            borderRadius: 6,
                                            border: `1px solid ${theme.color.inputBorder}`,
                                            fontSize: 11,
                                            background: theme.color.card,
                                            color: theme.color.text,
                                          }}
                                        />
                                        <button
                                          type="submit"
                                          style={{
                                            padding: "2px 8px",
                                            borderRadius: 6,
                                            border: "none",
                                            background: "#6366f1",
                                            color: "white",
                                            cursor: "pointer",
                                            fontSize: 12,
                                          }}
                                        >
                                          +
                                        </button>
                                      </form>
                                    ) : (
                                      <button
                                        onClick={() =>
                                          setTagInputOpen((prev) => ({
                                            ...prev,
                                            [t.id]: true,
                                          }))
                                        }
                                        style={{
                                          background: theme.color.tagBg,
                                          color: theme.color.tagText,
                                          border: "none",
                                          cursor: "pointer",
                                          fontSize: 11,
                                          borderRadius: 999,
                                          padding: "2px 8px",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          lineHeight: "normal",
                                          gap: 2,
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontSize: 13,
                                            lineHeight: 1,
                                          }}
                                        >
                                          +
                                        </span>{" "}
                                        tagg
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div
                                  style={{
                                    fontWeight: 600,
                                    color: theme.color.danger,
                                    marginLeft: 8,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {Math.abs(t.amount).toLocaleString("nb-NO")}{" "}
                                  kr
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      );
                    })()}
                </div>
              );
            })}

          {/* Tag-baserte budsjett: Nicole og Helge */}
          {TAG_BUDGET_KEYS.map((key: TagBudgetKey) => {
            const planned = budget[key] ?? 0;
            const actual = actualByTag[key] ?? 0;
            const pct =
              planned > 0 ? Math.min((actual / planned) * 100, 100) : 0;
            const over = planned > 0 && actual > planned;
            const diff = planned - actual;

            return (
              <div
                key={key}
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
                    marginBottom: 4,
                  }}
                >
                  <div style={{ textAlign: "left" }}>
                    <strong style={{ fontSize: 14 }}>{key}</strong>
                    <div
                      style={{
                        fontSize: 11,
                        color: theme.color.muted,
                        marginTop: 1,
                      }}
                    >
                      tag: {key.toLowerCase()}
                    </div>
                  </div>
                  {planned > 0 && (
                    <span
                      style={{
                        fontSize: 13,
                        color: over ? theme.color.danger : theme.color.success,
                        fontWeight: 600,
                        alignSelf: "flex-start",
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
                      background: theme.color.progressTrack,
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
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <div
                    onClick={() =>
                      setExpandedBudgetCat((prev) =>
                        prev === key ? null : key,
                      )
                    }
                    style={{
                      fontSize: 12,
                      color:
                        actual > 0 ? theme.color.primary : theme.color.muted,
                      cursor: actual > 0 ? "pointer" : "default",
                      textDecoration: actual > 0 ? "underline dotted" : "none",
                    }}
                  >
                    Brukt: {actual.toLocaleString("nb-NO")} kr{" "}
                    {actual > 0 ? (expandedBudgetCat === key ? "▲" : "▼") : ""}
                  </div>
                  <input
                    type="number"
                    value={planned || ""}
                    placeholder="Budsjett kr"
                    onChange={(e) =>
                      setBudget((prev) => ({
                        ...prev,
                        [key]: Number(e.target.value),
                      }))
                    }
                    style={{
                      width: 110,
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: `1px solid ${theme.color.inputBorder}`,
                      fontSize: 14,
                      textAlign: "right",
                      background: theme.color.card,
                      color: theme.color.text,
                    }}
                  />
                </div>
                {expandedBudgetCat === key &&
                  (() => {
                    const tagTxs = (
                      month !== "ALL"
                        ? transactions.filter((t) => t.date.startsWith(month))
                        : year !== "ALL"
                          ? transactions.filter((t) => t.date.startsWith(year))
                          : transactions
                    ).filter(
                      (t) =>
                        t.amount < 0 &&
                        (tagsByTransactionId[t.id] ?? []).includes(
                          key.toLowerCase(),
                        ),
                    );
                    return (
                      <div
                        style={{
                          marginBottom: 8,
                          border: `1px solid ${theme.color.drillBorder}`,
                          borderRadius: 10,
                          overflow: "hidden",
                        }}
                      >
                        {tagTxs.length === 0 ? (
                          <div
                            style={{
                              padding: "8px 12px",
                              fontSize: 12,
                              color: theme.color.muted,
                            }}
                          >
                            Ingen poster
                          </div>
                        ) : (
                          tagTxs.map((t, i) => (
                            <div
                              key={i}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "6px 12px",
                                fontSize: 12,
                                borderBottom:
                                  i < tagTxs.length - 1
                                    ? `1px solid ${theme.color.rowBorder}`
                                    : "none",
                                background:
                                  i % 2 === 0
                                    ? theme.color.rowAlt
                                    : theme.color.card,
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    fontWeight: 500,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {t.description}
                                </div>
                                <div style={{ color: theme.color.muted }}>
                                  {t.date}
                                </div>
                              </div>
                              <div
                                style={{
                                  fontWeight: 600,
                                  color: theme.color.danger,
                                  marginLeft: 8,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {Math.abs(t.amount).toLocaleString("nb-NO")} kr
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })()}
              </div>
            );
          })}

          {/* Versjonshistorikk */}
          {budgetVersions.length > 0 && (
            <div
              style={{
                background: theme.color.card,
                borderRadius: 12,
                boxShadow: theme.shadow.card,
                overflow: "hidden",
              }}
            >
              <button
                onClick={() => setShowVersionHistory((v) => !v)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 14,
                  fontWeight: 600,
                  color: theme.color.text,
                }}
              >
                Versjonshistorikk ({budgetVersions.length})
                <span style={{ fontSize: 12 }}>
                  {showVersionHistory ? "▲" : "▼"}
                </span>
              </button>
              {showVersionHistory && (
                <div
                  style={{ borderTop: `1px solid ${theme.color.rowBorder}` }}
                >
                  {budgetVersions.map((v) => (
                    <div
                      key={v.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 14px",
                        borderBottom: "1px solid #f9fafb",
                        gap: 8,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>
                          {v.label}
                        </div>
                        <div style={{ fontSize: 11, color: theme.color.muted }}>
                          {new Date(v.created_at).toLocaleString("nb-NO", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                      <button
                        onClick={() => loadBudgetVersion(v.id)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: `1px solid ${theme.color.primary}`,
                          background: "none",
                          color: theme.color.primary,
                          cursor: "pointer",
                          fontSize: 13,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Last inn
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "settings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Mørk modus */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: theme.color.card,
              borderRadius: 12,
              padding: "12px 16px",
              boxShadow: theme.shadow.card,
            }}
          >
            <span style={{ fontWeight: 500 }}>Mørk modus</span>
            <button
              onClick={() => {
                const next = !darkMode;
                setDarkMode(next);
                localStorage.setItem(
                  "famfin-darkmode",
                  next ? "true" : "false",
                );
              }}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                border: "none",
                background: darkMode
                  ? theme.color.primary
                  : theme.color.primarySoft,
                color: darkMode ? "white" : theme.color.primary,
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              {darkMode ? "☀️ Lys" : "🌙 Mørk"}
            </button>
          </div>
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

      <BottomNav
        active={activeTab}
        onChange={setActiveTab}
        darkMode={darkMode}
      />
    </div>
  );
}
