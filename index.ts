import { Client, Events, GatewayIntentBits } from "discord.js";
import {
  handleVoiceStateUpdate,
  closeAllSessions,
  syncExistingVoiceUsers,
} from "./src/tracker";
import { handleCommand } from "./src/commands";

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
if (!token || !guildId) {
  console.error("no DISCORD_TOKEN or DISCORD_GUILD_ID env var set");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`logged in as ${c.user.tag}`);

  closeAllSessions();

  await syncExistingVoiceUsers(client, guildId);
  console.log("loaded existing callers");
});

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  if (newState.guild.id !== guildId) return;
  try {
    handleVoiceStateUpdate(oldState, newState);
  } catch (err) {
    console.error("call update error:", err);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try {
    await handleCommand(interaction);
  } catch (err) {
    console.error(`command (${interaction.commandName}) error `, err);
    try {
      const reply = { content: "error loading leaderboard", ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    } catch {}
  }
});

process.on("unhandledRejection", (err) => {
  console.error("unhandledRejection", err);
});

process.on("uncaughtException", (err) => {
  console.error("uncaughtException", err);
});

// Clean shutdown
function shutdown() {
  console.log("shutting down");
  try {
    closeAllSessions();
  } catch (err) {
    console.error("error closing sessions", err);
  }
  client.destroy();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

client.login(token);
