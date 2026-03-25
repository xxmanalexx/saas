# Rana — AI Agent SaaS Platform

> Autonomous AI agents that handle customer conversations across WhatsApp, Instagram, web chat, and email — built for MENA businesses.

![Node](https://img.shields.io/badge/Node.js-22-green) ![Next.js](https://img.shields.io/badge/Next.js-16-black) ![Prisma](https://img.shields.io/badge/Prisma-7-blue) ![Ollama](https://img.shields.io/badge/AI-Ollama-orange)

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
- Ollama running (`ollama serve`) with a model pulled (e.g. `ollama pull qwen3.5:2b`)

### 1. Clone & Install

```bash
git clone https://github.com/xxmanalexx/saas.git
cd saas
npm install
```

### 2. Set up database (choose one)

**Option A — SQLite (zero-setup, recommended for dev)**

```bash
node scripts/setup-sqlite.js
```

Creates all 19 tables instantly via `better-sqlite3`. No CLI, no compilation, no external services.

**Option B — PostgreSQL / Neon (production)**

```bash
# Create a project at neon.tech and copy the connection string
# Then:
cp prisma/schema.postgresql.prisma prisma/schema.prisma
npx prisma generate
npx prisma db push
```

Set in `.env`:
```env
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
```

### 3. Configure environment

```bash
cp .env.example .env
# Fill in the required values (see Environment Variables below)
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — OAuth login → dashboard.

---

## ⚙️ Environment Variables

```env
# ── Database ────────────────────────────────────────────────────────────────
# SQLite (default for dev — zero setup):
DATABASE_URL="file:./data/rana.db"

# PostgreSQL / Neon (production):
# DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"

# ── Auth (NextAuth v5) ───────────────────────────────────────────────────────
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# GitHub OAuth App: github.com/settings/developers
# Callback URL: http://localhost:3000/api/auth/callback/github
GITHUB_CLIENT_ID="Ov23..."
GITHUB_CLIENT_SECRET="..."

# ── Ollama AI ────────────────────────────────────────────────────────────────
OLLAMA_BASE_URL="http://localhost:11434"
AI_MODEL="qwen3.5:2b"   # any Ollama model (qwen, llama3.2, mistral, etc.)
# Set to "false" in Settings UI to disable extended thinking

# ── WhatsApp (Baileys — local pairing) ─────────────────────────────────────
WHATSAPP_SESSION_FILE="./whatsapp-session.json"

# ── Stripe ──────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."   # from: stripe listen --forward-to localhost:3000/api/webhooks/stripe

# ── Email (Resend) ──────────────────────────────────────────────────────────
RESEND_API_KEY="re_..."

# ── Optional Integrations ────────────────────────────────────────────────────
CAL_COM_API_KEY="..."
HUBSPOT_API_KEY="..."
```

---

## 🗂️ Project Structure

```
saas/
├── app/
│   ├── (dashboard)/              # Protected dashboard routes
│   │   └── dashboard/
│   │       ├── page.tsx         # Overview + stats
│   │       ├── conversations/   # Live conversation monitoring
│   │       ├── leads/           # Lead pipeline
│   │       ├── analytics/       # Business analytics
│   │       ├── settings/        # Workspace config, Ollama, persona
│   │       └── integrations/    # Channel connections
│   └── api/
│       ├── auth/                # NextAuth v5
│       ├── webhooks/
│       │   ├── whatsapp/        # WhatsApp Baileys webhook
│       │   ├── webchat/         # Web chat webhook
│       │   └── stripe/         # Billing events
│       ├── conversations/       # CRUD + clear history
│       ├── leads/              # Lead management
│       ├── settings/            # Workspace + Ollama config
│       ├── personas/            # Agent persona management
│       ├── analytics/           # Dashboard data
│       ├── chat/completions/    # Chat API endpoint
│       └── cron/follow-up/      # Follow-up job trigger
├── agents/
│   ├── RouterAgent.ts           # Intent classification
│   ├── LeadQualificationAgent.ts # Lead scoring
│   ├── SupportAgent.ts          # FAQ + support
│   ├── BookingAgent.ts          # Calendar booking
│   └── FollowUpAgent.ts        # Auto follow-up
├── lib/
│   ├── conversationEngine.ts    # Central routing + agent orchestration
│   ├── ai.ts                    # Ollama streaming client
│   ├── db.ts                    # Dual-driver DB (PostgreSQL / SQLite)
│   ├── whatsappBaileys.ts       # Baileys WhatsApp client
│   ├── whisperTranscriber.ts    # Voice note → text
│   ├── ollamaConfig.ts          # Workspace Ollama config (cached)
│   └── triggerFollowUps.ts      # Fire-and-forget follow-up trigger
├── prisma/
│   ├── schema.prisma            # Default: PostgreSQL schema
│   ├── schema.postgresql.prisma # Explicit PostgreSQL variant
│   └── schema.sqlite.prisma     # SQLite variant
├── scripts/
│   └── setup-sqlite.js          # Zero-setup SQLite init
└── channels/
    └── whatsapp.ts              # WhatsApp channel adapter
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
- `MEMORY.md` never exposed in shared/group chat contexts

---

## 🚢 Deployment

### Railway / Render / Fly.io

```bash
# Set environment variables in dashboard
DATABASE_URL="postgresql://..."   # Neon recommended
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="https://your-domain.com"
WHATSAPP_SESSION_FILE="/app/whatsapp-session.json"
OLLAMA_BASE_URL="http://localhost:11434"  # Ollama must be running on the server
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

19 tables covering: workspaces, users, conversations, messages, contacts, leads, agents, personas, flows, integrations, agent logs, knowledge base.

Migrations managed via Prisma 7. Switch between PostgreSQL and SQLite by swapping the schema file.

---

## 📝 License

MIT — see [LICENSE](LICENSE) file.
