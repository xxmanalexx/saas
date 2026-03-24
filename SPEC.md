# Rana — AI Agent SaaS Platform

## 1. Concept & Vision

**Product name:** Rana (AI employee + platform)  
**Target:** Businesses in MENA — SMEs, agencies, e-commerce brands  
**Core promise:** An AI agent that handles your entire customer conversation stack — qualify, book, support, follow-up — across WhatsApp, Instagram, web chat, email, and CRM. No human needed for routine conversations.

**What it feels like:** A tireless employee who never sleeps, never forgets, never drops a lead. Every customer interaction is captured, responded to intelligently, and routed to the right place.

---

## 2. Business Architecture

### 2.1 Revenue Model
- SaaS subscription (tiers based on conversation volume / features)
- Stripe billing — monthly + annual plans
- First-party tiered pricing: Starter → Growth → Enterprise

### 2.2 Customer Journey (Happy Path)
1. Business signs up → chooses integrations (WhatsApp, IG, web chat, email, CRM)
2. Connects channels via OAuth or API keys
3. Configures AI behavior (greeting, qualification questions, escalation rules)
4. AI goes live — handles conversations 24/7
5. Human can monitor, override, or review transcripts in dashboard
6. Leads automatically enriched, qualified, and routed to CRM / sent to sales

### 2.3 Integrations
| Channel | Integration |
|---|---|
| WhatsApp | Meta Business API |
| Instagram | Meta Business API (DMs) |
| Web Chat | Custom embeddable widget |
| Email | SMTP / SendGrid / Resend |
| CRM | HubSpot, Zoho, Pipedrive (modular adapter) |
| Calendar | Cal.com, Google Calendar |
| Payments | Stripe (for booking/payment flows) |
| Notifications | Slack / Telegram for human alerts |

---

## 3. Technical Architecture

### 3.1 Stack
- **Frontend:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API Routes + standalone Node.js workers
- **Database:** PostgreSQL (Neon / Supabase / Railway)
- **Auth:** NextAuth.js v5 (email magic link + OAuth)
- **Payments:** Stripe (subscriptions + webhook handling)
- **Queue:** In-memory queue (BullMQ on Redis when scaled)
- **AI:** Ollama (local) + cloud model fallback
- **Deployment:** Vercel (frontend) + Railway/Render (workers)

### 3.2 Core Domain Entities

```
User (Business Account)
  └── Workspace
        └── Agent (AI configuration per workspace)
              ├── Conversation (thread from any channel)
              │     └── Message (individual turn)
              ├── Lead (qualified contact)
              │     └── LeadEvent (stage changes, notes)
              ├── Flow (conversation flow builder)
              │     └── FlowNode (individual step)
              ├── Integration (channel config)
              └── Transcript (full chat record)
```

### 3.3 Module Map

```
/app                    — Next.js app (dashboard + public pages)
/app/api                — API routes (webhooks, auth, actions)
/agents                 — AI agent logic
  /agents/LeadQualificationAgent.ts
  /agents/BookingAgent.ts
  /agents/SupportAgent.ts
  /agents/FollowUpAgent.ts
  /agents/RouterAgent.ts
/channels               — Channel adapters
  /channels/whatsapp.ts
  /channels/instagram.ts
  /channels/webchat.ts
  /channels/email.ts
/crm                    — CRM adapters
  /crm/hubspot.ts
  /crm/zoho.ts
  /crm/pipedrive.ts
/lib                    — Shared utilities
  /lib/db.ts            — Database client
  /lib/ai.ts            — AI client wrapper
  /lib/queue.ts         — Job queue
  /lib/logger.ts        — Unified logging
/components             — React components
  /components/ui        — shadcn/ui primitives
  /components/dashboard — Dashboard-specific
/workers                — Background job processors
```

---

## 4. AI Agent Design

### 4.1 Agent Types

| Agent | Role |
|---|---|
| `RouterAgent` | Entry point — classifies intent, routes to specialist |
| `LeadQualificationAgent` | Asks qualifying questions, scores leads, saves to CRM |
| `BookingAgent` | Handles calendar availability, books appointments |
| `SupportAgent` | FAQ, troubleshooting, ticket creation |
| `FollowUpAgent` | Re-engages cold leads, sends reminders, NPS |

### 4.2 Conversation Flow (Default)
```
Customer Message
  → RouterAgent classifies intent
  → Routes to appropriate specialist agent
  → Agent responds (with tools: CRM lookup, calendar check, etc.)
  → Response sent back via same channel
  → All messages logged to Transcript + Lead record
  → Escalation to human if: sentiment spike, keyword match, or explicit request
```

### 4.3 Escalation Rules
- Explicit: customer says "talk to human", "real person", etc.
- Sentiment: negative sentiment score > 0.7
- Keywords: "refund", "complaint", "urgent", "cancel"
- Business hours override (optional live handoff)

---

## 5. Database Schema (PostgreSQL)

```sql
-- Core tables
users             (id, email, name, created_at, stripe_customer_id, plan)
workspaces        (id, user_id, name, settings jsonb, created_at)
agents            (id, workspace_id, name, type, config jsonb, created_at)

-- Conversations
conversations     (id, workspace_id, channel, channel_id, contact_id, status, created_at, updated_at)
messages         (id, conversation_id, role, content, metadata jsonb, created_at)
contacts          (id, workspace_id, channel, channel_identifier, profile jsonb, created_at)

-- Leads
leads             (id, workspace_id, contact_id, score, stage, owner_id, created_at, updated_at)
lead_events       (id, lead_id, type, data jsonb, created_at)

-- Flows
flows             (id, workspace_id, name, trigger, nodes jsonb, created_at)
flow_runs         (id, flow_id, contact_id, status, started_at, ended_at)

-- Integrations
integrations      (id, workspace_id, channel, credentials jsonb, status, created_at)

-- Logs (append-only)
transcripts       (id, workspace_id, conversation_id, messages jsonb, created_at)
agent_logs        (id, agent_id, input, output, tokens, latency_ms, created_at)
```

---

## 6. Design Language

- **Aesthetic:** Clean SaaS dashboard — dark sidebar, light content area, accent green (#00C853)
- **Typography:** Inter (UI), Geist (code)
- **Icons:** Lucide React
- **Component library:** shadcn/ui (Radix primitives + Tailwind)
- **Mood:** Professional, trustworthy, MENA-friendly (RTL-ready layout hooks)

---

## 7. MVP Scope (Phase 1)

### Must ship
- [ ] Next.js app scaffold (empty shell deployable)
- [ ] Database schema + Prisma setup
- [ ] Auth (email magic link + GitHub OAuth)
- [ ] Dashboard shell (sidebar, header, main area)
- [ ] Integration stubs (WhatsApp, Instagram, email, CRM — wired but not live)
- [ ] RouterAgent (basic intent classification + routing)
- [ ] LeadQualificationAgent (question flow + scoring)
- [ ] Conversation logging (PostgreSQL write on every message)
- [ ] Stripe subscription setup (3 tiers, webhook handler)

### Nice to have (Phase 2)
- Visual flow builder (drag-and-drop)
- Full BookingAgent with Cal.com
- Full SupportAgent with knowledge base
- Full CRM adapters (HubSpot, Zoho, Pipedrive)
- Web chat widget (embeddable)

---

## 8. Decisions & Conventions

| Decision | Choice | Reason |
|---|---|---|
| Framework | Next.js App Router | File-based API + frontend in one |
| Language | TypeScript strict | Fewer bugs, better AI code generation |
| ORM | Prisma | Type-safe, schema-first, good migrations |
| Auth | NextAuth v5 | Battle-tested, flexible providers |
| Payments | Stripe + webhooks | Standard, reliable |
| AI | Ollama local + cloud fallback | Cost control + privacy |
| Styling | Tailwind + shadcn/ui | Fast, consistent, accessible |
| Queue | BullMQ on Redis | Production-grade when we scale |
| Deployment | Vercel (FE) + Railway (workers) | Fastest to ship |

---

*Last updated: 2026-03-24 by Rana 🦾*
