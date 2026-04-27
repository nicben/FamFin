import { useEffect, useMemo, useState } from "react";
import { Kpi } from "./components/Kpi";
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

type TagsByTransactionId = Record<string, string[]>;

// -----------------------------
// APP
// -----------------------------

export default function ExpenseApp() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [month, setMonth] = useState<string | "ALL">("ALL");
  const [party, setParty] = useState<string>("ALL");
  const [tagFilter, setTagFilter] = useState<string>("ALL");
  const [tagsByTransactionId, setTagsByTransactionId] =
    useState<TagsByTransactionId>({});
  const [tagDraftByTransactionId, setTagDraftByTransactionId] = useState<
    Record<string, string>
  >({});
  const [tagsHydrated, setTagsHydrated] = useState(false);
  const [loadSource, setLoadSource] = useState<"auto" | "manual" | "none">(
    "none",
  );

  useEffect(() => {
    let cancelled = false;

    async function loadTags() {
      try {
        const response = await fetch(TAGS_API_URL, { cache: "no-store" });
        if (response.ok) {
          const parsed = (await response.json()) as TagsByTransactionId;
          if (!cancelled && parsed && typeof parsed === "object") {
            setTagsByTransactionId(parsed);
          }
          return;
        }
      } catch {
        // Fall back to localStorage below.
      }

      try {
        const stored = localStorage.getItem(TAGS_STORAGE_KEY);
        if (!cancelled && stored) {
          const parsed = JSON.parse(stored) as TagsByTransactionId;
          setTagsByTransactionId(parsed);
        }
      } catch {
        // Ignore invalid local state and start from empty tags.
      }
    }

    void loadTags().finally(() => {
      if (!cancelled) {
        setTagsHydrated(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!tagsHydrated) {
      return;
    }

    const payload = JSON.stringify(tagsByTransactionId);
    localStorage.setItem(TAGS_STORAGE_KEY, payload);

    void fetch(TAGS_API_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: payload,
    }).catch(() => {
      // Keep local fallback when API is unavailable.
    });
  }, [tagsByTransactionId, tagsHydrated]);

  function onCsv(file: File): void {
    const r = new FileReader();
    r.onload = () => {
      setTransactions(parseCsvTransactions(String(r.result)));
      setLoadSource("manual");
    };

    r.readAsText(file);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadDefaultCsv(): Promise<void> {
      try {
        const response = await fetch("/transactions.csv", {
          cache: "no-store",
        });
        if (!response.ok) {
          return;
        }

        const csvText = await response.text();
        if (cancelled) {
          return;
        }

        const parsed = parseCsvTransactions(csvText);
        if (parsed.length > 0) {
          setTransactions(parsed);
          setLoadSource("auto");
        }
      } catch {
        // Ignore missing/invalid default file and allow manual upload instead.
      }
    }

    void loadDefaultCsv();

    return () => {
      cancelled = true;
    };
  }, []);

  const months = useMemo(() => extractMonths(transactions), [transactions]);

  const filteredByCategoryMonthParty = useMemo(
    () => filterTransactions(transactions, category, month, party),
    [transactions, category, month, party],
  );

  const filtered = useMemo(() => {
    if (tagFilter === "ALL") {
      return filteredByCategoryMonthParty;
    }

    return filteredByCategoryMonthParty.filter((transaction) =>
      (tagsByTransactionId[transaction.id] ?? []).includes(tagFilter),
    );
  }, [filteredByCategoryMonthParty, tagFilter, tagsByTransactionId]);

  const total = useMemo(() => sumTransactions(filtered), [filtered]);

  const categories = useMemo(
    () => extractCategories(transactions),
    [transactions],
  );

  const parties = useMemo(() => extractParties(transactions), [transactions]);

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

  function updateTagDraft(transactionId: string, value: string): void {
    setTagDraftByTransactionId((prev) => ({ ...prev, [transactionId]: value }));
  }

  function addTag(transactionId: string, tagRaw: string): void {
    const tag = tagRaw.trim().toLowerCase();
    if (!tag) {
      return;
    }

    setTagsByTransactionId((prev) => {
      const current = prev[transactionId] ?? [];
      if (current.includes(tag)) {
        return prev;
      }
      return { ...prev, [transactionId]: [...current, tag] };
    });
    setTagDraftByTransactionId((prev) => ({ ...prev, [transactionId]: "" }));
  }

  function removeTag(transactionId: string, tag: string): void {
    setTagsByTransactionId((prev) => {
      const nextTags = (prev[transactionId] ?? []).filter((t) => t !== tag);
      if (nextTags.length === 0) {
        const { [transactionId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [transactionId]: nextTags };
    });
  }

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f6fa",
        padding: "clamp(16px, 4vw, 32px)",
        fontFamily: "Inter, system-ui",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ margin: 0, fontWeight: 600, minWidth: "100%" }}>
          Økonomioversikt
        </h1>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => e.target.files && onCsv(e.target.files[0])}
          style={{ flex: 1, minWidth: 150 }}
        />
        {loadSource === "auto" && (
          <span style={{ flex: 1, minWidth: 200, fontSize: "0.9rem" }}>
            Bruker transactions.csv fra public
          </span>
        )}
        {loadSource === "manual" && (
          <span style={{ flex: 1, minWidth: 200, fontSize: "0.9rem" }}>
            Bruker manuelt opplastet CSV
          </span>
        )}
      </div>

      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          gap: 16,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          style={{ flex: 1, minWidth: 150 }}
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
          style={{ flex: 1, minWidth: 150 }}
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
          style={{ flex: 1, minWidth: 150 }}
        >
          <option value="ALL">Alle avsendere/mottakere</option>
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
          style={{ flex: 1, minWidth: 150 }}
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

      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <Kpi title="Netto" value={`${total.toLocaleString("nb-NO")} kr`} />
        <Kpi title="Transaksjoner" value={filtered.length} />
        <Kpi title="Måned" value={month === "ALL" ? "Alle" : month} />
      </div>

      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          background: "white",
          borderRadius: 12,
          padding: 16,
          overflowX: "auto",
        }}
      >
        <table
          width="100%"
          style={{
            borderCollapse: "separate",
            borderSpacing: "0 6px",
            minWidth: "100%",
          }}
        >
          <thead>
            <tr
              style={{
                textAlign: "left",
                color: "#6b7280",
                fontSize: "clamp(12px, 2.5vw, 13px)",
              }}
            >
              <th>Dato / Beskrivelse</th>
              <th style={{ display: "none" }} /* Hide on mobile */>Kategori</th>
              <th>Tagger</th>
              <th style={{ textAlign: "right" }}>Beløp</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((t) => (
              <tr
                key={t.id}
                style={{
                  background: "white",
                  borderRadius: 8,
                }}
              >
                {/* DATO + BESKRIVELSE */}
                <td
                  style={{
                    padding: "12px",
                    fontSize: "clamp(12px, 2.5vw, 14px)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "clamp(11px, 2vw, 12px)",
                      color: "#6b7280",
                    }}
                  >
                    {t.date}
                  </div>
                  <div style={{ fontWeight: 500 }}>{t.description}</div>
                  <div
                    style={{ fontSize: "clamp(11px, 2vw, 12px)", marginTop: 4 }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        padding: "4px 8px",
                        borderRadius: 999,
                        background: "#eef2ff",
                        color: "#4338ca",
                        fontWeight: 500,
                      }}
                    >
                      {t.category}
                    </span>
                  </div>
                </td>

                {/* KATEGORI - Hidden on mobile */}
                <td style={{ padding: "10px 12px", display: "none" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "4px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      background: "#eef2ff",
                      color: "#4338ca",
                      fontWeight: 500,
                    }}
                  >
                    {t.category}
                  </span>
                </td>

                <td
                  style={{
                    padding: "12px",
                    minWidth: "200px",
                    fontSize: "clamp(11px, 2vw, 12px)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    {(tagsByTransactionId[t.id] ?? []).length === 0 && (
                      <>
                        <input
                          value={tagDraftByTransactionId[t.id] ?? ""}
                          onChange={(e) => updateTagDraft(t.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addTag(t.id, tagDraftByTransactionId[t.id] ?? "");
                            }
                          }}
                          placeholder="Ny tag"
                          style={{
                            width: "clamp(80px, 100%, 110px)",
                            fontSize: "clamp(11px, 2vw, 12px)",
                            padding: "6px 8px",
                            boxSizing: "border-box",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            addTag(t.id, tagDraftByTransactionId[t.id] ?? "")
                          }
                          style={{
                            fontSize: "clamp(11px, 2vw, 12px)",
                            padding: "6px 12px",
                          }}
                        >
                          Legg til
                        </button>
                      </>
                    )}

                    {(tagsByTransactionId[t.id] ?? []).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => removeTag(t.id, tag)}
                        title="Fjern tag"
                        style={{
                          border: "none",
                          background: "#dcfce7",
                          color: "#166534",
                          borderRadius: 999,
                          fontSize: "clamp(11px, 2vw, 12px)",
                          padding: "4px 8px",
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        {tag} x
                      </button>
                    ))}
                  </div>
                </td>

                {/* BELØP */}
                <td
                  style={{
                    padding: "12px",
                    textAlign: "right",
                    fontWeight: 600,
                    color: t.amount < 0 ? "#dc2626" : "#16a34a",
                    whiteSpace: "nowrap",
                    fontSize: "clamp(12px, 2.5vw, 14px)",
                  }}
                >
                  {t.amount.toLocaleString("nb-NO")} kr
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
