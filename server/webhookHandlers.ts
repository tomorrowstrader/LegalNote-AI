// Webhook Handlers for Stripe events
// Processes webhooks via stripe-replit-sync, then unlocks firm billing on paid events.

import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import {
  applyFirmSubscriptionFromStripe,
  resolveFirmIdFromStripeObject,
} from './services/firmBillingService';

async function handleFirmBillingEvent(eventType: string, dataObject: any): Promise<void> {
  try {
    if (eventType === 'checkout.session.completed') {
      const session = dataObject;
      if (session.mode !== 'subscription') return;
      const firmId =
        session.metadata?.firmId ||
        (await resolveFirmIdFromStripeObject(session));
      if (!firmId) {
        console.warn('[STRIPE] checkout.session.completed without firmId metadata');
        return;
      }
      const subscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id;
      if (!subscriptionId) return;

      const stripe = await getUncachableStripeClient();
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const quantity =
        sub.items?.data?.[0]?.quantity ??
        (session.metadata?.seatQuantity ? Number(session.metadata.seatQuantity) : null);

      await applyFirmSubscriptionFromStripe({
        firmId,
        customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
        subscriptionId: sub.id,
        status: sub.status,
        seatQuantity: quantity,
        plan: session.metadata?.plan || sub.metadata?.plan || 'boutique',
      });
      return;
    }

    if (
      eventType === 'customer.subscription.updated' ||
      eventType === 'customer.subscription.deleted' ||
      eventType === 'customer.subscription.created'
    ) {
      const sub = dataObject;
      const firmId =
        sub.metadata?.firmId ||
        (await resolveFirmIdFromStripeObject(sub));
      if (!firmId) return;

      const quantity = sub.items?.data?.[0]?.quantity ?? null;
      await applyFirmSubscriptionFromStripe({
        firmId,
        customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
        subscriptionId: sub.id,
        status: eventType === 'customer.subscription.deleted' ? 'canceled' : sub.status,
        seatQuantity: quantity,
        plan: sub.metadata?.plan || 'boutique',
      });
    }
  } catch (err) {
    console.error('[STRIPE] Firm billing webhook handler error:', err);
  }
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string, uuid: string): Promise<void> {
    // Validate payload is a Buffer
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature, uuid);

    // Signature already verified by sync — safely parse for firm unlock side effects.
    try {
      const event = JSON.parse(payload.toString('utf8')) as {
        type?: string;
        data?: { object?: unknown };
      };
      if (event.type && event.data?.object) {
        await handleFirmBillingEvent(event.type, event.data.object);
      }
    } catch (err) {
      console.error('[STRIPE] Failed to parse webhook payload for firm billing:', err);
    }
  }
}
