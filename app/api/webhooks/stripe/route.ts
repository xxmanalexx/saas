import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      // Determine plan from price ID
      const priceId = session.line_items?.data[0]?.price?.id;
      let plan: "FREE" | "STARTER" | "GROWTH" | "ENTERPRISE" = "FREE";
      if (priceId === process.env.STRIPE_STARTER_PRICE_ID) plan = "STARTER";
      else if (priceId === process.env.STRIPE_GROWTH_PRICE_ID) plan = "GROWTH";
      else if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) plan = "ENTERPRISE";

      await db.user.updateMany({
        where: { stripeCustomerId: customerId },
        data: { plan, stripeCustomerId: customerId },
      });
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const cancelAt = sub.cancel_at;
      if (cancelAt && cancelAt > Date.now() / 1000) {
        // Subscription scheduled for cancellation — flag it
        console.log(`[Stripe] Subscription ${sub.id} scheduled for cancellation`);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await db.user.updateMany({
        where: { stripeCustomerId: sub.customer as string },
        data: { plan: "FREE" },
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      console.warn(`[Stripe] Payment failed for customer ${invoice.customer}`);
      // TODO: send email notification, downgrade after grace period
      break;
    }
  }

  return NextResponse.json({ received: true });
}
