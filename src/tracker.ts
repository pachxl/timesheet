import { Client, VoiceState, type VoiceBasedChannel } from "discord.js";
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
  hasOpenSession: db.prepare(
    "SELECT 1 FROM voice_sessions WHERE user_id = ? AND guild_id = ? AND left_at IS NULL LIMIT 1"
  ),
};

function nonBotCount(channel: VoiceBasedChannel): number {
  return channel.members.filter(m => !m.user.bot).size;
}

export function handleVoiceStateUpdate(
  oldState: VoiceState,
  newState: VoiceState
) {
  const userId = newState.id;
  const guildId = newState.guild.id;
  const now = Math.floor(Date.now() / 1000);

  const wasActive = !!oldState.channelId && !oldState.selfDeaf && !oldState.serverDeaf;
  const isActive = !!newState.channelId && !newState.selfDeaf && !newState.serverDeaf;
  const notAlone = newState.channel ? nonBotCount(newState.channel) > 1 : false;

  if (!wasActive && isActive) {
    if (notAlone) {
      stmts.startSession.run(userId, guildId, newState.channelId!, now);
    }
  } else if (wasActive && !isActive) {
    stmts.endSession.run(now, userId, guildId);
  } else if (
    wasActive &&
    isActive &&
    oldState.channelId !== newState.channelId
  ) {
    stmts.endSession.run(now, userId, guildId);
    if (notAlone) {
      stmts.startSession.run(userId, guildId, newState.channelId!, now);
    }
  }

  // Someone left/switched away — check if a user is now alone in the old channel
  if (oldState.channel && oldState.channelId !== newState.channelId) {
    const remaining = oldState.channel.members.filter(m => !m.user.bot);
    if (remaining.size === 1) {
      const loneUser = remaining.first()!;
      stmts.endSession.run(now, loneUser.id, guildId);
    }
  }

  // Someone joined/switched in — check if a previously-alone user needs a session started
  if (newState.channel && oldState.channelId !== newState.channelId) {
    const members = newState.channel.members.filter(m => !m.user.bot);
    if (members.size === 2) {
      const other = members.find(m => m.id !== userId);
      if (other && !other.voice.selfDeaf && !other.voice.serverDeaf) {
        if (!stmts.hasOpenSession.get(other.id, guildId)) {
          stmts.startSession.run(other.id, guildId, newState.channelId!, now);
        }
      }
    }
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
    if (
      state.channelId &&
      state.channel &&
      !state.member?.user.bot &&
      !state.selfDeaf &&
      !state.serverDeaf &&
      nonBotCount(state.channel) > 1
    ) {
      stmts.startSession.run(state.id, guildId, state.channelId, now);
    }
  }
}
