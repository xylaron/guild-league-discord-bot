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

function generateGuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

class SignupSession {
  constructor(title, deadline) {
    this.id = generateGuid();
    this.title = title;
    this.deadline = deadline;
    this.teamA = [];
    this.teamB = [];
  }

  createEmbed() {
    const formatTeam = (team) =>
      team.map((user) => user.displayName).join("\n") || "無";

    return new EmbedBuilder()
      .setTitle(`${this.title} 公會聯賽`)
      .setDescription(
        `(投票截止時間: ${this.deadline.toFormat("MM/dd HH:mm")})`
      )
      .setColor("#ff10f0")
      .addFields(
        {
          name: `打手 (${this.teamA.length}/9)`,
          value: formatTeam(this.teamA),
          inline: true,
        },
        {
          name: "\u200B", // Zero-width space for padding
          value: "\u200B", // Zero-width space for padding
          inline: true,
        },
        {
          name: `莎亦 (${this.teamB.length}/1)`,
          value: formatTeam(this.teamB),
          inline: true,
        }
      );
  }

  createActionRow() {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`team_a_${this.id}`)
        .setLabel("加入打手")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(this.teamA.length >= 9),
      new ButtonBuilder()
        .setCustomId(`team_b_${this.id}`)
        .setLabel("加入莎亦")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(this.teamB.length >= 1),
      new ButtonBuilder()
        .setCustomId(`clear_selection_${this.id}`)
        .setLabel("清除選項")
        .setStyle(ButtonStyle.Danger)
    );
  }

  handleButtonInteraction(interaction) {
    const userId = interaction.member.id;
    const userName = interaction.member.displayName;

    const user = { id: userId, displayName: userName };

    const findUserIndex = (team) => team.findIndex((u) => u.id === userId);

    if (interaction.customId === `team_a_${this.id}`) {
      if (findUserIndex(this.teamA) !== -1) {
        return interaction.reply({
          content: "你已經選擇了打手!",
          ephemeral: true,
        });
      } else if (this.teamA.length >= 9) {
        return interaction.reply({ content: "打手已滿!", ephemeral: true });
      }

      const indexB = findUserIndex(this.teamB);
      if (indexB !== -1) {
        this.teamB.splice(indexB, 1);
      }

      this.teamA.push(user);
    } else if (interaction.customId === `team_b_${this.id}`) {
      if (findUserIndex(this.teamB) !== -1) {
        return interaction.reply({
          content: "你已經選擇了莎亦!",
          ephemeral: true,
        });
      } else if (this.teamB.length >= 1) {
        return interaction.reply({ content: "莎亦已滿!", ephemeral: true });
      }

      const indexA = findUserIndex(this.teamA);
      if (indexA !== -1) {
        this.teamA.splice(indexA, 1);
      }

      this.teamB.push(user);
    } else if (interaction.customId === `clear_selection_${this.id}`) {
      const indexA = findUserIndex(this.teamA);
      const indexB = findUserIndex(this.teamB);

      if (indexA !== -1) {
        this.teamA.splice(indexA, 1);
      } else if (indexB !== -1) {
        this.teamB.splice(indexB, 1);
      } else {
        return interaction.reply({
          content: "你沒有加入任何隊伍!",
          ephemeral: true,
        });
      }
    }

    const embed = this.createEmbed();
    const row = this.createActionRow();

    return interaction.update({ embeds: [embed], components: [row] });
  }
}

const sessions = new Map();

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand() && !interaction.isButton()) return;

  if (interaction.isCommand()) {
    const { commandName, options } = interaction;

    if (commandName === "聯賽") {
      let title = options.getString("時間");

      // If the title is empty, calculate the next 00 or 30 minute time
      if (!title) {
        const now = DateTime.now().setZone("Asia/Shanghai"); // GMT+8
        let nextTime = now
          .plus({ minutes: 30 - (now.minute % 30) })
          .set({ second: 0, millisecond: 0 });

        if (nextTime.hour < 13 && nextTime.hour > 1) {
          nextTime = nextTime.set({ hour: 13, minute: 0 });
        }

        title = nextTime.toFormat("HHmm");
      }

      // Validate the time format
      if (!/^\d{4}$/.test(title)) {
        await interaction.reply({
          content: "錯誤時間格式! 請使用 HHmm 格式，例如 21:30 就輸入 2130.",
          ephemeral: true,
        });
        return;
      }

      const hours = parseInt(title.substring(0, 2), 10);
      const minutes = parseInt(title.substring(2, 4), 10);

      // Validate the time range and minute format
      if (
        !(
          ((hours >= 13 && hours <= 24) || // After 1 PM and before or at midnight
            (hours >= 0 && hours <= 1)) && // Midnight to 1 AM the next day
          (minutes === 0 || minutes === 30)
        ) // Minutes are 00 or 30
      ) {
        await interaction.reply({
          content:
            "錯誤時間! 聯賽時間應該在 13:00 到 01:00 之間，且應該是 整點 或 30分.",
          ephemeral: true,
        });
        return;
      }

      // Set the deadline in GMT+8
      const now = DateTime.now().setZone("Asia/Shanghai"); // GMT+8
      let deadline = now.set({
        hour: hours,
        minute: minutes,
        second: 0,
        millisecond: 0,
      });

      // Adjust deadline if it is before the current time
      if ((hours === 0 && hours === 1) || deadline < now) {
        deadline = deadline.plus({ days: 1 });
      }

      const session = new SignupSession(title, deadline);
      sessions.set(session.id, session);

      const embed = session.createEmbed();
      const row = session.createActionRow();

      await interaction.reply({ embeds: [embed], components: [row] });

      // Schedule the disabling of buttons and cleanup
      const delay = deadline.toMillis() - now.toMillis();
      setTimeout(async () => {
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`team_a_${session.id}`)
            .setLabel("加入打手")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId(`team_b_${session.id}`)
            .setLabel("加入莎亦")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId(`clear_selection_${session.id}`)
            .setLabel("清除選項")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true)
        );

        const updatedEmbed = new EmbedBuilder()
          .setTitle(`${title} 公會聯賽`)
          .setDescription(`投票已截止。`)
          .setColor("#ff10f0")
          .addFields(
            {
              name: `打手 (${session.teamA.length}/9)`,
              value:
                session.teamA.map((user) => user.displayName).join("\n") ||
                "無",
              inline: true,
            },
            {
              name: "\u200B\u200B", // Zero-width space for padding
              value: "\u200B\u200B", // Zero-width space for padding
              inline: true,
            },
            {
              name: `莎亦 (${session.teamB.length}/1)`,
              value:
                session.teamB.map((user) => user.displayName).join("\n") ||
                "無",
              inline: true,
            }
          );

        await interaction.editReply({
          embeds: [updatedEmbed],
          components: [disabledRow],
        });

        // Cleanup the session
        sessions.delete(session.id);
      }, delay);
    }
  } else if (interaction.isButton()) {
    const sessionId = interaction.customId.split("_").slice(2).join("_");
    const session = sessions.get(sessionId);

    if (session) {
      await session.handleButtonInteraction(interaction);
    }
  }
});

client.login(token);
