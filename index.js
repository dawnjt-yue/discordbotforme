require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// 配置
const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const ZHIPU_MODEL = 'glm-4.5-air';

// 人设配置 - 月姬角色
const personas = {
  // 爱尔奎特 - 月姬中的真祖公主
  arcueid: {
    name: "爱尔奎特·布伦史塔德",
    personality: "高傲优雅，内心善良。性格奔放而豁达、纯洁而无邪、任性又孩子气、天真而烂漫。",
    expertise: ["吸血鬼知识", "月姬世界", '型月世界', 'Fate世界', 'FGO', "神秘学", "哲学思考"],
    style: "优雅高贵，偶尔会表现出天真可爱的一面，说话方式独特，带有古典气息",
    greeting: "吾乃真祖公主，爱尔奎特·布伦史塔德。有何贵干？",
    examples: [
      "吾乃真祖，永生的存在...",
      "虽然看起来年轻，但实际上已经活了很久了。",
      "吾并不喜欢吸人血，只是偶尔需要而已。"
    ]
  },
  
  // 猫姬 - 爱尔奎特的猫形态
  neko: {
    name: "猫姬",
    personality: "活泼可爱，好奇心强，有点小傲娇",
    expertise: ["猫的知识", "日常生活", "可爱话题", "玩耍"],
    style: "可爱活泼，经常用猫的口吻说话，喜欢用喵~结尾，偶尔会露出猫耳和猫尾",
    greeting: "喵~ 我是猫姬！有什么想问的吗？喵~",
    examples: [
      "喵~ 好有趣的事情呢！",
      "猫猫最喜欢晒太阳了~",
      "虽然我是猫，但也不是普通的家猫喵~"
    ]
  }
};

// 调用智谱GLM API
async function callZhipuGLM(messages, personaType = 'arcueid') {
  try {
    const systemPrompt = getSystemPrompt(personaType);
    
    const fullMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    const response = await axios.post(ZHIPU_API_URL, {
      model: ZHIPU_MODEL,
      messages: fullMessages,
      temperature: 0.7,
      max_tokens: 2000,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.ZHIPU_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('API调用错误:', error.response ? error.response.data : error.message);
    throw error;
  }
}

// 获取系统提示
function getSystemPrompt(personaType = 'arcueid') {
  const persona = personas[personaType];
  return `你是${persona.name}，性格${persona.personality}。
你的专长领域：${persona.expertise.join('、')}。
回答风格：${persona.style}。

常用问候语：${persona.greeting}
说话示例：${persona.examples.join('、')}

请根据用户的问题提供符合你性格的回答。如果使用${persona.name}形态，请在适当的时候表现出${persona.name}的特点。`;
}

// 分长消息
function splitMessage(text) {
  const chunks = [];
  const maxLength = 2000;
  
  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.slice(i, i + maxLength));
  }
  
  return chunks;
}

// 斜杠命令
const commands = [
  {
    name: 'phantasmoon',
    description: '与月姬角色对话',
    type: 1,
    options: [
      {
        name: 'question',
        description: '输入您的问题',
        type: 3,
        required: true
      },
      {
        name: 'character',
        description: '选择角色',
        type: 3,
        required: false,
        choices: [
          { name: '爱尔奎特', value: 'arcueid' },
          { name: '猫姬', value: 'neko' }
        ]
      }
    ]
  },
  {
    name: 'setcharacter',
    description: '设置默认角色',
    type: 1,
    options: [
      {
        name: 'character',
        description: '角色类型',
        type: 3,
        required: true,
        choices: [
          { name: '爱尔奎特', value: 'arcueid' },
          { name: '猫姬', value: 'neko' }
        ]
      }
    ]
  },
  {
    name: 'clearhistory',
    description: '清除对话历史',
    type: 1
  },
  {
    name: 'help',
    description: '获取帮助',
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

// Bot启动事件
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log('Bot is ready!');
  console.log('可用角色：爱尔奎特、猫姬');
});

// 对话历史存储
const conversationHistory = new Map();
const userCharacters = new Map();

// 消息事件处理
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  
  // 文本命令
  if (message.content.startsWith('!phantasmoon ')) {
    const [command, ...args] = message.content.slice(5).split(' ');
    
    if (command === 'setcharacter') {
      const characterType = args[0] || 'arcueid';
      if (personas[characterType]) {
        userCharacters.set(message.author.id, characterType);
        const character = personas[characterType];
        await message.reply(`✅ 已切换为${character.name}模式\n${character.greeting}`);
      } else {
        await message.reply('❌ 可选的角色：arcueid (爱尔奎特)、neko (猫姬)');
      }
    } else if (command === 'clearhistory') {
      conversationHistory.delete(message.author.id);
      await message.reply('🗑️ 对话历史已清除');
    }
  }
  
  // AI对话
  if (message.content.startsWith('!phantasmoon') || message.content.startsWith('!ai') || message.mentions.has(client.user)) {
    try {
      let userMessage = message.content.replace(/!phantasmoon\s*/, '').replace(/!ai\s*/, '').replace(/<@\d+>\s*/, '').trim();
      
      if (!userMessage) {
        message.reply('请输入您的问题！\n\n使用方法：`!glm 问题内容` 或 `@bot名称 问题内容`\n\n可用角色：爱尔奎特、猫姬');
        return;
      }

      const thinkingMessage = await message.channel.send('让我看看～', '这个应该这样！');

      // 获取用户角色
      const userCharacter = userCharacters.get(message.author.id) || 'arcueid';
      
      // 构建消息历史
      const messages = [];
      if (conversationHistory.has(message.author.id)) {
        const history = conversationHistory.get(message.author.id);
        messages.push(...history.slice(-10)); // 最近10轮
      }

      messages.push({ role: "user", content: userMessage });

      const aiResponse = await callZhipuGLM(messages, userCharacter);

      // 保存到历史
      conversationHistory.set(message.author.id, [
        ...messages,
        { role: "assistant", content: aiResponse }
      ].slice(-20)); // 保持最近20轮

      await thinkingMessage.delete();
      
      // 发送回复
      if (aiResponse.length > 2000) {
        const chunks = splitMessage(aiResponse);
        for (let i = 0; i < chunks.length; i++) {
          await message.reply(`🤖 ${chunks[i]}`);
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } else {
        await message.reply(`🤖 ${aiResponse}`);
      }

    } catch (error) {
      console.error('处理错误:', error);
      await message.reply('糟糕了喵，不小心冲出大气层了。唔，这就是真空状态吗？');
    }
  }
});

// 斜杠命令处理
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'phantasmoon') {
    const question = interaction.options.getString('question');
    const character = interaction.options.getString('character') || userCharacters.get(interaction.user.id) || 'arcueid';
    
    try {
      await interaction.deferReply({ ephemeral: false });
      
      const messages = [];
      if (conversationHistory.has(interaction.user.id)) {
        const history = conversationHistory.get(interaction.user.id);
        messages.push(...history.slice(-10));
      }

      messages.push({ role: "user", content: question });

      const aiResponse = await callZhipuGLM(messages, character);
      
      // 保存到历史
      conversationHistory.set(interaction.user.id, [
        ...messages,
        { role: "assistant", content: aiResponse }
      ].slice(-20));

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
      await interaction.followUp('❌ 处理请求时出现错误');
    }
  } else if (commandName === 'setcharacter') {
    const characterType = interaction.options.getString('character');
    userCharacters.set(interaction.user.id, characterType);
    const character = personas[characterType];
    await interaction.reply(`✅ 已切换为${character.name}模式\n${character.greeting}`);
  } else if (commandName === 'clearhistory') {
    conversationHistory.delete(interaction.user.id);
    await interaction.reply('🗑️ 对话历史已清除');
  } else if (commandName === 'help') {
    const helpEmbed = {
      color: 0x0099ff,
      title: '月姬助手使用帮助',
      description: '这是一个基于《月姬》角色的Discord AI助手',
      fields: [
        { 
          name: '可用角色', 
          value: '👑 **爱尔奎特·布伦史塔德** - 真祖公主，高傲优雅\n🐱 **猫姬** - 活泼可爱的猫形态', 
          inline: false 
        },
        { 
          name: '使用方法', 
          value: '1. 使用斜杠命令：`/phantasmoon 问题内容 [角色]`\n2. 使用文本命令：`!phantasmoon 问题内容`\n3. 设置默认角色：`/setcharacter 角色`\n4. 直接@机器人并输入问题', 
          inline: true 
        },
        { 
          name: '示例', 
          value: '`/phantasmoon 你好，介绍一下自己`\n`!phantasmoon 帮我写一首诗`\n`/setcharacter neko`', 
          inline: true 
        }
      ],
      footer: { text: 'Powered by 智谱GLM × 月姬' }
    };
    
    await interaction.reply({ embeds: [helpEmbed] });
  }
});

// 启动Bot
async function startBot() {
  await registerCommands();
  await client.login(process.env.DISCORD_BOT_TOKEN);
}

startBot().catch(console.error);
