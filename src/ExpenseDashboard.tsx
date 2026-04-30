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
    <div style={{ minHeight: "100vh", background: "#f5f6fa" }}>
      <button onClick={onLogout}>Logg ut</button>

      <input
        type="file"
        accept=".csv"
        onChange={(e) => e.target.files && onCsv(e.target.files[0])}
      />

      {loadSource === "auto" && <p>Bruker transactions.csv fra public</p>}
      {loadSource === "manual" && <p>Bruker manuelt opplastet CSV</p>}

      <Kpi title="Netto" value={`${total.toLocaleString("nb-NO")} kr`} />
      <Kpi title="Transaksjoner" value={filtered.length} />

      {/* Tabellen / resten av UI-en din kan være uendret her */}
    </div>
  );
}
