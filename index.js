const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  EmbedBuilder,
} = require("discord.js");
const { DateTime } = require("luxon");
require("dotenv").config();
const token = process.env.DISCORD_BOT_TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const teamA = [];
const teamB = [];

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand() && !interaction.isButton()) return;

  if (interaction.isCommand()) {
    const { commandName, options } = interaction;

    if (commandName === "聯賽") {
      const title = options.getString("時間");

      // Validate the time format
      if (!/^\d{4}$/.test(title)) {
        await interaction.reply({
          content: "無效的時間格式! 請使用 HHmm 格式，例如 21:30 就輸入 2130.",
          ephemeral: true,
        });
        return;
      }

      const hours = parseInt(title.substring(0, 2), 10);
      const minutes = parseInt(title.substring(2, 4), 10);

      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        await interaction.reply({
          content: "無效的時間! 時間應該要在 0000 到 2359 之間.",
          ephemeral: true,
        });
        return;
      }

      // Set the deadline in GMT+8
      const now = DateTime.now().setZone("Asia/Shanghai"); // GMT+8
      const deadline = now.set({
        hour: hours,
        minute: minutes,
        second: 0,
        millisecond: 0,
      });

      const embed = new EmbedBuilder()
        .setTitle(`${title} 公會聯賽`)
        .setDescription(`(投票截止時間: ${deadline.toFormat("HH:mm")})`)
        .addFields(
          {
            name: `打手 (${teamA.length}/9)`,
            value: teamA.join("\n") || "無",
            inline: true,
          },
          {
            name: "\u200B", // Zero-width space for padding
            value: "\u200B", // Zero-width space for padding
            inline: true,
          },
          {
            name: `莎亦 (${teamB.length}/1)`,
            value: teamB.join("\n") || "無",
            inline: true,
          }
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("team_a")
          .setLabel("加入打手")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(teamA.length >= 9),
        new ButtonBuilder()
          .setCustomId("team_b")
          .setLabel("加入莎亦")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(teamB.length >= 1),
        new ButtonBuilder()
          .setCustomId("clear_selection")
          .setLabel("清除選項")
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.reply({ embeds: [embed], components: [row] });

      // Schedule the disabling of buttons
      const delay = deadline.toMillis() - now.toMillis();
      setTimeout(async () => {
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("team_a")
            .setLabel("加入打手")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("team_b")
            .setLabel("加入莎亦")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("clear_selection")
            .setLabel("清除選項")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true)
        );

        const updatedEmbed = new EmbedBuilder()
          .setTitle(`${title} 公會聯賽`)
          .setDescription(`投票已截止。`)
          .addFields(
            {
              name: `打手 (${teamA.length}/9)`,
              value: teamA.join("\n") || "無",
              inline: true,
            },
            {
              name: "\u200B\u200B", // Zero-width space for padding
              value: "\u200B\u200B", // Zero-width space for padding
              inline: true,
            },
            {
              name: `莎亦 (${teamB.length}/1)`,
              value: teamB.join("\n") || "無",
              inline: true,
            }
          );

        await interaction.editReply({
          embeds: [updatedEmbed],
          components: [disabledRow],
        });
      }, delay);
    }
  } else if (interaction.isButton()) {
    const userId = interaction.user.id;
    const userName = interaction.member.displayName;

    if (interaction.customId === "team_a") {
      if (teamA.includes(userName)) {
        await interaction.reply({
          content: "你已經在打手 中了!",
          ephemeral: true,
        });
        return;
      } else if (teamA.length >= 9) {
        await interaction.reply({ content: "打手已滿!", ephemeral: true });
        return;
      }

      const indexB = teamB.indexOf(userName);
      if (indexB !== -1) {
        teamB.splice(indexB, 1);
      }

      teamA.push(userName);
    } else if (interaction.customId === "team_b") {
      if (teamB.includes(userName)) {
        await interaction.reply({
          content: "你已經在莎亦 中了!",
          ephemeral: true,
        });
        return;
      } else if (teamB.length >= 1) {
        await interaction.reply({ content: "莎亦已滿!", ephemeral: true });
        return;
      }

      const indexA = teamA.indexOf(userName);
      if (indexA !== -1) {
        teamA.splice(indexA, 1);
      }

      teamB.push(userName);
    } else if (interaction.customId === "clear_selection") {
      const indexA = teamA.indexOf(userName);
      const indexB = teamB.indexOf(userName);

      if (indexA !== -1) {
        teamA.splice(indexA, 1);
      } else if (indexB !== -1) {
        teamB.splice(indexB, 1);
      } else {
        await interaction.reply({
          content: "你沒有加入任何隊伍!",
          ephemeral: true,
        });
        return;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(`${interaction.message.embeds[0].title}`)
      .setDescription(interaction.message.embeds[0].description)
      .addFields(
        {
          name: `打手 (${teamA.length}/9)`,
          value: teamA.join("\n") || "無",
          inline: true,
        },
        {
          name: "\u200B",
          value: "\u200B",
          inline: true,
        },
        {
          name: `莎亦 (${teamB.length}/1)`,
          value: teamB.join("\n") || "無",
          inline: true,
        }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("team_a")
        .setLabel("加入打手")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(teamA.length >= 9),
      new ButtonBuilder()
        .setCustomId("team_b")
        .setLabel("加入莎亦")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(teamB.length >= 1),
      new ButtonBuilder()
        .setCustomId("clear_selection")
        .setLabel("清除選項")
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.update({ embeds: [embed], components: [row] });
  }
});

client.login(token);
