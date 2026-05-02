export type CategoryId =
  | "Inntekt"
  | "Sparing"
  | "Veldedighet"
  | "Diverse"
  | "Bolig & Kommunale tjenester"
  | "Mat & Dagligvarer"
  | "Transport & Bil"
  | "Helse & Personlig pleie"
  | "Overføringer – Privat"
  | "Spill & Gambling"
  | "Klær & Utstyr"
  | "Forsikring"
  | "Strøm"
  | "Victoria"
  | "Restaurant & Uteliv"
  | "Hjem & Interiør"
  | "Studielån"
  | "Fritid"
  | "Abonnement"
  | "Lån"
  | "Gaver";

export type CategoryFilter = CategoryId | "ALL";

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: CategoryId;
  fraKonto: string;
  fraKontonr: string;
  tilKonto: string;
  tilKontonr: string;
}

type CategoryRule = {
  match: RegExp;
  cat: CategoryId;
};

const GENERIC_PARTIES = new Set([
  "Felleskonto",
  "BULDER BOLIGLÅN UNG",
  "BULDER BOLIGLÅN",
  "CLAS OHLSON",
  "Clas Ohlson",
  "Trumf As",
  "trumf",
  "Desiree Yanikain Bendu",
]);
const INCOME_ACCOUNT_NUMBERS = new Set(["0539.37.99953", "3610.78.44540"]);
const INCOME_SOURCES = [
  "bulderbrukskonto",
  "36107844540",
  "3610784454",
  "05393799953",
  "helgebrown",
];

export const ALL_CATEGORIES: readonly CategoryId[] = [
  "Inntekt",
  "Sparing",
  "Veldedighet",
  "Bolig & Kommunale tjenester",
  "Mat & Dagligvarer",
  "Restaurant & Uteliv",
  "Transport & Bil",
  "Helse & Personlig pleie",
  "Klær & Utstyr",
  "Hjem & Interiør",
  "Forsikring",
  "Strøm",
  "Studielån",
  "Victoria",
  "Spill & Gambling",
  "Fritid",
  "Abonnement",
  "Lån",
  "Gaver",
  "Overføringer – Privat",
  "Diverse",
] as const;

const RULES: readonly CategoryRule[] = [
  {
    match: /(lanekassen|statens lanekasse|statens l.nekasse for utdannin)/i,
    cat: "Studielån",
  },
  {
    match:
      /(lønn|lonn|salary|utbetaling|trumf|barnetrygd|tra i lønn|trakk for lite i lønn)/i,
    cat: "Inntekt",
  },
  { match: /(spar|mikrospar|fond|aksje|invest)/i, cat: "Sparing" },
  {
    match:
      /(amnesty|wwf|rode kors|dyrevern|tv-aksjonen|spleis|palestinakomiteen|fattighuset|avaaz)/i,
    cat: "Veldedighet",
  },
  {
    match:
      /(if forsikring|gjensidige|tryg|frende|storebrand forsikring|fremtind|codan|sparebank.*forsikring|dnb.*forsikring)/i,
    cat: "Forsikring",
  },
  {
    match:
      /(tibber|gudbrandsdal energi|fjordkraft|lyse|vibb|hafslund|fortum|nettleie)/i,
    cat: "Strøm",
  },
  {
    match:
      /(victoria|babysam|lekmer|lekolar|jollyroom|mumio|babyshop|sebra|mini rodini|smallstuff|name it|barneklær|barnemat|bleie|pampers|huggies|lilleba|babynest|barnevogn|koelstra|stokke|cybex|bugaboo|maxi-cosi|barnehage|sfo|aktivitetsskole|babysitter|Oslo Kommune Utdanningsetaten)/i,
    cat: "Victoria",
  },
  {
    match:
      /(restaurant|kafe|kafé|bar |pub |nattklubb|tapas|sushi|burrito|burger|grill|bistro|brasserie|uteliv|afterski|cocktail|vinbar|bryggeri|worldclass|olivia|cargo|justisen|internasjonalen|bon lío|bon lio|wolt|foodora|kebab|pizza|subway|texburger|illegal burger|kaffebrenneriet|\bkod\b)/i,
    cat: "Restaurant & Uteliv",
  },
  {
    match:
      /(rema|kiwi|joker|backstube|coop|meny|oda|vinmonopolet|stop go|narvesen|extra|maximat)/i,
    cat: "Mat & Dagligvarer",
  },
  {
    match:
      /(ruter|vy|buss|tog|taxi|uber|bolt|bom|parkering|circle k|esso|st1|vianor)/i,
    cat: "Transport & Bil",
  },
  {
    match:
      /(lege|apotek|tannlege|psykolog|boots|specavers|barber|hair|klinikk|house of curls|Skinsecret)/i,
    cat: "Helse & Personlig pleie",
  },
  {
    match:
      /(kappahl|xxl|sport outlet|shoeday|kicks|zalando|cirkulaer|uff|tise|lindex|fretex)/i,
    cat: "Klær & Utstyr",
  },
  {
    match:
      /(bohus|skeidar|jysk|søstrene grene|sostrene grene|desenio|obs bygg|byggmakker|maxbo|mio |bolia|kitchn|ilva|nille|home&cottage|elkjøp|elkjop|power|netonnet|clas ohlson|sandviks|biltema|europris|ikea|mester grønn|tilbords|megaflis|illums|jula|princess|right price tiles|kid interiør|kid interio)/i,
    cat: "Hjem & Interiør",
  },
  {
    match:
      /(husleie|obos|sans|nordea finans|svarttjernborettslag|oslo kommune|kontingent|nedbetaling.*lan|lan.*nedbetaling|bulder boliglan)/i,
    cat: "Bolig & Kommunale tjenester",
  },
  { match: /^til: /i, cat: "Overføringer – Privat" },
  { match: /(norsk tipping)/i, cat: "Spill & Gambling" },
  {
    match:
      /(kino|stolt trening|valerenga|vålerenga|gym|treningssenter|sats |fresh fitness|evo fitness|bibliotek|museum|ticketco|ishockey|konsert|kultur|reise|hotell|hotel|flysamlingen|dubliner|escape room|paintball|bowling|aktivitetspark|bergenbanen|flybuss)/i,
    cat: "Fritid",
  },
  {
    match:
      /(apple|babyverden|spotify|netflix|viaplay|icloud|google play|apple\.com|bookbeat|hbo max|disney\+|storytel|audible)/i,
    cat: "Abonnement",
  },
];

export function isCategoryId(value?: string): value is CategoryId {
  return !!value && (ALL_CATEGORIES as readonly string[]).includes(value);
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseAmount(rawAmount: string): number {
  const parsed = parseFloat(rawAmount.replace(".", "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getField(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    if (row[key]) {
      return row[key];
    }
  }
  return "";
}

// Enkel overstyring for inntekt før vanlige regex-regler.
function householdIncomeOverride(text: string): CategoryId | null {
  const normalizedText = normalize(text);
  const compact = normalizedText.replace(/[^a-z0-9]/g, "");

  if (
    normalizedText.includes("overforing") &&
    (normalizedText.includes("felles") ||
      normalizedText.includes("felleskonto") ||
      normalizedText.includes("nicole"))
  ) {
    return "Inntekt";
  }

  if (INCOME_SOURCES.some((source) => compact.includes(source))) {
    return "Inntekt";
  }

  return null;
}

function isIncomeAccount(fraKontonr: string, fraKonto: string): boolean {
  if (INCOME_ACCOUNT_NUMBERS.has(fraKontonr.trim())) {
    return true;
  }
  const compactKonto = fraKonto.toLowerCase().replace(/\s+/g, "");
  return compactKonto.includes("bulderbrukskonto");
}

export function autoCategory(text: string): CategoryId {
  const normalizedText = normalize(text);
  const override = householdIncomeOverride(text);

  if (override) {
    return override;
  }

  for (const rule of RULES) {
    if (rule.match.test(normalizedText)) {
      return rule.cat;
    }
  }

  return "Diverse";
}

/**
 * Parser én Bulder CSV-fil til interne transaksjoner.
 * Forventet separator: semikolon.
 */
export function parseCsvTransactions(csvText: string): Transaction[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(";");

  return lines.slice(1).map((line, index) => {
    const values = line.split(";");
    const row = Object.fromEntries(
      headers.map((header, colIndex): [string, string] => [
        header,
        values[colIndex] ?? "",
      ]),
    ) as Record<string, string>;

    const amount = parseAmount(getField(row, "Beløp", "Belop", "0"));
    const tekst = getField(row, "Tekst");
    const type = getField(row, "Type");
    const fraKontoRaw = getField(row, "Fra konto", "Fra");
    const fraKontonr = getField(row, "Fra kontonummer", "Fra kontonr");
    const tilKonto = getField(row, "Til konto", "Til");
    const tilKontonr = getField(row, "Til kontonummer", "Til kontonr");
    const explicitCategory = getField(row, "Kategori");

    // Når avsenderkonto mangler, bruk tekstfeltet som avsender ved betaling.
    const fraKonto =
      fraKontoRaw ||
      (type === "Betaling" && tekst && tekst !== tilKonto ? tekst : "");

    // Description er det brukeren ser i tabellen.
    const descriptionParts = [tekst || type];
    if (fraKonto && fraKonto !== tilKonto && !GENERIC_PARTIES.has(fraKonto)) {
      descriptionParts.push(fraKonto);
    }
    const description = [...new Set(descriptionParts)]
      .filter(Boolean)
      .join(" – ");

    // Brukes kun for kategoriseringsregler.
    const categoryContext = [tekst, type, fraKonto, fraKontonr, tilKonto]
      .filter(Boolean)
      .join(" ");

    return {
      id: `${getField(row, "Dato", "ukjent")}-${index}`,
      date: getField(row, "Dato"),
      description,
      amount,
      fraKonto,
      fraKontonr,
      tilKonto,
      tilKontonr,
      category: isIncomeAccount(fraKontonr, fraKonto)
        ? "Inntekt"
        : isCategoryId(explicitCategory)
          ? explicitCategory
          : autoCategory(categoryContext),
    };
  });
}

/** Henter tilgjengelige måneder som YYYY-MM. */
export function extractMonths(transactions: Transaction[]): string[] {
  return Array.from(
    new Set(transactions.map((t) => t.date.slice(0, 7))),
  ).sort();
}

/** Henter tilgjengelige år som YYYY. */
export function extractYears(transactions: Transaction[]): string[] {
  return Array.from(new Set(transactions.map((t) => t.date.slice(0, 4))))
    .sort()
    .reverse();
}

/** Henter kategorier som faktisk finnes i datasettet. */
export function extractCategories(
  transactions: Transaction[],
): CategoryFilter[] {
  return [
    "ALL",
    ...Array.from(new Set(transactions.map((t) => t.category))).sort((a, b) =>
      a.localeCompare(b, "nb"),
    ),
  ];
}

/** Henter part-navn (avsender/mottaker) til part-filteret. */
export function extractParties(transactions: Transaction[]): string[] {
  const names = new Set<string>();
  for (const transaction of transactions) {
    if (transaction.fraKonto) {
      names.add(transaction.fraKonto);
    }
    if (transaction.tilKonto) {
      names.add(transaction.tilKonto);
    }
  }

  return [
    "ALL",
    ...Array.from(names)
      .filter((name) => !GENERIC_PARTIES.has(name))
      .sort(),
  ];
}

/**
 * Filtrerer transaksjoner på kategori, måned og valgfri avsender/mottaker.
 */
export function filterTransactions(
  transactions: Transaction[],
  category: CategoryFilter,
  month: string | "ALL",
  party: string | "ALL" = "ALL",
): Transaction[] {
  return transactions.filter(
    (transaction) =>
      (category === "ALL" || transaction.category === category) &&
      (month === "ALL" || transaction.date.startsWith(month)) &&
      (party === "ALL" ||
        transaction.fraKonto === party ||
        transaction.tilKonto === party),
  );
}

export function sumTransactions(transactions: Transaction[]): number {
  return transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
}
