require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { google } = require('googleapis');
const { MongoClient } = require('mongodb');
const express = require('express');
const { RateLimiter } = require('limiter');
const fetch = require('node-fetch');

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Promise Rejection:', error);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Rate limiter
const limiter = new RateLimiter({ tokensPerInterval: 50, interval: 'minute' });

// Slash commands
const commands = [
  { 
    name: 'addform', 
    description: 'Start tracking a Google Form' 
  },
  { 
    name: 'removeform', 
    description: 'Stop tracking a Google Form', 
    options: [
      { 
        name: 'sheetname', 
        description: 'Name of the Google Sheet', 
        type: 3, 
        required: true 
      }
    ] 
  },
  { 
    name: 'listforms', 
    description: 'List all tracked forms' 
  },
  { 
    name: 'ping', 
    description: 'Check bot latency and API status' 
  },
  { 
    name: 'dm', 
    description: 'Send a DM through the bot', 
    options: [
      { 
        name: 'user', 
        description: 'User to DM', 
        type: 6, 
        required: true 
      }, 
      { 
        name: 'text', 
        description: 'Message content', 
        type: 3, 
        required: true 
      }
    ] 
  },
  {
    name: 'cats',
    description: 'Shows random cat pictures'
  },
  { 
    name: 'checkupdates', 
    description: 'Manually check for any unsent form responses'
  },
  //  permission commands
  { 
    name: 'giveperms', 
    description: 'Grant permissions to a user',
    options: [
      { 
        name: 'user', 
        description: 'User to grant permissions to', 
        type: 6, 
        required: true 
      },
      { 
        name: 'permission', 
        description: 'Permission to grant', 
        type: 3, 
        required: true,
        choices: [
          { name: 'Manage Forms (add/remove/list)', value: 'manage_forms' },
          { name: 'Send DMs through bot', value: 'send_dms' },
          { name: 'Manage Employees (add/remove)', value: 'manage_employees' }
        ]
      }
    ]
  },
  { 
    name: 'revokeperms', 
    description: 'Revoke permissions from a user',
    options: [
      { 
        name: 'user', 
        description: 'User to revoke permissions from', 
        type: 6, 
        required: true 
      },
      { 
        name: 'permission', 
        description: 'Permission to revoke', 
        type: 3, 
        required: true,
        choices: [
          { name: 'Manage Forms (add/remove/list)', value: 'manage_forms' },
          { name: 'Send DMs through bot', value: 'send_dms' },
          { name: 'Manage Employees (add/remove)', value: 'manage_employees' }
        ]
      }
    ]
  },
  { 
    name: 'checkperms', 
    description: 'Check a user\'s permissions',
    options: [
      { 
        name: 'user', 
        description: 'User to check (leave empty for yourself)', 
        type: 6, 
        required: false 
      }
    ]
  },
  {
    name: 'setticketcategory',
    description: 'Set the category where tickets will be created',
    options: [{
      name: 'category',
      description: 'The category ID where tickets will be created',
      type: 3, // STRING type
      required: true
    }]
  },
  {
    name: 'closeticket',
    description: 'Close the current ticket channel',
  },
  {
    name: 'deleteticket',
    description: 'Delete the current ticket channel'
  },
  {
    name: 'maintenancelb',
    description: 'Put the site in maintenance mode for a specified duration',
    options: [
      {
        name: 'time',
        description: 'Duration in minutes (e.g. 30 for 30 minutes)',
        type: 4, // INTEGER type
        required: true
      }
    ]
  },
  {
    name: 'say',
    description: 'Send a normal message to a specified channel',
    options: [
      {
        name: 'channel',
        description: 'Channel to send the message to',
        type: 7, // CHANNEL type
        required: true
     },
     {
        name: 'text',
        description: 'Message to send',
        type: 3, // STRING type
        required: true
     }
    ]
  },
  {
    name: 'forcemaintenanceoff',
    description: 'Force turn off maintenance mode'
  },
  {
    name: 'booking',
    description: 'Create a car booking receipt',
    options: [
      {
        name: 'buyer_name',
        description: 'Name of the buyer',
        type: 3,
        required: true
      },
      {
        name: 'mobile',
        description: 'Buyer mobile number',
        type: 3,
        required: true
      },
      {
        name: 'model',
        description: 'Car model',
        type: 3,
        required: true
      },
      {
        name: 'license',
        description: 'License plate number',
        type: 3,
        required: true
      },
      {
        name: 'total',
        description: 'Total amount to pay',
        type: 10,
        required: true
      },
      {
        name: 'booking_amount',
        description: 'Booking amount paid',
        type: 10,
        required: true
      }
    ]
  },
  {
    name: 'sell',
    description: 'Create a vehicle purchase receipt',
    options: [
      {
        name: 'buyer_name',
        description: 'Name of the buyer',
        type: 3,
        required: true
      },
      {
        name: 'buyer_cid',
        description: 'CID of the buyer',
        type: 3,
        required: true
      },
      {
        name: 'buyer_number',
        description: 'Contact number of the buyer',
        type: 3,
        required: true
      },
      {
        name: 'model',
        description: 'Vehicle model',
        type: 3,
        required: true
      },
      {
        name: 'license',
        description: 'License plate number',
        type: 3,
        required: true
      },
      {
        name: 'price',
        description: 'Original price',
        type: 10,
        required: true
      },
      {
        name: 'discount',
        description: 'Discount percentage (0-100)',
        type: 10,
        required: true
      }
    ]
  },
  {
    name: 'newsell',
    description: 'Create a vehicle intake or acquisition receipt',
    options: [
      {
        name: 'type',
        description: 'Choose receipt type',
        type: 3, // STRING
        required: true,
        choices: [
          { name: 'Vehicle Intake', value: 'intake' },
          { name: 'Vehicle Acquisition', value: 'acquisition' }
        ]
      },
      {
        name: 'name',
        description: 'Name',
        type: 3,
        required: true
      },
      {
        name: 'contact',
        description: 'Contact Number',
        type: 3,
        required: true
      },
      {
        name: 'cid',
        description: 'CID',
        type: 3,
        required: true
      },
      {
        name: 'dmail',
        description: 'D-Mail',
        type: 3,
        required: true
      },
      {
        name: 'vehicle',
        description: 'Vehicle Name',
        type: 3,
        required: true
      },
      {
        name: 'license',
        description: 'License Plate',
        type: 3,
        required: true
      },
      {
        name: 'amount',
        description: 'Amount (Expected/ Paid)',
        type: 10,
        required: true
      },
      {
        name: 'transferred_to',
        description: 'Transferred To',
        type: 3,
        required: true
      },

      {
       name: 'help',
       description: 'Show all commands and their usage',
       type: 3 // or another appropriate type
      }
    ]
  },
  {
    name: 'add_employee',
    description: 'Add or update an employee for OTP login',
    options: [
      {
        name: 'employee_code',
        description: 'Employee code (unique)',
        type: 3, // STRING
        required: true
      },
      {
        name: 'name',
        description: 'Employee name',
        type: 3, // STRING
        required: true
      },
      {
        name: 'user',
        description: 'Discord user to link',
        type: 6, // USER
        required: true
      },
      {
        name: 'role',
        description: 'Role to assign (case-sensitive)',
        type: 3, // STRING
        required: true,
        choices: [
          { name: 'Affiliated Agent', value: 'Affiliated Agent' },
          { name: 'Apprentice Salesman', value: 'Apprentice Salesman' },
          { name: 'Sales Executive', value: 'Sales Executive' },
          { name: 'Senior Sales Executive', value: 'Senior Sales Executive' },
          { name: 'Sales Manager', value: 'Sales Manager' },
          { name: 'General Manager', value: 'General Manager' },
          { name: 'Boss', value: 'Boss' }
        ]
      }
    ]
  },
  {
    name: 'remove_employee',
    description: 'Remove an employee from OTP login',
    options: [
      {
        name: 'discord_id',
        description: 'Discord User ID to remove',
        type: 3, // STRING
        required: true
      }
    ]
  },
  {
    name: 'set_employee_role',
    description: 'Change the role of an existing employee',
    options: [
      {
        name: 'employee_code',
        description: 'Employee code of the user',
        type: 3, // STRING
        required: true
      },
      {
        name: 'role',
        description: 'New role to assign (case-sensitive)',
        type: 3, // STRING
        required: true,
        choices: [
          { name: 'Affiliated Agent', value: 'Affiliated Agent' },
          { name: 'Apprentice Salesman', value: 'Apprentice Salesman' },
          { name: 'Sales Executive', value: 'Sales Executive' },
          { name: 'Senior Sales Executive', value: 'Senior Sales Executive' },
          { name: 'Sales Manager', value: 'Sales Manager' },
          { name: 'General Manager', value: 'General Manager' },
          { name: 'Boss', value: 'Boss' }
        ]
      }
    ]
  },
];

// Validate environment
const REQUIRED_ENV = ['DISCORD_TOKEN', 'GOOGLE_SERVICE_ACCOUNT_BASE64', 'MONGO_URI'];
REQUIRED_ENV.forEach(variable => {
  if (!process.env[variable]) throw new Error(`Missing ${variable} in .env`);
});

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildIntegrations
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User,
    Partials.GuildMember,
    Partials.Reaction
  ]
});

// Google Sheets setup
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/drive.readonly'
];

const rawBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64;
let serviceAccount;

try {
  const decoded = Buffer.from(rawBase64, 'base64').toString('utf-8');
  serviceAccount = JSON.parse(decoded);
  console.log("✅ Successfully parsed service account JSON");
} catch (err) {
  console.error("❌ Failed to decode GOOGLE_SERVICE_ACCOUNT_BASE64:", err.message);
  process.exit(1);
}

// MongoDB setup
const mongoClient = new MongoClient(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  retryWrites: true,
  retryReads: true
});

// Add a new MongoClient for the main website DB (for employee management)
const mainMongoUri = process.env.MONGO_URI_MAIN;
let mainMongoClient;
if (mainMongoUri) {
  mainMongoClient = new MongoClient(mainMongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    retryWrites: true,
    retryReads: true
  });
}

mongoClient.on('error', (err) => {
  console.error('MongoDB Error:', err);
});

let db, formChannelsCollection, lastRowsCollection;
let formChannels = new Map();
let permissionsCollection;
let ticketSettingsCollection;
let activeTicketsCollection;
let interactionState = {};

const OWNER_ID = '1057573344855207966';

function clearUserState(userId) {
  if (interactionState[userId]?.timeout) {
    clearTimeout(interactionState[userId].timeout);
  }
  delete interactionState[userId];
}

// Initialize database 
async function initializeDatabase() {
  try {
    await mongoClient.connect();
    db = mongoClient.db('prs-helper');
      formChannelsCollection = db.collection('form_channels');
    lastRowsCollection = db.collection('last_rows');
    permissionsCollection = db.collection('permissions');
    ticketSettingsCollection = db.collection('ticket_settings');
    activeTicketsCollection = db.collection('active_tickets');

    const docs = await formChannelsCollection.find().toArray();
    formChannels = new Map();
    
    docs.forEach(doc => {
      if (!doc.spreadsheet_id || !doc.guild_id) {
        console.warn('Skipping invalid entry:', doc);
        return;
      }
      formChannels.set(`${doc.guild_id}:${doc.spreadsheet_id}`, {
        channelId: doc.channel_id,
        sheet_name: doc.sheet_name,
        guild_id: doc.guild_id,
        spreadsheet_id: doc.spreadsheet_id
      });
    });
    
    console.log(`✅ Initialized ${formChannels.size} valid form mappings`);
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// function to check permissions
async function hasPermission(userId, guildId, permission) {
  // Check if user has the specific permission
  const permissionDoc = await permissionsCollection.findOne({
    user_id: userId,
    guild_id: guildId,
    permission: permission
  });
  
  return !!permissionDoc;
}

// Google auth
async function getAuthClient() {
  try {
    const auth = new google.auth.JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key.replace(/\\n/g, '\n'),
      scopes: SCOPES
    });
    await auth.authorize();
    return auth;
  } catch (error) {
    console.error('❌ Google auth failed:', error);
    throw error;
  }
}

// Fetch responses with rate limiting
async function fetchResponses(spreadsheetId, sheetName) {
  await limiter.removeTokens(1);
  try {
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const [headerResponse, dataResponse] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId, range: `'${sheetName}'!1:1` }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: `'${sheetName}'!A2:Z` })
    ]);

    return {
      headers: headerResponse.data.values?.[0] || [],
      values: dataResponse.data.values || []
    };
  } catch (error) {
    console.error(`❌ Failed to fetch ${sheetName}:`, error.message);
    return null;
  }
}

// Process spreadsheet with retries - UPDATED
async function processSpreadsheet(spreadsheetId, channelId, guildId, retries = 3) {
  if (!spreadsheetId) throw new Error('Missing spreadsheetId');
  if (!guildId) throw new Error('Missing guildId');

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const auth = await getAuthClient();
      const sheets = google.sheets({ version: 'v4', auth });
      const metadata = await sheets.spreadsheets.get({ spreadsheetId });
      const sheetNames = metadata.data.sheets.map(sheet => sheet.properties.title);

      for (const sheetName of sheetNames) {
        const response = await fetchResponses(spreadsheetId, sheetName);
        if (!response?.values) continue;

        const lastRowDoc = await lastRowsCollection.findOne({ 
          spreadsheet_id: spreadsheetId,
          sheet_name: sheetName,
          guild_id: guildId
        });
        const lastProcessedRow = lastRowDoc?.last_row || 0;

        if (response.values.length > lastProcessedRow) {
          const newResponses = response.values.slice(lastProcessedRow);
          await sendResponses(channelId, response.headers, newResponses, sheetName);
          
          await lastRowsCollection.updateOne(
            { 
              spreadsheet_id: spreadsheetId,
              sheet_name: sheetName,
              guild_id: guildId
            },
            { $set: { last_row: response.values.length } },
            { upsert: true }
          );
          console.log(`✅ Processed ${newResponses.length} new responses from ${sheetName}`);
        }
      }
      return;
    } catch (error) {
      console.error(`Attempt ${attempt} failed for ${spreadsheetId}:`, error.message);
      if (attempt === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Send responses to Discord
async function sendResponses(channelId, headers, responses, sheetName) {
  const channel = client.channels.cache.get(channelId);
  if (!channel) {
    console.error(`❌ Channel ${channelId} not found`);
    return;
  }

  for (const response of responses) {
    try {
      const embed = new EmbedBuilder()
        .setTitle(`📝 New Response (${sheetName})`)
        .setColor(0x00FF00);

      response.forEach((value, index) => {
        const question = headers[index] || `Question ${index + 1}`;
        embed.addFields({
          name: question,
          value: value?.toString().substring(0, 1000) || 'No response',
          inline: false
        });
      });

      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('❌ Failed to send response:', error);
    }
  }
}

// Poll all sheets in parallel - UPDATED
async function pollSheets() {
  // 1. Connection check
  if (!mongoClient.topology?.isConnected()) {
    console.log('⚠️ MongoDB disconnected, reconnecting...');
    try {
      await initializeDatabase();
    } catch (error) {
      console.error('❌ Failed to reconnect to MongoDB:', error);
      return;
    }
  }

  console.log('🔍 Polling sheets...');
  
  // 2. Convert formChannels to array FIRST
  const entriesArray = Array.from(formChannels.entries());
  console.log('Debug - formChannels entries:', entriesArray);

  if (entriesArray.length === 0) {
    console.log('ℹ️ No spreadsheets being tracked');
    return;
  }

  // 3. Create array of promises FIRST
  const pollingPromises = entriesArray.map(
    ([key, config]) => {
      return (async () => {
        try {
          if (!config.spreadsheet_id) {
            console.error('Invalid config for key', key, 'Full config:', config);
            throw new Error(`Missing spreadsheet_id in config`);
          }
          await processSpreadsheet(config.spreadsheet_id, config.channelId, config.guild_id);
        } catch (error) {
          console.error(`❌ Failed polling in guild ${config.guild_id}:`, error.message);
          // Auto-clean invalid entries
          formChannels.delete(key);
          await formChannelsCollection.deleteOne({
            guild_id: config.guild_id,
            spreadsheet_id: config.spreadsheet_id
          });
        }
      })();
    }
  );

  // 4. Then pass to Promise.allSettled
  await Promise.allSettled(pollingPromises);
  console.log('✅ Polling cycle completed');
}

// Discord bot setup
client.once('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  console.log('Intents:', client.options.intents);
  
  try {
    await initializeDatabase();
    console.log('✅ Database collections initialized:');
    console.log('- formChannelsCollection');
    console.log('- lastRowsCollection');
    console.log('- permissionsCollection');
    console.log('- ticketSettingsCollection');
    console.log('- activeTicketsCollection');
    
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
      await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
      console.log('✅ Slash commands registered');
    } catch (error) {
      console.error('❌ Failed to register commands:', error);
    }
    
    setInterval(pollSheets, 900000);
    console.log('✅ Bot operational');
  } catch (error) {
    console.error('❌ Startup error:', error);
  }
});

// Slash command handlers
client.on('interactionCreate', async interaction => {
  if (!interaction || !interaction.guild?.id) {
    console.error('Invalid interaction received');
    return;
  }

  // Handle copy receipt button interaction
  if (interaction.isButton() && interaction.customId.startsWith('copy_receipt_')) {
    try {
      // Get the receipt text from the embed
      const embed = interaction.message.embeds[0];
      if (!embed || !embed.description) {
        console.error('Receipt embed not found');
        await interaction.reply({
          content: '❌ Failed to copy receipt: Receipt not found',
          ephemeral: true
        });
        return;
      }

      // Reply with the receipt text
      await interaction.reply({
        content: `Here's your receipt:\n\${embed.description}\`,
        ephemeral: true
      });

      // Update the button to show it was copied
      const newRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(interaction.customId)
            .setLabel('📋 Copied')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );

      await interaction.message.edit({
        embeds: interaction.message.embeds,
        components: [newRow]
      });

      return;
    } catch (error) {
      console.error('Error handling copy receipt button:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ Failed to copy receipt. Please try again.',
          ephemeral: true
        });
      }
      return;
    }
  }
  try {
    switch (interaction.commandName) {
      case 'addform':
      case 'removeform': {
        // Permission check for all form-related commands
        if (!await hasPermission(interaction.user.id, interaction.guild.id, 'manage_forms')) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setDescription('❌ You need "manage_forms" permission to use this command')
                .setColor(0xFF0000)
            ],
            ephemeral: true
          });
        }

        // Now handle each specific command
        if (interaction.commandName === 'addform') {
          await handleAddForm(interaction);
          break;
        }
        if (interaction.commandName === 'removeform') {
          const spreadsheetName = interaction.options.getString('sheetname');
          // Only look for forms in current server
          const entry = [...formChannels.entries()].find(
            ([_, config]) => config.sheet_name === spreadsheetName && 
            config.guild_id === interaction.guild.id
          );
          if (entry) {
            formChannels.delete(entry[0]);
            await formChannelsCollection.deleteOne({ 
              spreadsheet_id: entry[1].spreadsheet_id,
              guild_id: interaction.guild.id
            });
            await interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setDescription(`✅ Stopped tracking ${spreadsheetName}`)
                  .setColor(0x00FF00)
              ]
            });
          } else {
            await interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setDescription('❌ Spreadsheet not being tracked in this server')
                  .setColor(0xFF0000)
              ]
            });
          }
          break;
        }
        break;
      }
      case 'listforms': {
        // Only show forms from current server
        const list = Array.from(formChannels)
          .filter(([_, config]) => config.guild_id === interaction.guild.id)
          .map(([_, { channelId, sheet_name }]) => 
            `- ${sheet_name} → <#${channelId}>`
          )
          .join('\n') || 'No tracked forms in this server';
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('📋 Tracked Forms')
              .setDescription(list)
              .setColor(0x00FF00)
          ],
          ephemeral: true
        });
        break;
      }
      case 'ping': {
        const latency = Date.now() - interaction.createdTimestamp;
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setDescription(`🏓 Pong! Latency: ${latency}ms`)
              .setColor(0x00FF00)
          ]
        });
        break;
      }      case 'say': {
        // Only allow users with MANAGE_MESSAGES permission to use this command
        if (!interaction.member.permissions.has('ManageMessages')) {
          return interaction.reply({ 
            content: '❌ You need Manage Messages permission to use this command.',
            ephemeral: true 
          });
        }
        
        const channel = interaction.options.getChannel('channel');
        const text = interaction.options.getString('text');
        
        try {
          await channel.send(text);
          await interaction.reply({ 
            content: `✅ Message sent to <#${channel.id}>`,
            ephemeral: true 
          });
        } catch (err) {
          console.error('Error sending message:', err);
          await interaction.reply({ 
            content: '❌ Failed to send message. Make sure I have permission to send messages in that channel.',
            ephemeral: true 
          });
        }
        break;
      }
      
      case 'cats': {
        try {
          const response = await fetch('https://api.thecatapi.com/v1/images/search');
          const [data] = await response.json();
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle('🐱 Random Cat')
                .setImage(data.url)
                .setColor(0x00FF00)
                .setFooter({ text: 'Powered by TheCatAPI' })
            ]
          });
        } catch (error) {
          console.error('Cat API error:', error);
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setDescription('❌ Failed to fetch cat image')
                .setColor(0xFF0000)
            ],
            ephemeral: true
          });
        }
        break;
      }
      case 'booking': {
        try {
          const buyerName = interaction.options.getString('buyer_name');
          const mobile = interaction.options.getString('mobile');
          const model = interaction.options.getString('model');
          const license = interaction.options.getString('license');
          const total = interaction.options.getNumber('total');
          const bookingAmount = interaction.options.getNumber('booking_amount');
          // Calculate due amount
          const amountDue = total - bookingAmount;
          // Calculate validity date (today + 6 days = 7 days total)
          const validityDate = new Date();
          validityDate.setDate(validityDate.getDate() + 6);
          const formattedDate = validityDate.toLocaleDateString('en-US', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
          const receiptText = `Buyer Name: ${buyerName}\nBuyer Mobile Number: ${mobile}\nModel: ${model}\nLicense Plate: ${license}\nTotal to Pay: $${total}\n\nBooking Amount: $${bookingAmount}\nAmount Due: $${amountDue}\nValidity 1 Week Till ${formattedDate}`;
          const receiptEmbed = new EmbedBuilder()
            .setTitle('🚗 Car Booking Receipt')
            .setDescription(receiptText)
            .setColor(0x00FF00)
            .setTimestamp();
          const row = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`copy_receipt_${Date.now()}`)
                .setLabel('📋 Copy Receipt')
                .setStyle(ButtonStyle.Primary)
            );
          // Send to the specified channel
          const bookingChannel = await client.channels.fetch('1354337998451507220');
          if (bookingChannel) {
            await bookingChannel.send({ embeds: [receiptEmbed], components: [row] });
          }
          // Send confirmation to the user
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setDescription('✅ Booking receipt has been posted in <#1354337998451507220>')
                .setColor(0x00FF00)
            ],
            ephemeral: true
          });
        } catch (error) {
          console.error('Booking error:', error);
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setDescription('❌ Failed to create booking receipt')
                .setColor(0xFF0000)
            ],
            ephemeral: true
          });
        }
        break;
      }
      case 'sell': {
        try {
          const buyerName = interaction.options.getString('buyer_name');
          const buyerCid = interaction.options.getString('buyer_cid');
          const buyerNumber = interaction.options.getString('buyer_number');
          const model = interaction.options.getString('model');
          const license = interaction.options.getString('license');
          const price = interaction.options.getNumber('price');
          const discount = interaction.options.getNumber('discount');
          // Calculate final price after discount
          const finalPrice = price - (price * (discount / 100));
          const receiptText = `Buyer Name - ${buyerName}
Buyer CID - ${buyerCid}
Buyer Number - ${buyerNumber}

Vehicle Model - ${model}
License Plate - ${license}

Price - $${price}
Discount - ${discount}%
Total to Pay - $${finalPrice}`;
          const receiptEmbed = new EmbedBuilder()
            .setTitle('🚗 Vehicle Purchase Receipt')
            .setDescription(receiptText)
            .setColor(0x00FF00)
            .setTimestamp();
          const row = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`copy_receipt_${Date.now()}`)
                .setLabel('📋 Copy Receipt')
                .setStyle(ButtonStyle.Primary)
            );
          // Send to the specified channel
          const sellChannel = await client.channels.fetch('1354337998451507220');
          if (sellChannel) {
            await sellChannel.send({ embeds: [receiptEmbed], components: [row] });
          }
          // Send confirmation to the user
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setDescription('✅ Vehicle purchase receipt has been posted in <#1354337998451507220>')
                .setColor(0x00FF00)
            ],
            ephemeral: true
          });
        } catch (error) {
          console.error('Sell error:', error);
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setDescription('❌ Failed to create vehicle purchase receipt')
                .setColor(0xFF0000)
            ],
            ephemeral: true
          });
        }
        break;
      }
      case 'newsell': {
        try {
          const type = interaction.options.getString('type');
          const name = interaction.options.getString('name');
          const contact = interaction.options.getString('contact');
          const cid = interaction.options.getString('cid');
          const dmail = interaction.options.getString('dmail');
          const vehicle = interaction.options.getString('vehicle');
          const license = interaction.options.getString('license');
          const amount = interaction.options.getNumber('amount');
          const transferredTo = interaction.options.getString('transferred_to');
          const today = new Date();
          const formattedDate = today.toLocaleDateString('en-US', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });

          let receiptText = '';
          let title = '';
          if (type === 'intake') {
            title = 'RECEIPT – VEHICLE ON CONSIGNMENT (CATALOG LISTING)';
            receiptText = `Name: ${name}\nContact Number: ${contact}\nCID: ${cid}\nD-Mail: ${dmail}\n\nVehicle Name: ${vehicle}\nLicense Plate: ${license}\n\nExpected Amount: $${amount}\nTransferred To: ${transferredTo}\nDate: ${formattedDate}`;
          } else {
            title = 'RECEIPT – VEHICLE PURCHASED BY COMPANY';
            receiptText = `Name: ${name}\nContact Number: ${contact}\nCID: ${cid}\nD-Mail: ${dmail}\nVehicle Name: ${vehicle}\nLicense Plate: ${license}\n\nAmount Paid: $${amount}\nTransferred To: ${transferredTo}\nDate: ${formattedDate}`;
          }

          const receiptEmbed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(receiptText)
            .setColor(0x00FF00)
            .setTimestamp();
          const row = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`copy_receipt_${Date.now()}`)
                .setLabel('📋 Copy Receipt')
                .setStyle(ButtonStyle.Primary)
            );
          // Send to the specified channel (same as booking/sell)
          const channel = await client.channels.fetch('1354337998451507220');
          if (channel) {
            await channel.send({ embeds: [receiptEmbed], components: [row] });
          }
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setDescription('✅ Receipt has been posted in <#1354337998451507220>')
                .setColor(0x00FF00)
            ],
            ephemeral: true
          });
        } catch (error) {
          console.error('Newsell error:', error);
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setDescription('❌ Failed to create receipt')
                .setColor(0xFF0000)
            ],
            ephemeral: true
          });
        }
        break;
      }
      case 'dm': {
        // Permission check - must come FIRST
        if (!await hasPermission(interaction.user.id, interaction.guild.id, 'send_dms')) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setDescription('❌ You need "send_dms" permission to use this command')
                .setColor(0xFF0000)
            ],
            ephemeral: true
          });
        }
        // Original DM command handling
        const user = interaction.options.getUser('user');
        const text = interaction.options.getString('text');
        try {
          await user.send({
            embeds: [
              new EmbedBuilder()
                .setTitle(`📨 From ${interaction.user.tag}`)
                .setDescription(text)
                .setColor(0x00FF00)
            ]
          });
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setDescription(`✅ DM sent to ${user.tag}`)
                .setColor(0x00FF00)
            ],
            ephemeral: true
          });
        } catch (error) {
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                  .setDescription(`❌ Failed to DM ${user.tag} (they may have DMs disabled)`)
                  .setColor(0xFF0000)
            ],
            ephemeral: true
          });
        }
        break;
      }
      case 'checkupdates': {
        try {
          // Acknowledge the interaction immediately since polling might take time
          await interaction.deferReply({ ephemeral: true });
          // Run the polling function
          await pollSheets();
          // Get all forms in the current guild
          const guildForms = Array.from(formChannels.values())
            .filter(config => config.guild_id === interaction.guild.id);
          if (guildForms.length === 0) {
            await interaction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setDescription('ℹ️ No forms are being tracked in this server')
                  .setColor(0xFFFF00)
              ]
            });
            return;
          }
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setDescription('✅ Successfully checked for updates on all tracked forms')
                .setColor(0x00FF00)
                .addFields(
                  guildForms.map(form => ({
                    name: form.sheet_name,
                    value: `Posting to: <#${form.channelId}>`,
                    inline: true
                  }))
                )
            ]
          });
        } catch (error) {
          console.error('Checkupdates error:', error);
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setDescription('❌ Failed to check for updates')
                .setColor(0xFF0000)
            ]
          });
        }
        break;
      }
      case 'giveperms': {
        const userToPermit = interaction.options.getUser('user');
        const permissionToGrant = interaction.options.getString('permission');
        await permissionsCollection.updateOne(
          {
            user_id: userToPermit.id,
            guild_id: interaction.guild.id,
            permission: permissionToGrant
          },
          { $set: { 
            user_id: userToPermit.id,
            guild_id: interaction.guild.id,
            permission: permissionToGrant,
            granted_by: interaction.user.id,
            granted_at: new Date()
          }},
          { upsert: true }
        );
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setDescription(`✅ Granted ${permissionToGrant} permission to ${userToPermit.tag}`)
              .setColor(0x00FF00)
          ],
          ephemeral: true
        });
        break;
      }
      case 'revokeperms': {
        const userToRevoke = interaction.options.getUser('user');
        const permissionToRevoke = interaction.options.getString('permission');
        const result = await permissionsCollection.deleteOne({
          user_id: userToRevoke.id,
          guild_id: interaction.guild.id,
          permission: permissionToRevoke
        });
        if (result.deletedCount > 0) {
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setDescription(`✅ Revoked ${permissionToRevoke} permission from ${userToRevoke.tag}`)
                .setColor(0x00FF00)
            ],
            ephemeral: true
          });
        } else {
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setDescription(`ℹ️ ${userToRevoke.tag} didn't have ${permissionToRevoke} permission`)
                .setColor(0xFFFF00)
            ],
            ephemeral: true
          });
        }
        break;
      }
      case 'checkperms': {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const userPermissions = await permissionsCollection.find({
          user_id: targetUser.id,
          guild_id: interaction.guild.id
        }).toArray();
        const permissionList = userPermissions.length > 0 
           ? userPermissions.map(p => `• ${p.permission}`).join('\n')
           : 'No special permissions';
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`🔐 Permissions for ${targetUser.tag}`)
              .setDescription(permissionList)
              .setColor(0x00FFFF)
              .setFooter({ text: 'Administrators have all permissions by default' })
          ],
          ephemeral: true
        });
        break;
      }
      case 'setticketcategory': {
        // Check for administrator permissions
        if (!interaction.member.permissions.has('Administrator')) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setDescription('❌ You need Administrator permission to use this command')
                .setColor(0xFF0000)
            ],
            ephemeral: true
          });
        }
        const categoryId = interaction.options.getString('category');
        await ticketSettingsCollection.updateOne(
          { guild_id: interaction.guild.id },
          { $set: { ticket_category: categoryId } },
          { upsert: true }
        );
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('🎟️ Ticket System')
              .setDescription('Ticket category has been set!')
              .addFields({ name: 'Category', value: `<#${categoryId}>` })
              .setColor(0x00FF00)
          ],
          ephemeral: true
        });
        break;
      }
      case 'closeticket': {
        try {
          // Check for staff role or administrator permission
          if (!interaction.member.permissions.has('Administrator') && !interaction.member.permissions.has('ManageChannels')) {
            return interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setDescription('❌ You need staff permissions to close tickets')
                  .setColor(0xFF0000)
              ],
              ephemeral: true
            });
          }
          if (!interaction.channel.name.startsWith('ticket-')) {
            return interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setDescription('❌ This is not a ticket channel')
                  .setColor(0xFF0000)
              ],
              ephemeral: true
            });
          }
          const ticketData = await activeTicketsCollection.findOne({ 
            channel_id: interaction.channel.id,
            status: 'open'
          });
          if (!ticketData) {
            return interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setDescription('❌ Could not find ticket data')
                  .setColor(0xFF0000)
              ],
              ephemeral: true
            });
          }
          // Acknowledge the interaction first
          await interaction.deferReply();
          // Update ticket status first
          await activeTicketsCollection.updateOne(
            { channel_id: interaction.channel.id },
            { $set: { status: 'closed' } }
          );
          // Notify user
          const user = await client.users.fetch(ticketData.user_id);
          await user.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('🎟️ Ticket Closed')
                .setDescription('Your ticket has been closed by staff.')
                .setColor(0xFFA500)
                .setTimestamp()
            ]
          }).catch(() => console.log('Could not DM user about ticket closure'));
          // Edit the initial reply
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setDescription('✅ Ticket closed - Channel will be deleted in 5 seconds')
                .setColor(0x00FF00)
            ]
          });
          // Delete channel after 5 seconds
          setTimeout(() => interaction.channel.delete().catch(console.error), 5000);
        } catch (error) {
          console.error('Error closing ticket:', error);
          const errorMessage = {
            embeds: [
              new EmbedBuilder()
                .setDescription('❌ Failed to close ticket')
                .setColor(0xFF0000)
            ],
            ephemeral: true
          };
          if (interaction.deferred) {
            await interaction.editReply(errorMessage);
          } else {
            await interaction.reply(errorMessage);
          }
        }
        break;
      }
      case 'deleteticket': {
        // Check for staff role or administrator permission
        if (!interaction.member.permissions.has('Administrator') && !interaction.member.permissions.has('ManageChannels')) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setDescription('❌ You need staff permissions to delete tickets')
                .setColor(0xFF0000)
            ],
            ephemeral: true
          });
        }
        if (!interaction.channel.name.startsWith('ticket-')) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setDescription('❌ This is not a ticket channel')
                .setColor(0xFF0000)
            ],
            ephemeral: true
          });
        }
        const ticketToDelete = await activeTicketsCollection.findOne({
          channel_id: interaction.channel.id
        });
        if (!ticketToDelete) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setDescription('❌ Could not find ticket data')
                .setColor(0xFF0000)
            ],
            ephemeral: true
          });
        }
        try {
          // Notify user before deleting
          const user = await client.users.fetch(ticketToDelete.user_id);
          await user.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('🎟️ Ticket Deleted')
                .setDescription('Your ticket has been deleted by staff.')
                .setColor(0xFF0000)
                .setTimestamp()
            ]
          }).catch(() => console.log('Could not DM user about ticket deletion'));
          // Delete from database
          await activeTicketsCollection.deleteOne({
            channel_id: interaction.channel.id
          });
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setDescription('✅ Ticket deleted')
                .setColor(0x00FF00)
            ]
          });
          // Delete the channel after a short delay
          setTimeout(() => interaction.channel.delete(), 2000);
        } catch (error) {
          console.error('Error deleting ticket:', error);
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setDescription('❌ Failed to delete ticket')
                .setColor(0xFF0000)
            ],
            ephemeral: true
          });
        }
        break;
      }
      case 'maintenancelb': {
        await handleMaintenanceLB(interaction);
        break;
      }
      case 'forcemaintenanceoff': {
        await handleForceMaintenanceOff(interaction);
        break;
      }
      case 'help': {
        const helpEmbed = new EmbedBuilder()
          .setTitle('🤖 PRS Helper Bot Commands')
          .setColor(0x00BFFF)
          .setDescription('Here are all available commands and their usage:')
          .addFields(
            { name: '/addform', value: 'Start tracking a Google Form', inline: false },
            { name: '/removeform [sheetname]', value: 'Stop tracking a Google Form', inline: false },
            { name: '/listforms', value: 'List all tracked forms', inline: false },
            { name: '/ping', value: 'Check bot latency and API status', inline: false },
            { name: '/dm [user] [text]', value: 'Send a DM through the bot (requires permission)', inline: false },
            { name: '/cats', value: 'Shows random cat pictures', inline: false },
            { name: '/checkupdates', value: 'Manually check for any unsent form responses', inline: false },
            { name: '/giveperms [user] [permission]', value: 'Grant permissions to a user (admin only)', inline: false },
            { name: '/revokeperms [user] [permission]', value: 'Revoke permissions from a user (admin only)', inline: false },
            { name: "/checkperms [user]", value: "Check a user's permissions", inline: false },
            { name: '/maintenancelb [time]', value: 'Put the site in maintenance mode for a specified duration', inline: false },
            { name: '/forcemaintenanceoff', value: 'Force turn off maintenance mode', inline: false },
            { name: '/booking [buyer_name] [mobile] [model] [license] [total] [booking_amount]', value: 'Create a car booking receipt', inline: false },
            { name: '/sell [buyer_name] [buyer_cid] [buyer_number] [model] [license] [price] [discount]', value: 'Create a vehicle purchase receipt', inline: false },
            { name: '/newsell [type] [name] [contact] [cid] [dmail] [vehicle] [license] [amount] [transferred_to]', value: 'Create a vehicle intake or acquisition receipt', inline: false },
            { name: '/help', value: 'Show this help message', inline: false }
          )
          .setFooter({ text: 'For detailed usage, use /help or contact an admin.' });
        await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
        break;
      }
      case 'add_employee': {
        // Only allow OWNER_ID or users with manage_employees permission
        const hasManagePerms = interaction.user.id === OWNER_ID || await hasPermission(interaction.user.id, interaction.guildId, 'manage_employees');
        if (!hasManagePerms) {
          await interaction.reply({
            content: '❌ You are not authorized to use this command.',
            ephemeral: true
          });
          break;
        }
        const employeeCode = interaction.options.getString('employee_code');
        const name = interaction.options.getString('name');
        const user = interaction.options.getUser('user');
        const role = interaction.options.getString('role');
        const allowedRoles = [
          'Affiliated Agent',
          'Apprentice Salesman',
          'Sales Executive',
          'Senior Sales Executive',
          'Sales Manager',
          'General Manager',
          'Boss'
        ];
        if (!employeeCode || !name || !user || !role) {
          await interaction.reply({
            content: '❌ Missing required fields.',
            ephemeral: true
          });
          break;
        }
        if (!allowedRoles.includes(role)) {
          await interaction.reply({
            content: `❌ Invalid role. Allowed roles: ${allowedRoles.join(', ')}`,
            ephemeral: true
          });
          break;
        }
        if (!mainMongoClient) {
          await interaction.reply({
            content: '❌ Main MongoDB connection not configured. Please set MONGO_URI_MAIN.',
            ephemeral: true
          });
          break;
        }
        try {
          // Connect if not already connected
          if (!mainMongoClient.topology || !mainMongoClient.topology.isConnected()) {
            await mainMongoClient.connect();
          }
          // Use the website's MongoDB database (not prs-helper)
          const websiteDb = mainMongoClient.db('test'); // Change to your website DB name if different
          const usersCollection = websiteDb.collection('users');
          // Upsert user by employeeCode
          const updateResult = await usersCollection.updateOne(
            { employeeCode },
            {
              $set: {
                employeeCode,
                name,
                discordId: user.id,
                discordUsername: user.tag,
                isApproved: true,
                approvalStatus: 'approved',
                role
              }
            },
            { upsert: true }
          );
          await interaction.reply({
            content: `✅ Employee ${name} (${employeeCode}) linked to Discord user ${user.tag} with role ${role}.`,
            ephemeral: true
          });
        } catch (err) {
          console.error('Error adding employee:', err);
          await interaction.reply({
            content: '❌ Failed to add employee. Please try again.',
            ephemeral: true
          });
        }
        break;
      }
      case 'remove_employee': {
        // Only allow OWNER_ID or users with manage_employees permission
        const hasManagePerms = interaction.user.id === OWNER_ID || await hasPermission(interaction.user.id, interaction.guildId, 'manage_employees');
        if (!hasManagePerms) {
          await interaction.reply({
            content: '❌ You are not authorized to use this command.',
            ephemeral: true
          });
          break;
        }
        const discordId = interaction.options.getString('discord_id');
        if (!discordId) {
          await interaction.reply({
            content: '❌ Missing Discord User ID.',
            ephemeral: true
          });
          break;
        }
        if (!mainMongoClient) {
          await interaction.reply({
            content: '❌ Main MongoDB connection not configured. Please set MONGO_URI_MAIN.',
            ephemeral: true
          });
          break;
        }
        try {
          if (!mainMongoClient.topology || !mainMongoClient.topology.isConnected()) {
            await mainMongoClient.connect();
          }
          const websiteDb = mainMongoClient.db('test');
          const usersCollection = websiteDb.collection('users');
          const result = await usersCollection.deleteOne({ discordId });
          if (result.deletedCount > 0) {
            await interaction.reply({
              content: `✅ Employee with Discord ID ${discordId} removed.`,
              ephemeral: true
            });
          } else {
            await interaction.reply({
              content: `❌ No employee found with Discord ID ${discordId}.`,
              ephemeral: true
            });
          }
        } catch (err) {
          console.error('Error removing employee:', err);
          await interaction.reply({
            content: '❌ Failed to remove employee. Please try again.',
            ephemeral: true
          });
        }
        break;
      }
      case 'set_employee_role': {
        // Only allow OWNER_ID or users with high-level roles
        const allowedRoleChangers = ['Boss', 'General Manager', 'Sales Manager'];
        let userRole = null;
        if (mainMongoClient) {
          if (!mainMongoClient.topology || !mainMongoClient.topology.isConnected()) {
            await mainMongoClient.connect();
          }
          const websiteDb = mainMongoClient.db('test');
          const usersCollection = websiteDb.collection('users');
          const invoker = await usersCollection.findOne({ discordId: interaction.user.id });
          userRole = invoker?.role;
        }
        const isAllowed = interaction.user.id === OWNER_ID || allowedRoleChangers.includes(userRole);
        if (!isAllowed) {
          await interaction.reply({
            content: '❌ You are not authorized to use this command.',
            ephemeral: true
          });
          break;
        }
        const employeeCode = interaction.options.getString('employee_code');
        const newRole = interaction.options.getString('role');
        const allowedRoles = [
          'Affiliated Agent',
          'Apprentice Salesman',
          'Sales Executive',
          'Senior Sales Executive',
          'Sales Manager',
          'General Manager',
          'Boss'
        ];
        if (!employeeCode || !newRole) {
          await interaction.reply({
            content: '❌ Missing required fields.',
            ephemeral: true
          });
          break;
        }
        if (!allowedRoles.includes(newRole)) {
          await interaction.reply({
            content: `❌ Invalid role. Allowed roles: ${allowedRoles.join(', ')}`,
            ephemeral: true
          });
          break;
        }
        if (!mainMongoClient) {
          await interaction.reply({
            content: '❌ Main MongoDB connection not configured. Please set MONGO_URI_MAIN.',
            ephemeral: true
          });
          break;
        }
        try {
          if (!mainMongoClient.topology || !mainMongoClient.topology.isConnected()) {
            await mainMongoClient.connect();
          }
          const websiteDb = mainMongoClient.db('test');
          const usersCollection = websiteDb.collection('users');
          const updateResult = await usersCollection.updateOne(
            { employeeCode },
            { $set: { role: newRole } }
          );
          if (updateResult.matchedCount === 0) {
            await interaction.reply({
              content: `❌ No employee found with code ${employeeCode}.`,
              ephemeral: true
            });
          } else {
            await interaction.reply({
              content: `✅ Role for employee ${employeeCode} updated to ${newRole}.`,
              ephemeral: true
            });
          }
        } catch (err) {
          console.error('Error updating employee role:', err);
          await interaction.reply({
            content: '❌ Failed to update employee role. Please try again.',
            ephemeral: true
          });
        }
        break;
      }
      default: {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setDescription('❌ Unknown command')
              .setColor(0xFF0000)
          ],
          ephemeral: true
        });
      }
    }
  } catch (error) {
    console.error('❌ Interaction error:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setDescription('⚠️ An error occurred')
            .setColor(0xFF0000)
        ],
        ephemeral: true
      });
    }
  }
});

// Form setup flow
async function handleAddForm(interaction) {
  try {
    clearUserState(interaction.user.id);

    const auth = await getAuthClient();
    const drive = google.drive({ version: 'v3', auth });
    
    const { data } = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet'",
      fields: 'files(id, name)',
    });

    interactionState[interaction.user.id] = {
      step: 'selectSpreadsheet',
      spreadsheets: data.files,
      timeout: setTimeout(() => {
        clearUserState(interaction.user.id);
        interaction.followUp({
          embeds: [
            new EmbedBuilder()
              .setDescription('⌛ Timed out! Use `/addform` again to restart')
              .setColor(0xFFA500)
          ],
          ephemeral: true
        });
      }, 15000) // 15-second timeout
    };

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('📂 Available Spreadsheets')
          .setDescription(data.files.map(f => `- ${f.name}`).join('\n'))
          .setFooter({ text: '⏳ Reply with the exact name within 15 seconds' })
          .setColor(0x00FF00)
      ],
      ephemeral: true
    });
  } catch (error) {
    console.error('❌ Addform error:', error);
    clearUserState(interaction.user.id);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setDescription('⚠️ Failed to fetch spreadsheets')
          .setColor(0xFF0000)
      ]
    });
  }
}

// Message handling for DMs and form setup
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // Handle DMs to the bot
  if (message.channel.type === ChannelType.DM) {
    try {
      // Get the channel to forward messages to
      const forwardChannel = await client.channels.fetch('1377139820383699046');
      if (!forwardChannel) {
        console.error('❌ Forward channel not found');
        return;
      }      // Create embed with user info and message
      const forwardEmbed = new EmbedBuilder()
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL({ dynamic: true })
        })
        .setColor(0x00BFFF)
        .setTimestamp();

      // Handle message content - could be a link or text
      if (message.content) {
        // Check if the message is a URL
        const urlPattern = /https?:\/\/[^\s]+/;
        if (urlPattern.test(message.content)) {
          // If it's a URL that ends with an image/gif extension
          if (/\.(gif|jpe?g|png|webp)$/i.test(message.content)) {
            forwardEmbed.setImage(message.content);
          } else {
            forwardEmbed.setDescription(message.content);
          }
        } else {
          forwardEmbed.setDescription(message.content);
        }
      }

      // Add attachment if any
      if (message.attachments.size > 0) {
        const attachment = message.attachments.first();
        if (!forwardEmbed.data.image) { // Only set image if we haven't already set one from the URL
          forwardEmbed.setImage(attachment.url);
        } else {
          forwardEmbed.addFields({ name: 'Attachment', value: attachment.url });
        }
      }

      // Send to forward channel
      await forwardChannel.send({ embeds: [forwardEmbed] });
      
      // React to the DM to show it was forwarded
      await message.react('✅');
    } catch (error) {
      console.error('Error forwarding DM:', error);
      await message.react('❌');
    }
    return;
  }

  const userId = message.author.id;
  const state = interactionState[userId];
  if (!state) return;

  try {
    // Clear the previous timeout
    clearTimeout(state.timeout);

    if (state.step === 'selectSpreadsheet') {
      const spreadsheet = state.spreadsheets.find(f => f.name === message.content.trim());
      if (!spreadsheet) {
        await message.reply('❌ Spreadsheet not found. Please reply with the exact name from the list.');
        // Reset timeout
        state.timeout = setTimeout(() => {
          clearUserState(userId);
        }, 15000);
        return;
      }
      // Save selected spreadsheet and ask for channel
      state.selectedSpreadsheet = spreadsheet;
      state.step = 'selectChannel';
      state.timeout = setTimeout(() => {
        clearUserState(userId);
        message.reply('⌛ Timed out! Use `/addform` again to restart.');
      }, 15000);
      await message.reply('✅ Spreadsheet selected! Now mention the channel (e.g. #channel) where responses should be posted.');
      return;
    }
    if (state.step === 'selectChannel') {
      const channelMention = message.mentions.channels.first();
      if (!channelMention) {
        await message.reply('❌ Please mention a valid channel (e.g. #channel).');
        // Reset timeout
        state.timeout = setTimeout(() => {
          clearUserState(userId);
        }, 15000);
        return;
      }
      // Save to DB and in-memory
      const spreadsheet = state.selectedSpreadsheet;
      const channelId = channelMention.id;
      const guildId = message.guild.id;
      const sheetName = spreadsheet.name;
      const spreadsheetId = spreadsheet.id;
      // Save to DB
      await formChannelsCollection.updateOne(
        { guild_id: guildId, spreadsheet_id: spreadsheetId },
        {
          $set: {
            guild_id: guildId,
            channel_id: channelId,
            sheet_name: sheetName,
            spreadsheet_id: spreadsheetId
          }
        },
        { upsert: true }
      );
      // Save to in-memory map
      formChannels.set(`${guildId}:${spreadsheetId}`, {
        channelId,
        sheet_name: sheetName,
        guild_id: guildId,
        spreadsheet_id: spreadsheetId
      });
      clearUserState(userId);
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ Form Tracking Added')
            .setDescription(`Now tracking **${sheetName}**. New responses will be posted in <#${channelId}>.`)
            .setColor(0x00FF00)
        ]
      });
      return;
    }
  } catch (error) {
    console.error('Error in messageCreate handler:', error);
    clearUserState(userId);
    await message.reply('❌ Something went wrong. Please try `/addform` again.');
  }
});

// Minimal Express server for Render.com port scan
const app = express();
const PORT = process.env.PORT || 8081;

// Basic health check endpoint
app.get('/', (req, res) => {
  res.send({
    status: 'ok',
    message: 'PRS Helper Bot is running.'
  });
});

// OTP sending endpoint for backend integration
app.use(express.json());
app.post('/send-otp', async (req, res) => {
  const { discordId, otp } = req.body;
  if (!discordId || !otp) {
    return res.status(400).json({ message: 'discordId and otp are required' });
  }
  try {
    const user = await client.users.fetch(discordId);
    if (!user) {
      return res.status(404).json({ message: 'Discord user not found' });
    }
    // Send OTP as an embed
    const otpEmbed = new EmbedBuilder()
      .setTitle('Your PRS Login OTP')
      .setDescription(`> **${otp}**\n\nThis OTP is valid for 5 minutes.\nDo not share this code with anyone.`)
      .setColor(0x00FF00)
      .setTimestamp();
    await user.send({ embeds: [otpEmbed] });
    res.json({ message: 'OTP sent via Discord DM' });
  } catch (err) {
    console.error('Failed to send OTP DM:', err);
    res.status(500).json({ message: 'Failed to send OTP DM', error: err.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  console.log(serviceAccount.client_email);
  res.status(500).send('Internal Server Error');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// Ensure the bot logs in
client.login(process.env.DISCORD_TOKEN);
console.log('Logging in Discord bot...');
