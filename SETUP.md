# Setup Guide — Rana AI Agent Platform

## One-time GitHub Push

```bash
cd ~/saas
git remote set-url origin https://<YOUR_GITHUB_TOKEN>@github.com/xxmanalexx/saas
git push -u origin main
```

Or add a deploy key in GitHub Settings → Deploy Keys.

---

## Local Development Setup

### 1. Install dependencies
```bash
cd ~/saas
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env
# Fill in all values (see section below)
```

### 3. Set up database
```bash
# Option A: Local PostgreSQL
createdb rana_saas
npx prisma migrate dev

# Option B: Neon (cloud PostgreSQL)
# Create a project at neon.tech, get the connection string
# Set DATABASE_URL in .env
npx prisma migrate dev
```

### 4. Generate Prisma client
```bash
npx prisma generate
```

### 5. Run dev server
```bash
npm run dev
```

Open http://localhost:3000

---

## Environment Variables to Set

### Database
```
DATABASE_URL="postgresql://user:password@localhost:5432/rana_saas"
```

### Auth (NextAuth v5)
```
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# GitHub OAuth App (github.com/settings/developers)
GITHUB_CLIENT_ID="Ov23..."
GITHUB_CLIENT_SECRET="..."
```

### Stripe
```
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."  # from stripe listen --forward-to localhost:3000/api/webhooks/stripe
STRIPE_STARTER_PRICE_ID="price_..."
STRIPE_GROWTH_PRICE_ID="price_..."
STRIPE_ENTERPRISE_PRICE_ID="price_..."
```

### AI
```
OLLAMA_BASE_URL="http://localhost:11434"  # Ollama must be running
AI_MODEL="llama3.2"  # or your preferred model
```

### WhatsApp (Meta Business API)
```
WHATSAPP_ACCESS_TOKEN="..."
WHATSAPP_PHONE_NUMBER_ID="..."
WHATSAPP_BUSINESS_ACCOUNT_ID="..."
WHATSAPP_VERIFY_TOKEN="any-random-string"  # set in Meta webhook config
```

### Email (Resend)
```
RESEND_API_KEY="re_..."
```

### CRM (optional)
```
HUBSPOT_API_KEY="..."
ZOHO_API_KEY="..."
PIPEDRIVE_API_KEY="..."
```

### Cal.com (optional)
```
CAL_COM_API_KEY="..."
CAL_COM_BASE_URL="https://api.cal.com/v1"
```

---

## Setting up Stripe Products & Prices

1. Go to https://dashboard.stripe.com/test/products
2. Create 3 products: Starter ($49), Growth ($149), Enterprise ($499)
3. Copy the `price_id` for each into your `.env`
4. For local webhook testing: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

---

## Setting up GitHub OAuth App

1. Go to https://github.com/settings/developers
2. New OAuth App
3. Homepage URL: `http://localhost:3000`
4. Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
5. Copy Client ID and Secret to `.env`

---

## What's Running

| File | Description |
|---|---|
| `app/page.tsx` | Landing page |
| `app/(dashboard)/dashboard/page.tsx` | Dashboard overview |
| `app/(dashboard)/dashboard/conversations/page.tsx` | Conversation list |
| `app/(dashboard)/dashboard/leads/page.tsx` | Lead pipeline |
| `app/(dashboard)/dashboard/integrations/page.tsx` | Channel connections |
| `app/(dashboard)/dashboard/settings/page.tsx` | Plan & profile |
| `app/api/webhooks/whatsapp/route.ts` | WhatsApp incoming webhook |
| `app/api/webhooks/webchat/route.ts` | Web chat webhook |
| `app/api/webhooks/email/route.ts` | Email webhook |
| `app/api/webhooks/stripe/route.ts` | Stripe events |
| `lib/conversationEngine.ts` | Main message routing engine |
| `agents/RouterAgent.ts` | Intent classification + routing |
| `agents/LeadQualificationAgent.ts` | Lead scoring + qualification |
| `agents/SupportAgent.ts` | FAQ + support |
| `agents/BookingAgent.ts` | Appointment booking |
| `agents/FollowUpAgent.ts` | Cold lead re-engagement |

---

## Next Steps (Tonight's PR List)

- [ ] **Webhook for Instagram** — `app/api/webhooks/instagram/route.ts`
- [ ] **Flow builder UI** — visual drag-and-drop conversation flow editor
- [ ] **Booking agent** — real Cal.com API integration
- [ ] **Email delivery** — actually send emails (Resend) not just log
- [ ] **Dashboard charts** — real analytics (conversation volume, lead funnel)
- [ ] **Web chat widget** — embeddable JS snippet
- [ ] **Test suite** — vitest for agents + conversation engine
- [ ] **CI/CD** — GitHub Actions for type check + test on PR
- [ ] **Cron job** — `FollowUpAgent` to run nightly on cold leads
- [ ] **Slack notifications** — escalation alerts to a channel
