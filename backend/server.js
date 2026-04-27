import express from "express";
import Database from "better-sqlite3";
import { promises as fs } from "node:fs";
import path from "node:path";

const PORT = Number(process.env.PORT || 3001);
const DATA_DIR = path.resolve(process.cwd(), process.env.DATA_DIR || "data");
const DB_PATH = process.env.TAGS_DB_PATH
  ? path.resolve(process.env.TAGS_DB_PATH)
  : path.join(DATA_DIR, "tags.db");
const LEGACY_TAGS_FILE = path.join(DATA_DIR, "tags.json");
const DIST_DIR = path.resolve(process.cwd(), "dist");

const app = express();
app.use(express.json({ limit: "1mb" }));

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function setupSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS transaction_tags (
      transaction_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY (transaction_id, tag)
    )
  `);
}

async function migrateLegacyJsonIfNeeded(db) {
  const row = db
    .prepare("SELECT COUNT(*) as count FROM transaction_tags")
    .get();
  if ((row?.count ?? 0) > 0) {
    return;
  }

  try {
    await fs.access(LEGACY_TAGS_FILE);
  } catch {
    return;
  }

  try {
    const raw = await fs.readFile(LEGACY_TAGS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return;
    }

    const insert = db.prepare(
      "INSERT OR IGNORE INTO transaction_tags (transaction_id, tag) VALUES (?, ?)",
    );
    const tx = db.transaction((payload) => {
      Object.entries(payload).forEach(([transactionId, tags]) => {
        if (!Array.isArray(tags)) {
          return;
        }
        tags.forEach((tag) => {
          if (typeof tag !== "string") {
            return;
          }
          const normalizedTag = tag.trim();
          if (!normalizedTag) {
            return;
          }
          insert.run(transactionId, normalizedTag);
        });
      });
    });

    tx(parsed);
  } catch {
    // Ignore migration issues and continue with an empty DB.
  }
}

async function initDb() {
  await ensureDataDir();
  const db = new Database(DB_PATH);
  setupSchema(db);
  await migrateLegacyJsonIfNeeded(db);
  return db;
}

function readTags(db) {
  const rows = db
    .prepare(
      "SELECT transaction_id, tag FROM transaction_tags ORDER BY transaction_id, tag",
    )
    .all();

  const result = {};
  rows.forEach((row) => {
    if (!result[row.transaction_id]) {
      result[row.transaction_id] = [];
    }
    result[row.transaction_id].push(row.tag);
  });

  return result;
}

function writeTags(db, payload) {
  const clear = db.prepare("DELETE FROM transaction_tags");
  const insert = db.prepare(
    "INSERT INTO transaction_tags (transaction_id, tag) VALUES (?, ?)",
  );

  const tx = db.transaction((nextPayload) => {
    clear.run();

    Object.entries(nextPayload).forEach(([transactionId, tags]) => {
      tags.forEach((tag) => {
        insert.run(transactionId, tag.trim());
      });
    });
  });

  tx(payload);
}

function isValidTagsPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  return Object.values(payload).every(
    (tags) =>
      Array.isArray(tags) &&
      tags.every((tag) => typeof tag === "string" && tag.trim().length > 0),
  );
}

const db = await initDb();

app.get("/api/tags", (_req, res) => {
  try {
    const tags = readTags(db);
    res.setHeader("Cache-Control", "no-store");
    res.json(tags);
  } catch {
    res.status(500).json({ error: "Kunne ikke lese tags" });
  }
});

app.put("/api/tags", (req, res) => {
  if (!isValidTagsPayload(req.body)) {
    res.status(400).json({ error: "Ugyldig tags-format" });
    return;
  }

  try {
    writeTags(db, req.body);
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Kunne ikke lagre tags" });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use(express.static(DIST_DIR));

app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Tags API running on http://localhost:${PORT}`);
  console.log(`SQLite path: ${DB_PATH}`);
});
