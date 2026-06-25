// ════════════════════════════════════════════════════
//  HepatitCheck Backend — server.js
//  Node.js + Express + Anthropic Claude API
// ════════════════════════════════════════════════════

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const Anthropic  = require('@anthropic-ai/sdk');

const app  = express();
const port = process.env.PORT || 3000;

// ── Anthropic client ──────────────────────────────
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ── CORS ──────────────────────────────────────────
// Faqat o'z saytingizdan kelgan so'rovlarni qabul qiladi
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // curl / Postman (origin yo'q) — development uchun
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
      return cb(null, true);
    }
    cb(new Error(`CORS: ${origin} ruxsatsiz`));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '10kb' }));

// ── Rate limiting ──────────────────────────────────
// Har bir IP dan 1 daqiqada max 20 ta so'rov
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Juda ko\'p so\'rov. Bir daqiqa kuting.' },
});
app.use('/api/', limiter);

// ── System promptlar ──────────────────────────────
const CHAT_SYSTEM = {
  uz: `Sen HepatitCheck — O'zbekiston uchun gepatit ma'lumot tizimining AI yordamchisisan.

VAZIFANG:
- Bemorlar va tibbiyot mutaxassislariga gepatit (A, B, C, D, E), jigar kasalliklari, laboratoriya tahlillari va davolash haqida aniq, ishonchli, tibbiy jihatdan to'g'ri ma'lumot berish.

QOIDALAR:
1. Faqat savol tili va yo'nalishiga mos tilda javob ber
2. Hech qachon aniq tibbiy tashxis qo'yma — faqat ma'lumot va yo'nalish ber
3. Har doim javob oxirida: "⚠️ Aniq tashxis uchun shifokorga murojaat qiling."
4. Javob hajmi: 3–5 qisqa paragraf yoki ro'yxat
5. Oddiy, tushunarli til ishlat — tibbiy atamalarni tushuntir
6. Markdown formatidan foydalanma — oddiy matn`,

  ru: `Ты AI-ассистент HepatitCheck — информационной системы по гепатиту для Узбекистана.

ТВОЯ ЗАДАЧА:
- Давать пациентам и медицинским специалистам точную, достоверную, медицински корректную информацию о гепатите (A, B, C, D, E), заболеваниях печени, лабораторных анализах и лечении.

ПРАВИЛА:
1. Отвечай на языке вопроса
2. Никогда не ставь конкретный медицинский диагноз — только информируй и направляй
3. В конце каждого ответа: "⚠️ Для точного диагноза обратитесь к врачу."
4. Объём ответа: 3–5 коротких абзацев или список
5. Используй понятный язык — объясняй медицинские термины
6. Не используй Markdown — только обычный текст`,

  en: `You are the HepatitCheck AI assistant — a hepatitis information system for Uzbekistan.

YOUR TASK:
- Provide patients and medical professionals with accurate, reliable, medically correct information about hepatitis (A, B, C, D, E), liver diseases, lab tests, and treatment.

RULES:
1. Answer in the language of the question
2. Never make a specific medical diagnosis — only inform and guide
3. Always end with: "⚠️ For an accurate diagnosis, please consult a doctor."
4. Answer length: 3–5 short paragraphs or a list
5. Use plain language — explain medical terms
6. Do not use Markdown — plain text only`,
};

const LAB_SYSTEM = `Sen tibbiy laboratoriya tahlillarini izohlash bo'yicha ixtisoslashgan AI yordamchisisan.
Faqat gepatit va jigar kasalliklari bilan bog'liq tahlil natijalarini tahlil qilasan.

QOIDALAR:
1. Berilgan laboratoriya qiymatlarini mezon ko'rsatkichlar bilan solishtir
2. Har bir ko'rsatkich uchun: normal/yuqori/past ekanligini aniqla
3. Kompleks baholash qil — qaysi gepatit turi yoki jigar holati bilan mos kelishi mumkin
4. Shifokorga murojaat qilish zarurligini aniqla
5. Oddiy matn ishlat — Markdown yo'q
6. Javob oxirida: "⚠️ Bu AI tahlili — shifokor tashxisini almashtirmaydi."
7. O'zbek tilida javob ber (agar so'rov boshqa tilda bo'lsa — o'sha tilda)`;

// ════════════════════════════════════════════════════
//  ENDPOINTLAR
// ════════════════════════════════════════════════════

// ── Health check ──────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'HepatitCheck API',
    version: '1.0.0',
    endpoints: ['/api/chat', '/api/analyze', '/api/health'],
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── POST /api/chat ─────────────────────────────────
// Bemorlar bilan AI suhbat
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, lang = 'uz' } = req.body;

    // Validatsiya
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages maydoni talab qilinadi' });
    }
    if (messages.length > 20) {
      return res.status(400).json({ error: 'Suhbat juda uzun (max 20 xabar)' });
    }

    // Faqat ruxsat etilgan maydonlarni qabul qilish
    const safeMessages = messages
      .filter(m => m.role && m.content && typeof m.content === 'string')
      .map(m => ({
        role:    m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content).slice(0, 2000), // max 2000 belgi
      }));

    const systemPrompt = CHAT_SYSTEM[lang] || CHAT_SYSTEM.uz;

    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      system:     systemPrompt,
      messages:   safeMessages,
    });

    res.json({ content: response.content });

  } catch (err) {
    console.error('[/api/chat]', err.message);
    res.status(500).json({ error: 'AI xizmati vaqtincha ishlamayapti. Qayta urinib ko\'ring.' });
  }
});

// ── POST /api/analyze ──────────────────────────────
// Laboratoriya natijalarini AI tahlil qilishi
app.post('/api/analyze', async (req, res) => {
  try {
    const { labs, lang = 'uz' } = req.body;

    if (!labs || typeof labs !== 'object') {
      return res.status(400).json({ error: 'labs maydoni talab qilinadi' });
    }

    // Tahlil natijalarini matn ko'rinishiga o'tkazish
    const labText = Object.entries(labs)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    if (!labText) {
      return res.status(400).json({ error: 'Hech bo\'lmaganda bitta tahlil natijasi kiriting' });
    }

    const prompt = `Quyidagi laboratoriya tahlil natijalarini baholang va gepatit yoki jigar kasalligi nuqtai nazaridan izohlang:\n\n${labText}\n\nTil: ${lang}`;

    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1200,
      system:     LAB_SYSTEM,
      messages:   [{ role: 'user', content: prompt }],
    });

    res.json({ content: response.content });

  } catch (err) {
    console.error('[/api/analyze]', err.message);
    res.status(500).json({ error: 'Tahlil xizmati vaqtincha ishlamayapti.' });
  }
});

// ── 404 ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint topilmadi' });
});

// ── Global error handler ──────────────────────────
app.use((err, req, res, _next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: 'Server xatosi' });
});

// ── Start ─────────────────────────────────────────
app.listen(port, () => {
  console.log(`\n✅ HepatitCheck API ishga tushdi`);
  console.log(`   Port     : ${port}`);
  console.log(`   Origins  : ${ALLOWED_ORIGINS.join(', ') || 'barchasi (dev rejim)'}`);
  console.log(`   Model    : claude-sonnet-4-6\n`);
});
