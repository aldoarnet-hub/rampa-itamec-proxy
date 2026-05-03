/**
 * Proxy Replicate · ITAMEC
 *
 * Recebe requisições do browser, adiciona a chave da API
 * (que fica em variável de ambiente), encaminha para Replicate
 * e retorna o resultado.
 *
 * Endpoints:
 *   POST /api/generate      — cria uma prediction
 *   GET  /api/status/:id    — consulta status de uma prediction
 *   GET  /health            — health check (Coolify usa)
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());

if (!REPLICATE_TOKEN) {
  console.error('❌ REPLICATE_API_TOKEN não configurado.');
  console.error('   Configure como variável de ambiente no Coolify.');
  process.exit(1);
}

// CORS - liberado para domínios permitidos
app.use(cors({
  origin: ALLOWED_ORIGINS.includes('*') ? true : ALLOWED_ORIGINS,
  methods: ['GET', 'POST', 'OPTIONS'],
}));

app.use(express.json({ limit: '1mb' }));

// Rate limit simples (em memória — suficiente pra uso interno)
const rateLimitMap = new Map();
function rateLimit(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minuto
  const maxRequests = 30;     // 30 req/min por IP

  const log = rateLimitMap.get(ip) || [];
  const recent = log.filter(t => now - t < windowMs);

  if (recent.length >= maxRequests) {
    return res.status(429).json({ error: 'Rate limit excedido. Espere 1 minuto.' });
  }

  recent.push(now);
  rateLimitMap.set(ip, recent);
  next();
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Servir página estática (caso queira hospedar o site no mesmo container)
app.use(express.static('public'));

// === GERAR IMAGEM ===
app.post('/api/generate', rateLimit, async (req, res) => {
  try {
    const { prompt, model, aspect_ratio, output_quality, num_inference_steps } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.length < 5) {
      return res.status(400).json({ error: 'Prompt inválido ou muito curto' });
    }
    if (prompt.length > 2000) {
      return res.status(400).json({ error: 'Prompt muito longo (máx 2000 chars)' });
    }

    const targetModel = model || 'black-forest-labs/flux-schnell';
    const url = `https://api.replicate.com/v1/models/${targetModel}/predictions`;

    const replicateResp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_TOKEN}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=10',
      },
      body: JSON.stringify({
        input: {
          prompt,
          aspect_ratio: aspect_ratio || '16:9',
          output_format: 'jpg',
          output_quality: output_quality || 90,
          num_outputs: 1,
          num_inference_steps: num_inference_steps || 4,
        },
      }),
    });

    if (!replicateResp.ok) {
      const errText = await replicateResp.text();
      console.error('Replicate erro:', replicateResp.status, errText);
      return res.status(replicateResp.status).json({
        error: `Replicate retornou ${replicateResp.status}`,
        details: errText.substring(0, 500),
      });
    }

    const data = await replicateResp.json();
    res.json(data);
  } catch (e) {
    console.error('Erro interno:', e);
    res.status(500).json({ error: 'Erro interno', details: e.message });
  }
});

// === CONSULTAR STATUS ===
app.get('/api/status/:id', rateLimit, async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[a-z0-9]+$/i.test(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const url = `https://api.replicate.com/v1/predictions/${id}`;
    const r = await fetch(url, {
      headers: { 'Authorization': `Bearer ${REPLICATE_TOKEN}` },
    });

    if (!r.ok) {
      return res.status(r.status).json({ error: `Replicate ${r.status}` });
    }
    const data = await r.json();
    res.json(data);
  } catch (e) {
    console.error('Status erro:', e);
    res.status(500).json({ error: 'Erro interno', details: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`✓ Proxy Replicate rodando na porta ${PORT}`);
  console.log(`  Origens permitidas: ${ALLOWED_ORIGINS.join(', ')}`);
});
