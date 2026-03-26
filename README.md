# Rana — AI Agent SaaS Platform

> Autonomous AI agents that handle customer conversations across WhatsApp, Instagram, web chat, and email — built for MENA businesses.

![Node](https://img.shields.io/badge/Node.js-22-green) ![Next.js](https://img.shields.io/badge/Next.js-16-black) ![Prisma](https://img.shields.io/badge/Prisma-7-blue) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue) ![Ollama](https://img.shields.io/badge/AI-Ollama-orange)

---

## ✨ Features

### Multi-Channel Inbox
- **WhatsApp** — Baileys-based real-time messaging with QR pairing, voice note transcription, media support
- **Instagram** — DM handling via Meta Graph API (webhook route exists, needs credentials)
- **Web Chat** — embeddable widget snippet for any website
- **Email** — inbound/outbound via React Email + Resend

### AI Agents (Ollama-powered)
| Agent | Role |
|-------|------|
| **RouterAgent** | Classifies intent → routes to the right agent |
| **LeadQualificationAgent** | Scores leads, extracts info, qualifies interest |
| **SupportAgent** | FAQ, policy questions, troubleshooting |
| **BookingAgent** | Calendar booking (Cal.com API, template exists) |
| **FollowUpAgent** | Auto follow-up for stale conversations |

### Dashboard
- Real-time conversation monitoring
- Lead pipeline with stage tracking (NEW → CONTACTED → QUALIFIED → PROPOSAL → NEGOTIATION → WON/LOST)
- Analytics: KPIs, message trends, channel performance, lead funnel
- Agent persona editor with Arabic + dialect support (Khaliji, Iraqi, Shami, Egyptian, etc.)

### Human Escalation
- Automatic detection of frustration / explicit requests / knowledge gaps
- Severity levels (HIGH/MEDIUM) → marks conversation as ESCALATED
- Zero JSON leaking to customers — natural Arabic responses only

---

## 🚀 Quick Start

### Prerequisites
- Node.js 22+
- PostgreSQL (local or Neon cloud)
- Ollama running (`ollama serve`) with a model pulled (e.g. `ollama pull qwen3.5:2b`)

### 1. Clone & Install

```bash
git clone https://github.com/xxmanalexx/saas.git
cd saas
npm install --legacy-peer-deps
```

### 2. Set up environment

```bash
cp .env.example .env
# Fill in the required values (see Environment Variables below)
```

### 3. Configure database

**Option A — Local PostgreSQL with Prisma Dev (fastest local setup)**

```bash
# Start a local Postgres instance (creates 'app-local' database automatically)
npx prisma dev --name app-local --detach

# Set in .env:
# DATABASE_URL="postgresql://postgres:password@localhost:5432/app-local"
# DIRECT_URL="postgresql://postgres:password@localhost:5432/app-local"

# Push schema to database
npx prisma db push

# Generate Prisma client
npx prisma generate
```

**Option B — Neon PostgreSQL (cloud, production)**

```bash
# Create a project at neon.tech and copy the full connection string
# Set in .env:
# DATABASE_URL="postgresql://user:pass@ep-xxx.eu-west-2.aws.neon.tech/neondb?sslmode=require"
# DIRECT_URL="postgresql://user:pass@ep-xxx.eu-west-2.aws.neon.tech/neondb?sslmode=require"

npx prisma migrate dev --name init
npx prisma generate
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — OAuth login → dashboard.

---

## 🔧 Troubleshooting

### `MissingSecret` / Auth errors on first load

**Cause:** `NEXTAUTH_SECRET` is missing from `.env`.

**Fix:** Add it to `.env`:
```env
NEXTAUTH_SECRET="any-random-string-here-min-32-chars"
```
Restart `npm run dev`. In development, the app falls back to a temporary secret if this is missing — production requires it.

---

### `session.user.id is undefined` / dashboard pages crash

**Cause:** `auth.ts` callback isn't correctly mapping the user `id` into the session.

**Fix:** Make sure `session.user.id` is being set in the JWT callback and session callback. Check `auth.ts`:
```ts
callbacks: {
  session({ session, user }) {
    if (session.user) session.user.id = user.id;
    return session;
  },
  jwt({ token, user }) {
    if (user) token.id = user.id;
    return token;
  },
},
```
If pages still crash on first load after login, hard-refresh (`Ctrl+Shift+R`) — this is a session hydration timing issue, not a code bug.

---

### `prisma generate` fails with "Cannot find module"

**Cause:** Prisma 7 generates the client to `src/generated/prisma/` instead of `node_modules/@prisma/client`. Imports pointing to `@prisma/client` for types are broken.

**Fix:** The project uses a path alias — all type imports should use:
```ts
import type { Workspace, Integration } from "@/generated/prisma";
```
NOT from `@prisma/client`. If you added a new model, re-run `npx prisma generate` first, then import from `@/generated/prisma`.

---

### Database connection errors (`Connection refused` / `ECONNREFUSED`)

**For local Prisma Dev:**
```bash
# Check if Prisma Dev is running
npx prisma dev ls

# Stop and restart
npx prisma dev stop app-local
npx prisma dev --name app-local --detach
```

**For Neon:**
- Verify `DATABASE_URL` and `DIRECT_URL` in `.env` are both set and correct
- Make sure `?sslmode=require` is present
- Check the Neon dashboard — the branch may be suspended due to inactivity

---

### `prisma db push` or `prisma migrate` fails

**Cause:** `DIRECT_URL` is not set or doesn't match `DATABASE_URL`.

**Fix:** `prisma.config.ts` uses `DIRECT_URL` for CLI operations. Both must be set:
```env
DATABASE_URL="postgresql://..."   # app runtime
DIRECT_URL="postgresql://..."      # Prisma CLI (migrate, db push)
```
If they differ (e.g. `DATABASE_URL` uses a pooler but `DIRECT_URL` uses a direct connection), make sure both are valid connection strings.

---

### `404` on dashboard API routes after deploy

**Cause:** NextAuth session not resolving — API routes return `401`.

**Fix:** Ensure `NEXTAUTH_URL` matches your deployment URL exactly (including protocol). For production, it must be `https://your-domain.com`, not `http://localhost:3000`.

---

### WhatsApp QR code doesn't scan / session won't pair

- Delete `whatsapp-session.json` and re-scan the QR code
- Make sure you're scanning with the same phone number that received the QR link
- WhatsApp Web sessions expire — repeat the pairing process if disconnected

---

### Build succeeds but dashboard is blank or styles are broken

```bash
rm -rf .next
npm run build
npm run dev
```

---

## ⚙️ Environment Variables

```env
# ── Database (required) ─────────────────────────────────────────────────────
DATABASE_URL=""      # App runtime connection
DIRECT_URL=""        # Prisma CLI connection (migrate, db push)

# ── Auth (required in production) ─────────────────────────────────────────
NEXTAUTH_SECRET=""   # min 32 chars — generate: openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"

# GitHub OAuth App: github.com/settings/developers
# Callback URL: http://localhost:3000/api/auth/callback/github
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""

# ── Ollama AI ──────────────────────────────────────────────────────────────
OLLAMA_BASE_URL="http://localhost:11434"
AI_MODEL="qwen3.5:2b"   # any Ollama model (qwen, llama3.2, mistral, etc.)

# ── WhatsApp (Baileys — local pairing) ───────────────────────────────────
WHATSAPP_SESSION_FILE="./whatsapp-session.json"

# ── Stripe ──────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=""
STRIPE_PUBLISHABLE_KEY=""
STRIPE_WEBHOOK_SECRET=""
STRIPE_STARTER_PRICE_ID=""
STRIPE_GROWTH_PRICE_ID=""
STRIPE_ENTERPRISE_PRICE_ID=""

# ── Email (Resend) ─────────────────────────────────────────────────────────
RESEND_API_KEY=""
```

---

## 🗂️ Project Structure

```
saas/
├── src/
│   ├── generated/prisma/     # Prisma 7 generated client (do not edit)
│   └── lib/prisma.ts        # Prisma client singleton
├── app/
│   ├── (dashboard)/          # Protected dashboard routes
│   │   └── dashboard/
│   │       ├── page.tsx     # Overview + stats
│   │       ├── conversations/  # Live conversation monitoring
│   │       ├── leads/       # Lead pipeline
│   │       ├── analytics/  # Business analytics
│   │       ├── settings/   # Workspace config, Ollama, persona
│   │       └── integrations/  # Channel connections
│   └── api/
│       ├── auth/            # NextAuth v5
│       ├── webhooks/
│       │   ├── whatsapp/    # WhatsApp Baileys webhook
│       │   ├── webchat/     # Web chat webhook
│       │   └── stripe/      # Billing events
│       ├── conversations/   # CRUD + clear history
│       ├── leads/           # Lead management
│       ├── settings/        # Workspace + Ollama config
│       ├── personas/        # Agent persona management
│       ├── analytics/       # Dashboard data
│       ├── chat/completions/   # Chat API endpoint
│       └── cron/follow-up/  # Follow-up job trigger
├── agents/
│   ├── RouterAgent.ts       # Intent classification
│   ├── LeadQualificationAgent.ts  # Lead scoring
│   ├── SupportAgent.ts      # FAQ + support
│   ├── BookingAgent.ts      # Calendar booking
│   └── FollowUpAgent.ts     # Auto follow-up
├── lib/
│   ├── conversationEngine.ts  # Central routing + agent orchestration
│   ├── ai.ts                 # Ollama streaming client
│   ├── db.ts                 # Backward-compat DB export (→ src/lib/prisma)
│   ├── whatsappBaileys.ts    # Baileys WhatsApp client
│   ├── whisperTranscriber.ts # Voice note → text
│   └── ollamaConfig.ts       # Workspace Ollama config (cached)
├── prisma/
│   ├── schema.prisma         # PostgreSQL schema (single provider)
│   └── migrations/           # Migration history (PostgreSQL only)
└── channels/
    └── webchat.ts            # Web chat channel adapter
```

---

## 🧠 AI Architecture

### Persona System
Every workspace has a configurable **Agent Persona**:
- **Role** — Sales, Support, Booking, or Custom
- **Tone** — Formal, Casual, Friendly
- **Language** — Auto-detected Arabic from instructions (Arabic script detection)
- **Dialect** — Khaliji, Iraqi, Shami, Egyptian, Maghrebi, Saudi
- **Instructions** — Custom behavioural guidelines injected at the top of the system prompt

The persona context is placed at the **top of the system prompt** (models ignore appended instructions, so position matters).

### Conversation Flow

```
User message → WhatsApp webhook
    ↓
conversationEngine.routeConversation()
    ↓
RouterAgent (classifies intent)
    ↓
    ├─ LeadQualificationAgent (lead interest detected)
    ├─ SupportAgent (FAQ/support query)
    ├─ BookingAgent (booking intent)
    └─ SupportAgent (fallback)
    ↓
AI response → WhatsApp streaming (token-by-token typing indicator)
    ↓
triggerFollowUps() — fires in background, checks stale conversations
```

### JSON Safety
Two layers prevent raw JSON from leaking to customers:
1. `LeadQualificationAgent` never asks for structured JSON — asks for natural sentences
2. `conversationEngine` safety net catches any remaining garbage before WhatsApp send

---

## 🔌 Channels

### WhatsApp (Baileys)
- Local pairing via QR code → `Settings → Integrations → WhatsApp`
- Sessions persist to `whatsapp-session.json`
- Handles: text, images, voice notes (transcribed via Ollama whisper), documents
- Blocked: group messages (`@g.us`), newsletter (`@newsletter`), status broadcasts (`@status.broadcast`)

### Instagram
Webhook route exists at `app/api/webhooks/instagram/route.ts` — needs:
- Meta App with Instagram Messaging product
- `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET`, `INSTAGRAM_ACCESS_TOKEN` in `.env`

### Web Chat
Embed snippet (generated in Settings):
```html
<script src="https://your-domain.com/widget.js"></script>
<div id="rana-chat" room="YOUR_WORKSPACE_ID"></div>
```

### Email
- Inbound: `app/api/webhooks/email/route.ts` (Resend inbound relay)
- Outbound: `lib/email.ts` (React Email templates → Resend API)

---

## 🛡️ Security

- All dashboard routes protected by NextAuth v5 session
- Workspace-scoped data isolation (every query filters by `workspaceId`)
- WhatsApp webhook verification via `WHATSAPP_VERIFY_TOKEN`
- Stripe webhook signature verification
- Ollama AI runs locally — no data leaves the server

---

## 🚢 Deployment

### Railway / Render / Fly.io

```bash
# Set environment variables in dashboard
DATABASE_URL="postgresql://..."      # Neon recommended
DIRECT_URL="postgresql://..."         # Same as DATABASE_URL or direct connection
NEXTAUTH_SECRET="..."                # min 32 chars
NEXTAUTH_URL="https://your-domain.com"
WHATSAPP_SESSION_FILE="/app/whatsapp-session.json"
OLLAMA_BASE_URL="http://localhost:11434"  # Ollama must be running on the server
```

```bash
# Run migrations on deploy
npx prisma migrate deploy
```

### Vercel (limited)
Vercel serverless functions can't maintain long-lived WebSocket connections — **WhatsApp Baileys won't work on Vercel**. Use Railway, Render, or a VPS.

### Ollama on Production Server

```bash
# Install Ollama on your server
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen3.5:2b   # or your preferred model

# Run as a systemd service
sudo systemctl enable ollama
```

---

## 📊 Database Schema

PostgreSQL only — 19 tables covering: workspaces, users, conversations, messages, contacts, leads, agents, personas, flows, integrations, agent logs, knowledge base.

Managed via Prisma 7 migrations. Generate the client after any schema change:

```bash
npx prisma generate   # Regenerate types after schema change
npx prisma db push   # Apply schema changes (development)
npx prisma migrate deploy  # Apply migrations (production)
```

---

## 📝 License

MIT — see [LICENSE](LICENSE) file.
