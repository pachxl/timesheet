import db from "./db";

interface LeaderboardRow {
  user_id: string;
  total_seconds: number;
}

type Period = "daily" | "weekly" | "total";

function getPeriodStart(period: Period): number | null {
  if (period === "total") return null;

  const now = new Date();

  if (period === "daily") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.floor(start.getTime() / 1000);
  }

  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = start.getDay();
  const diff = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - diff);
  return Math.floor(start.getTime() / 1000);
}

export function getLeaderboard(guildId: string, period: Period): LeaderboardRow[] {
  const periodStart = getPeriodStart(period);
  const now = Math.floor(Date.now() / 1000);

  if (periodStart === null) {
    return db
      .prepare(
        `SELECT user_id,
                SUM(COALESCE(left_at, ?) - joined_at) AS total_seconds
         FROM voice_sessions
         WHERE guild_id = ?
         GROUP BY user_id
         ORDER BY total_seconds DESC
         LIMIT 25`,
      )
      .all(now, guildId) as LeaderboardRow[];
  }

  return db
    .prepare(
      `SELECT user_id,
              SUM(COALESCE(left_at, ?) - MAX(joined_at, ?)) AS total_seconds
       FROM voice_sessions
       WHERE guild_id = ?
         AND COALESCE(left_at, ?) > ?
       GROUP BY user_id
       HAVING total_seconds > 0
       ORDER BY total_seconds DESC
       LIMIT 25`,
    )
    .all(now, periodStart, guildId, now, periodStart) as LeaderboardRow[];
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
