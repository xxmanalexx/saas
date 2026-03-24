import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
  typescript: true,
});

export const PLANS = {
  FREE: {
    name: "Free",
    price: 0,
    priceId: null,
    limits: {
      conversations: 50,
      leads: 25,
      integrations: 1,
      agents: ["router"],
    },
  },
  STARTER: {
    name: "Starter",
    price: 49,
    priceId: process.env.STRIPE_STARTER_PRICE_ID!,
    limits: {
      conversations: 1000,
      leads: 500,
      integrations: 3,
      agents: ["router", "lead_qualification"],
    },
  },
  GROWTH: {
    name: "Growth",
    price: 149,
    priceId: process.env.STRIPE_GROWTH_PRICE_ID!,
    limits: {
      conversations: 10000,
      leads: 5000,
      integrations: 10,
      agents: ["router", "lead_qualification", "booking", "support"],
    },
  },
  ENTERPRISE: {
    name: "Enterprise",
    price: 499,
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID!,
    limits: {
      conversations: -1,
      leads: -1,
      integrations: -1,
      agents: ["router", "lead_qualification", "booking", "support", "follow_up"],
    },
  },
} as const;
