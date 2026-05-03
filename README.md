# Proxy Replicate · ITAMEC

Pequeno proxy Node.js que recebe requisições do site da rampa niveladora,
adiciona a chave do Replicate (que fica em variável de ambiente, segura)
e encaminha para `api.replicate.com`.

## Por que precisa de proxy?

A API do Replicate **bloqueia chamadas diretas do browser** (CORS).
Além disso, expor sua chave no front-end seria um problema de segurança.
Este proxy resolve as duas coisas.

## Deploy no Coolify (passo a passo)

### 1. Suba os arquivos para um repositório Git

Faça um repositório (GitHub, Gitea, GitLab) com estes 4 arquivos:
- `server.js`
- `package.json`
- `Dockerfile`
- `docker-compose.yml`

### 2. Crie a aplicação no Coolify

1. No painel do Coolify, clique **+ New Resource → Application**
2. Escolha **Public Repository** ou **Private Repository (Git)**
3. Cole a URL do seu repositório
4. Build Pack: **Dockerfile** (Coolify detecta automaticamente)
5. Port: **3000**

### 3. Configure as variáveis de ambiente

No painel do Coolify, aba **Environment Variables**, adicione:

| Nome | Valor | Observação |
|------|-------|-----------|
| `REPLICATE_API_TOKEN` | `r8_xxx...` | Sua chave do Replicate |
| `ALLOWED_ORIGINS` | `https://rampa.itamec.com.br` | Domínio do site (separar com vírgula se múltiplos) |
| `PORT` | `3000` | (opcional, padrão 3000) |

### 4. Configure o domínio

Na aba **Domains** do Coolify, adicione um subdomínio:
- Exemplo: `proxy-rampa.seudominio.com.br`
- Ative HTTPS (Coolify gera Let's Encrypt automaticamente)

### 5. Deploy

Clique em **Deploy**. Em ~1 minuto deve estar no ar.

### 6. Teste

```bash
curl https://proxy-rampa.seudominio.com.br/health
# deve responder: {"status":"ok","uptime":...}
```

## Endpoints

### `POST /api/generate`

Cria uma nova prediction no Replicate.

**Body:**
```json
{
  "prompt": "industrial loading ramp...",
  "aspect_ratio": "16:9",
  "output_quality": 90
}
```

**Resposta:** objeto `prediction` do Replicate (com `id`, `status`, `output`).

### `GET /api/status/:id`

Consulta o status de uma prediction.

### `GET /health`

Health check usado pelo Coolify.

## Segurança

- ✅ Chave nunca exposta no browser
- ✅ Rate limit de 30 req/min por IP
- ✅ Validação de prompt (5-2000 chars)
- ✅ CORS configurável por origem
- ✅ HTTPS via Coolify

## Custo

- **Coolify:** zero (você já paga o VPS)
- **Replicate:** ~$0.003/imagem com Flux Schnell
- **Tempo de geração:** 2-4 segundos por imagem

## Modelos suportados

Por padrão usa `black-forest-labs/flux-schnell` (rápido e barato).
Para usar outro modelo, passe `model` no body:

```json
{
  "prompt": "...",
  "model": "black-forest-labs/flux-dev"
}
```

Outros bons modelos:
- `black-forest-labs/flux-dev` — qualidade superior, mais caro (~$0.025/img)
- `black-forest-labs/flux-1.1-pro` — top tier (~$0.04/img)
- `stability-ai/stable-diffusion-3.5-large` — alternativa
