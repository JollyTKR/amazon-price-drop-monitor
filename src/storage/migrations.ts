import Database from "better-sqlite3";

export type SqliteDatabase = ReturnType<typeof Database>;

export function openDatabase(databasePath: string): SqliteDatabase {
  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function runMigrations(db: SqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS price_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      product_url TEXT NOT NULL,
      checked_at TEXT NOT NULL,
      price_cents INTEGER,
      currency TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      source TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_price_checks_product_checked_at
      ON price_checks (product_id, checked_at);

    CREATE INDEX IF NOT EXISTS idx_price_checks_latest_success
      ON price_checks (product_id, status, checked_at);

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      previous_price_cents INTEGER NOT NULL,
      current_price_cents INTEGER NOT NULL,
      drop_amount_cents INTEGER NOT NULL,
      drop_percent REAL NOT NULL,
      sent_at TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_product_sent_at
      ON notifications (product_id, sent_at);
  `);
}
