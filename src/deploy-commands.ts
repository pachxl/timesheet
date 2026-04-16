import { REST, Routes } from "discord.js";
import { commands } from "./commands";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId || !guildId) {
  process.exit(1);
}

const rest = new REST().setToken(token);
const body = commands.map((c) => c.toJSON());
await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
