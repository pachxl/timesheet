import { Client, VoiceState } from "discord.js";
import db from "./db";

const stmts = {
  startSession: db.prepare(
    "INSERT INTO voice_sessions (user_id, guild_id, channel_id, joined_at) VALUES (?, ?, ?, ?)"
  ),
  endSession: db.prepare(
    "UPDATE voice_sessions SET left_at = ? WHERE user_id = ? AND guild_id = ? AND left_at IS NULL"
  ),
  endAllSessions: db.prepare(
    "UPDATE voice_sessions SET left_at = ? WHERE left_at IS NULL"
  ),
};

export function handleVoiceStateUpdate(
  oldState: VoiceState,
  newState: VoiceState
) {
  const userId = newState.id;
  const guildId = newState.guild.id;
  const now = Math.floor(Date.now() / 1000);

  const wasInChannel = !!oldState.channelId;
  const isInChannel = !!newState.channelId;

  if (!wasInChannel && isInChannel) {
    stmts.startSession.run(userId, guildId, newState.channelId!, now);
  } else if (wasInChannel && !isInChannel) {
    stmts.endSession.run(now, userId, guildId);
  } else if (
    wasInChannel &&
    isInChannel &&
    oldState.channelId !== newState.channelId
  ) {
    stmts.endSession.run(now, userId, guildId);
    stmts.startSession.run(userId, guildId, newState.channelId!, now);
  }
}

export function closeAllSessions() {
  const now = Math.floor(Date.now() / 1000);
  stmts.endAllSessions.run(now);
}

export async function syncExistingVoiceUsers(client: Client, guildId: string) {
  const now = Math.floor(Date.now() / 1000);
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  for (const [, state] of guild.voiceStates.cache) {
    if (state.channelId && !state.member?.user.bot) {
      stmts.startSession.run(state.id, guildId, state.channelId, now);
    }
  }
}
