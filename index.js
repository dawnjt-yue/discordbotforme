require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');

// 创建Discord客户端
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// 智谱GLM API配置
const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const ZHIPU_MODEL = 'glm-4.5-air';

// Bot启动事件
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log('Bot is ready!');
  console.log(`正在使用模型: ${ZHIPU_MODEL}`);
});

// 调用智谱GLM API
async function callZhipuGLM(messages) {
  try {
    const response = await axios.post(ZHIPU_API_URL, {
      model: ZHIPU_MODEL,
      messages: messages,
      temperature: 0.7,
      max_tokens: 2000,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.ZHIPU_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('智谱GLM API调用错误:', error.response ? error.response.data : error.message);
    throw error;
  }
}

// 消息事件处理
client.on('messageCreate', async message => {
  // 忽略机器人消息
  if (message.author.bot) return;
  
  // 检查是否提到bot或特定前缀
  if (message.content.startsWith('!glm') || message.content.startsWith('!ai') || message.mentions.has(client.user)) {
    try {
      // 提取用户问题
      let userMessage = message.content.replace(/!glm\s*/, '').replace(/!ai\s*/, '').replace(/<@\d+>\s*/, '').trim();
      
      if (!userMessage) {
        message.reply('请输入您的问题！\n\n使用方法：\n`!glm 你好` 或 `@bot名称 你好`');
        return;
      }

      // 发送"思考中"消息
      const thinkingMessage = await message.channel.send('🤔 正在思考中...');

      // 构建消息历史（保持上下文）
      const messages = [
        {
          role: "system",
          content: "你是一个智谱GLM驱动的AI助手，请用中文回答问题，回答要友好、准确、有帮助。"
        },
        {
          role: "user", 
          content: userMessage
        }
      ];

      // 调用智谱GLM API
      const aiResponse = await callZhipuGLM(messages);

      // 删除"思考中"消息并发送AI回复
      await thinkingMessage.delete();
      
      // 如果回复太长，进行分段处理
      if (aiResponse.length > 2000) {
        const chunks = splitMessage(aiResponse);
        for (let i = 0; i < chunks.length; i++) {
          await message.reply(`🤖 ${chunks[i]}`);
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 间隔1秒
          }
        }
      } else {
        await message.reply(`🤖 ${aiResponse}`);
      }

    } catch (error) {
      console.error('处理错误:', error);
      await message.reply('抱歉，处理您的请求时出现了错误。请检查API配置或稍后再试。');
    }
  }
});

// 分长消息
function splitMessage(text) {
  const chunks = [];
  const maxLength = 2000;
  
  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.slice(i, i + maxLength));
  }
  
  return chunks;
}

// 添加斜杠命令支持
const { REST, Routes } = require('discord.js');

const commands = [
  {
    name: 'glm',
    description: '与智谱GLM助手对话',
    type: 1,
    options: [
      {
        name: 'question',
        description: '输入您的问题',
        type: 3,
        required: true
      }
    ]
  },
  {
    name: 'help',
    description: '获取使用帮助',
    type: 1
  }
];

// 注册斜杠命令
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
  
  try {
    console.log('开始注册斜杠命令...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('斜杠命令注册成功');
  } catch (error) {
    console.error('命令注册失败:', error);
  }
}

// 斜杠命令处理
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'glm') {
    const question = interaction.options.getString('question');
    
    try {
      await interaction.deferReply({ ephemeral: false });
      
      const messages = [
        {
          role: "system",
          content: "你是一个智谱GLM驱动的AI助手，请用中文回答问题，回答要友好、准确、有帮助。"
        },
        {
          role: "user",
          content: question
        }
      ];

      const aiResponse = await callZhipuGLM(messages);

      if (aiResponse.length > 2000) {
        const chunks = splitMessage(aiResponse);
        for (let i = 0; i < chunks.length; i++) {
          await interaction.followUp(`🤖 ${chunks[i]}`);
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } else {
        await interaction.followUp(`🤖 ${aiResponse}`);
      }

    } catch (error) {
      console.error('斜杠命令处理错误:', error);
      await interaction.followUp('抱歉，处理您的请求时出现了错误。请稍后再试。');
    }
  } else if (commandName === 'help') {
    const helpEmbed = {
      color: 0x0099ff,
      title: '智谱GLM助手使用帮助',
      description: '这是一个基于智谱GLM的Discord AI助手',
      fields: [
        {
          name: '使用方法',
          value: '1. 使用斜杠命令：`/glm 问题内容`\n2. 使用文本命令：`!glm 问题内容`\n3. 直接@机器人并输入问题'
        },
        {
          name: '示例',
          value: '`/glm 请介绍一下人工智能`\n`!glm 帮我写一首诗`'
        },
        {
          name: '注意事项',
          value: '• 请确保问题内容文明友善\n• 避免输入敏感信息\n• 长回复会自动分段显示'
        }
      ],
      footer: {
        text: 'Powered by 智谱GLM'
      }
    };
    
    await interaction.reply({ embeds: [helpEmbed] });
  }
});

// 启动Bot
async function startBot() {
  // 注册命令
  await registerCommands();
  
  // 登录Discord
  await client.login(process.env.DISCORD_BOT_TOKEN);
}

startBot().catch(console.error);