// ════════════════════════════════════════════════════
// HepatitCheck Backend v3.0
// Production Ready
// Author: Akrom Komiljonov
// ════════════════════════════════════════════════════

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();

// ───────────────────────────────────────────────────
// Configuration
// ───────────────────────────────────────────────────

const PORT = Number(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const SUPPORTED_LANGUAGES = ['uz', 'ru', 'en'];

const REQUIRED_ENV_VARS = [
  'ANTHROPIC_API_KEY'
];

// ───────────────────────────────────────────────────
// Environment Validation
// ───────────────────────────────────────────────────

const missingEnvVars = REQUIRED_ENV_VARS.filter(
  key => !process.env[key]
);

if (missingEnvVars.length > 0) {
  console.error(
    `❌ Missing environment variables: ${missingEnvVars.join(', ')}`
  );
  process.exit(1);
}

// ───────────────────────────────────────────────────
// Anthropic Client
// ───────────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ───────────────────────────────────────────────────
// Security
// ───────────────────────────────────────────────────

app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// ───────────────────────────────────────────────────
// JSON Parser
// ───────────────────────────────────────────────────

app.use(
  express.json({
    limit: '20kb',
  })
);

// ───────────────────────────────────────────────────
// CORS Configuration
// ───────────────────────────────────────────────────

const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS || ''
)
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (
        ALLOWED_ORIGINS.length === 0 ||
        ALLOWED_ORIGINS.includes(origin)
      ) {
        return callback(null, true);
      }

      return callback(
        new Error(`Origin not allowed: ${origin}`)
      );
    },

    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: false,
  })
);

// ───────────────────────────────────────────────────
// Rate Limiter
// ───────────────────────────────────────────────────

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,

  max: NODE_ENV === 'production'
    ? 25
    : 100,

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    error:
      'Too many requests. Please wait a minute and try again.',
  },
});

app.use('/api', apiLimiter);

// ───────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────

function isValidLanguage(lang) {
  return SUPPORTED_LANGUAGES.includes(lang);
}

function sanitizeText(text, maxLength = 2000) {
  return String(text || '')
    .trim()
    .slice(0, maxLength);
}

function createErrorResponse(message) {
  return {
    success: false,
    error: message,
  };
}

function createSuccessResponse(data) {
  return {
    success: true,
    ...data,
  };
}
// ───────────────────────────────────────────────────
// AI Models
// ───────────────────────────────────────────────────

const AI_MODEL = 'claude-sonnet-4-20250514';

// ───────────────────────────────────────────────────
// System Prompts
// ───────────────────────────────────────────────────

const CHAT_SYSTEM = {
  uz: `
Sen HepatitCheck AI yordamchisisan.

Ixtisoslashuv:
- Gepatit A
- Gepatit B
- Gepatit C
- Gepatit D
- Gepatit E
- Jigar sirrozi
- Yog'li gepatoz
- Jigar fermentlari
- Virusli gepatit markerlari
- Jigar laborator diagnostikasi

Qoidalar:

1. Har doim foydalanuvchi tilida javob ber.
2. Tibbiy jihatdan aniq va ishonchli ma'lumot ber.
3. Hech qachon yakuniy tashxis qo'yma.
4. Faqat ehtimoliy tushuntirish ber.
5. Kerak bo'lsa laborator tekshiruvlarni tavsiya qil.
6. Kerak bo'lsa infeksionist yoki gepatologga murojaat qilishni tavsiya qil.
7. Murakkab atamalarni oddiy tushuntir.
8. Javobni tartibli yoz.
9. Markdown ishlatma.
10. Har doim javob oxirida yoz:

⚠️ Ushbu javob ma'lumot berish uchun mo'ljallangan. Aniq tashxis va davolash uchun shifokorga murojaat qiling.
`,

  ru: `
Ты HepatitCheck AI.

Специализация:

- Гепатит A
- Гепатит B
- Гепатит C
- Гепатит D
- Гепатит E
- Цирроз печени
- Жировая болезнь печени
- Печёночные ферменты
- Маркеры вирусных гепатитов
- Лабораторная диагностика заболеваний печени

Правила:

1. Отвечай на языке пользователя.
2. Давай точную медицинскую информацию.
3. Никогда не ставь окончательный диагноз.
4. Объясняй возможные причины.
5. При необходимости рекомендуй анализы.
6. При необходимости рекомендуй консультацию гепатолога или инфекциониста.
7. Используй понятный язык.
8. Ответ должен быть структурированным.
9. Не используй Markdown.
10. Всегда заканчивай ответ:

⚠️ Для точного диагноза и лечения обратитесь к врачу.
`,

  en: `
You are HepatitCheck AI.

Specialization:

- Hepatitis A
- Hepatitis B
- Hepatitis C
- Hepatitis D
- Hepatitis E
- Liver Cirrhosis
- Fatty Liver Disease
- Liver Enzymes
- Viral Hepatitis Markers
- Liver Laboratory Diagnostics

Rules:

1. Answer in the user's language.
2. Provide medically accurate information.
3. Never provide a definitive diagnosis.
4. Explain possible causes.
5. Recommend laboratory tests when appropriate.
6. Recommend consultation with a hepatologist when necessary.
7. Use clear language.
8. Keep responses structured.
9. Do not use Markdown.
10. Always end with:

⚠️ For an accurate diagnosis and treatment, consult a physician.
`
};

// ───────────────────────────────────────────────────
// Laboratory Analysis Prompt
// ───────────────────────────────────────────────────

const LAB_SYSTEM = `
You are an expert hepatology laboratory interpretation assistant.

Tasks:

1. Evaluate liver-related laboratory values.
2. Compare results with standard reference ranges.
3. Identify abnormal findings.
4. Explain clinical significance.
5. Discuss possible hepatitis-related implications.
6. Mention possible liver diseases when relevant.
7. Do NOT provide a final diagnosis.
8. Explain findings in simple language.
9. Be objective and evidence-based.

Important:

- ALT
- AST
- ALP
- GGT
- Bilirubin
- Albumin
- INR
- HBsAg
- Anti-HBs
- HBeAg
- Anti-HBe
- Anti-HBc
- HBV DNA
- Anti-HCV
- HCV RNA

must be interpreted correctly whenever present.

Always end with:

⚠️ This AI interpretation does not replace physician evaluation.
`;
// ───────────────────────────────────────────────────
// Health Routes
// ───────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json(
    createSuccessResponse({
      service: 'HepatitCheck API',
      version: '3.0.0',
      status: 'online',
      environment: NODE_ENV,
      timestamp: new Date().toISOString(),
    })
  );
});

app.get('/api/health', (req, res) => {
  res.json(
    createSuccessResponse({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    })
  );
});

// ───────────────────────────────────────────────────
// AI Chat Endpoint
// ───────────────────────────────────────────────────

app.post('/api/chat', async (req, res) => {
  try {
    const {
      messages,
      lang = 'uz',
    } = req.body;

    if (!isValidLanguage(lang)) {
      return res
        .status(400)
        .json(
          createErrorResponse(
            'Unsupported language'
          )
        );
    }

    if (
      !messages ||
      !Array.isArray(messages)
    ) {
      return res
        .status(400)
        .json(
          createErrorResponse(
            'Messages array required'
          )
        );
    }

    if (
      messages.length === 0 ||
      messages.length > 20
    ) {
      return res
        .status(400)
        .json(
          createErrorResponse(
            'Conversation length invalid'
          )
        );
    }

    const safeMessages = messages
      .filter(
        m =>
          m &&
          m.content &&
          typeof m.content === 'string'
      )
      .map(m => ({
        role:
          m.role === 'assistant'
            ? 'assistant'
            : 'user',

        content: sanitizeText(
          m.content,
          2000
        ),
      }));

    const response =
      await anthropic.messages.create({
        model: AI_MODEL,

        max_tokens: 1200,

        temperature: 0.3,

        system:
          CHAT_SYSTEM[lang],

        messages: safeMessages,
      });

    const answer =
      response.content?.[0]?.text ||
      'No response generated';

    return res.json(
      createSuccessResponse({
        content: answer,
      })
    );
  } catch (error) {
    console.error(
      '[CHAT ERROR]',
      error.message
    );

    return res
      .status(500)
      .json(
        createErrorResponse(
          'AI service temporarily unavailable'
        )
      );
  }
});

// ───────────────────────────────────────────────────
// Laboratory Analysis Endpoint
// ───────────────────────────────────────────────────

app.post(
  '/api/analyze',
  async (req, res) => {
    try {
      const {
        labs,
        lang = 'uz',
      } = req.body;

      if (!labs) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              'Laboratory values required'
            )
          );
      }

      const labText =
        Object.entries(labs)
          .filter(
            ([, value]) =>
              value !== undefined &&
              value !== null &&
              value !== ''
          )
          .map(
            ([key, value]) =>
              `${key}: ${value}`
          )
          .join('\n');

      if (!labText) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              'No laboratory values provided'
            )
          );
      }

      const prompt = `
Language: ${lang}

Interpret these liver and hepatitis laboratory results:

${labText}

Provide:
1. Abnormal findings
2. Clinical meaning
3. Hepatitis relevance
4. Recommended next steps
`;

      const response =
        await anthropic.messages.create({
          model: AI_MODEL,

          max_tokens: 1500,

          temperature: 0.2,

          system: LAB_SYSTEM,

          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

      const result =
        response.content?.[0]?.text ||
        'Analysis unavailable';

      return res.json(
        createSuccessResponse({
          content: result,
        })
      );
    } catch (error) {
      console.error(
        '[LAB ERROR]',
        error.message
      );

      return res
        .status(500)
        .json(
          createErrorResponse(
            'Laboratory analysis unavailable'
          )
        );
    }
  }
);

// ───────────────────────────────────────────────────
// 404 Handler
// ───────────────────────────────────────────────────

app.use((req, res) => {
  return res.status(404).json(
    createErrorResponse(
      'Endpoint not found'
    )
  );
});

// ───────────────────────────────────────────────────
// Global Error Handler
// ───────────────────────────────────────────────────

app.use(
  (
    err,
    req,
    res,
    next
  ) => {
    console.error(
      '[GLOBAL ERROR]',
      err
    );

    return res.status(500).json(
      createErrorResponse(
        'Internal server error'
      )
    );
  }
);

// ───────────────────────────────────────────────────
// Start Server
// ───────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('');
  console.log(
    '════════════════════════════════════'
  );
  console.log(
    '🚀 HepatitCheck API Started'
  );
  console.log(
    '════════════════════════════════════'
  );
  console.log(
    `Environment : ${NODE_ENV}`
  );
  console.log(
    `Port        : ${PORT}`
  );
  console.log(
    `Languages   : ${SUPPORTED_LANGUAGES.join(', ')}`
  );
  console.log(
    `Origins     : ${
      ALLOWED_ORIGINS.join(', ') ||
      'All'
    }`
  );
  console.log(
    `Started At  : ${new Date().toISOString()}`
  );
  console.log(
    '════════════════════════════════════'
  );
  console.log('');
});
