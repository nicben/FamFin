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

type Props = {
  onLogout: () => void;
};

export default function ExpenseDashboard({ onLogout }: Props) {
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

  const [tagsHydrated, setTagsHydrated] = useState(false);
  const [loadSource, setLoadSource] = useState<"auto" | "manual" | "none">(
    "none",
  );

  // -----------------------------
  // LOAD TAGS (API → localStorage fallback)
  // -----------------------------
  useEffect(() => {
    let cancelled = false;

    async function loadTags() {
      try {
        const response = await fetch(TAGS_API_URL, { cache: "no-store" });
        if (response.ok) {
          const parsed = (await response.json()) as TagsByTransactionId;
          if (!cancelled) {
            setTagsByTransactionId(parsed);
          }
          return;
        }
      } catch {
        // fall back to local storage
      }

      try {
        const stored = localStorage.getItem(TAGS_STORAGE_KEY);
        if (!cancelled && stored) {
          setTagsByTransactionId(JSON.parse(stored));
        }
      } catch {
        // ignore invalid local state
      }
    }

    loadTags().finally(() => {
      if (!cancelled) {
        setTagsHydrated(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // -----------------------------
  // PERSIST TAGS
  // -----------------------------
  useEffect(() => {
    if (!tagsHydrated) return;

    const payload = JSON.stringify(tagsByTransactionId);
    localStorage.setItem(TAGS_STORAGE_KEY, payload);

    fetch(TAGS_API_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: payload,
    }).catch(() => {
      // ignore API errors, keep local copy
    });
  }, [tagsByTransactionId, tagsHydrated]);

  // -----------------------------
  // LOAD DEFAULT CSV (FIXED TS ERROR ✅)
  // -----------------------------
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
        if (cancelled) return;

        const parsed = parseCsvTransactions(csvText);
        if (parsed.length > 0) {
          setTransactions(parsed);
          setLoadSource("auto");
        }
      } catch {
        // ignore missing or invalid default file
      }
    }

    loadDefaultCsv();

    return () => {
      cancelled = true;
    };
  }, []);

  // -----------------------------
  // MANUAL CSV UPLOAD
  // -----------------------------
  function onCsv(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      setTransactions(parseCsvTransactions(String(reader.result)));
      setLoadSource("manual");
    };
    reader.readAsText(file);
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
    if (tagFilter === "ALL") {
      return filteredBase;
    }

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

  // -----------------------------
  // TAG ACTIONS
  // -----------------------------
  function updateTagDraft(transactionId: string, value: string): void {
    setTagDraftByTransactionId((prev) => ({
      ...prev,
      [transactionId]: value,
    }));
  }

  function addTag(transactionId: string, tagRaw: string): void {
    const tag = tagRaw.trim().toLowerCase();
    if (!tag) return;

    setTagsByTransactionId((prev) => {
      const current = prev[transactionId] ?? [];
      if (current.includes(tag)) return prev;
      return { ...prev, [transactionId]: [...current, tag] };
    });

    setTagDraftByTransactionId((prev) => ({
      ...prev,
      [transactionId]: "",
    }));
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
  // UI
  // -----------------------------
  return (
    <div
      style={{
        minHeight: "100vh",
        padding: 20,
        background:
          "radial-gradient(circle at top left, rgba(109,58,124,0.08), transparent 34%), linear-gradient(180deg, #f7f4fb 0%, #f4f6fb 100%)",
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          display: "grid",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>FamFin</div>
            <h1 style={{ margin: 0, fontSize: 28 }}>Tagger og transaksjoner</h1>
          </div>

          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              type="file"
              accept=".csv"
              onChange={(e) => e.target.files && onCsv(e.target.files[0])}
            />
            <button onClick={onLogout}>Logg ut</button>
          </div>
        </div>

        {loadSource === "auto" && <p>Bruker transactions.csv fra public</p>}
        {loadSource === "manual" && <p>Bruker manuelt opplastet CSV</p>}

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            padding: 16,
            borderRadius: 18,
            background: "rgba(255,255,255,0.78)",
            border: "1px solid rgba(109,58,124,0.12)",
            boxShadow: "0 12px 30px rgba(17,24,39,0.06)",
            backdropFilter: "blur(8px)",
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Kategori</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryFilter)}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #d8dbe3",
              }}
            >
              <option value="ALL">Alle</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Måned</span>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value as string | "ALL")}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #d8dbe3",
              }}
            >
              <option value="ALL">Alle</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Avsender/mottaker
            </span>
            <select
              value={party}
              onChange={(e) => setParty(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #d8dbe3",
              }}
            >
              <option value="ALL">Alle</option>
              {parties.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Taggfilter</span>
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #d8dbe3",
              }}
            >
              {tags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          }}
        >
          <Kpi title="Netto" value={`${total.toLocaleString("nb-NO")} kr`} />
          <Kpi title="Transaksjoner" value={filtered.length} />
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {filtered.map((tx) => {
            const currentTags = tagsByTransactionId[tx.id] ?? [];
            const draft = tagDraftByTransactionId[tx.id] ?? "";

            return (
              <article
                key={tx.id}
                style={{
                  padding: 16,
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.9)",
                  border: "1px solid rgba(17,24,39,0.06)",
                  boxShadow: "0 10px 24px rgba(17,24,39,0.05)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#6b7280",
                        marginBottom: 4,
                      }}
                    >
                      {tx.date}
                    </div>
                    <strong
                      style={{
                        display: "block",
                        fontSize: 16,
                        marginBottom: 4,
                      }}
                    >
                      {tx.description}
                    </strong>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>
                      {tx.category}
                    </div>
                  </div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 16,
                      color: tx.amount < 0 ? "#b91c1c" : "#15803d",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {tx.amount.toLocaleString("nb-NO")} kr
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  {currentTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => removeTag(tx.id, tag)}
                      style={{
                        border: "1px solid rgba(109,58,124,0.18)",
                        background: "#f3ecf8",
                        color: "#6d3a7c",
                        borderRadius: 999,
                        padding: "6px 10px",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      #{tag} ×
                    </button>
                  ))}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 12,
                    alignItems: "center",
                  }}
                >
                  <input
                    value={draft}
                    onChange={(e) => updateTagDraft(tx.id, e.target.value)}
                    placeholder="Legg til tagg"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid #d8dbe3",
                      background: "#fff",
                    }}
                  />
                  <button
                    onClick={() => addTag(tx.id, draft)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: "none",
                      background: "#6d3a7c",
                      color: "white",
                      cursor: "pointer",
                    }}
                  >
                    Legg til
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
