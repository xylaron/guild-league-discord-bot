const { REST, Routes } = require("discord.js");

require("dotenv").config();
const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
const clientId = process.env.DISCORD_CLIENT_ID;

const commands = [
  {
    name: "聯賽",
    description: "創建一個聯賽報名",
    options: [
      {
        name: "時間",
        type: 3, // STRING
        description: "聯賽時間 (HHmm) e.g. 2130",
        required: false,
      },
    ],
  },
];

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  try {
    console.log("Started refreshing application (/) commands.");

    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands,
    });

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
})();
