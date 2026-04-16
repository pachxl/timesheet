import { Database } from "bun:sqlite";

const db = new Database("timesheet.db", { create: true });

db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA foreign_keys = ON");

db.run(`
  CREATE TABLE IF NOT EXISTS voice_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    joined_at INTEGER NOT NULL,
    left_at INTEGER
  )
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_sessions_user_guild
  ON voice_sessions (user_id, guild_id)
`);

db.run(`
  CREATE INDEX IF NOT EXISTS idx_sessions_joined
  ON voice_sessions (joined_at)
`);

export default db;
