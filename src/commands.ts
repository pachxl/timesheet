import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { getLeaderboard, formatDuration } from "./leaderboard";

type Period = "daily" | "weekly" | "total";

const periodLabels: Record<Period, string> = {
  daily: "Today",
  weekly: "This Week",
  total: "All Time",
};

export const commands = [
  new SlashCommandBuilder()
    .setName("timesheet")
    .setDescription("Leaderboard")
    .addStringOption((opt) =>
      opt
        .setName("period")
        .setDescription("Time period")
        .setRequired(false)
        .addChoices(
          { name: "Today", value: "daily" },
          { name: "This Week", value: "weekly" },
          { name: "All Time", value: "total" },
        ),
    ),
];

export async function handleCommand(interaction: ChatInputCommandInteraction) {
  if (interaction.commandName !== "timesheet") return;

  const period = (interaction.options.getString("period") ?? "total") as Period;
  const guildId = interaction.guildId!;
  const rows = getLeaderboard(guildId, period);

  if (rows.length === 0) {
    await interaction.reply({
      content: `no call records for **${periodLabels[period]}**.`,
      ephemeral: true,
    });
    return;
  }

  const lines = await Promise.all(
    rows.map(async (row, i) => {
      const medal =
        i === 0 ? " :first_place:" : i === 1 ? " :second_place:" : i === 2 ? " :third_place:" : "";
      const member = await interaction.guild!.members.fetch(row.user_id).catch(() => null);
      const name = member?.displayName ?? `<@${row.user_id}>`;
      return `**${i + 1}.** ${name}${medal} — \`${formatDuration(row.total_seconds)}\``;
    }),
  );

  const embed = new EmbedBuilder()
    .setTitle(`Timesheet — ${periodLabels[period]}`)
    .setDescription(lines.join("\n"))
    .setColor(0x5865f2)
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
