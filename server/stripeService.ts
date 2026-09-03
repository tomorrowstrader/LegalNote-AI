// Stripe Service for LegalNote
// Handles direct Stripe API operations

import { getUncachableStripeClient } from './stripeClient';
import { db } from './db';
import { sql } from 'drizzle-orm';

export type CreateCheckoutSessionParams = {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  /** Omit or 0 for no trial (post-evaluation conversion). Default 14 for legacy self-serve. */
  trialDays?: number;
  quantity?: number;
  metadata?: Record<string, string>;
  subscriptionMetadata?: Record<string, string>;
  /**
   * When true (default), Stripe Checkout shows a coupon / promotion code field.
   * Must be false if promotionCodeId is supplied (Stripe does not allow both).
   */
  allowPromotionCodes?: boolean;
  /** Optional pre-applied Stripe promotion_code id (from resolvePromotionCodeId). */
  promotionCodeId?: string;
};

export class StripeService {
  // Create customer in Stripe
  async createCustomer(
    email: string,
    userId: string,
    name?: string,
    extraMetadata?: Record<string, string>,
  ) {
    const stripe = await getUncachableStripeClient();
    return await stripe.customers.create({
      email,
      name,
      metadata: { userId, ...extraMetadata },
    });
  }

  // Create checkout session for subscription
  async createCheckoutSession(
    customerIdOrParams: string | CreateCheckoutSessionParams,
    priceId?: string,
    successUrl?: string,
    cancelUrl?: string,
    trialDays: number = 14,
  ) {
    const stripe = await getUncachableStripeClient();

    const params: CreateCheckoutSessionParams =
      typeof customerIdOrParams === "string"
        ? {
            customerId: customerIdOrParams,
            priceId: priceId!,
            successUrl: successUrl!,
            cancelUrl: cancelUrl!,
            trialDays,
          }
        : customerIdOrParams;

    const quantity = Math.max(1, params.quantity ?? 1);
    const trial =
      params.trialDays == null ? 14 : Math.max(0, Math.floor(params.trialDays));
    const usePromotionCode = Boolean(params.promotionCodeId);
    const allowCodes =
      params.allowPromotionCodes !== false && !usePromotionCode;

    const sessionParams: Record<string, unknown> = {
      customer: params.customerId,
      payment_method_types: ["card"],
      line_items: [{ price: params.priceId, quantity }],
      mode: "subscription",
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      payment_method_collection: "always",
      metadata: params.metadata || {},
      subscription_data: {
        ...(trial > 0 ? { trial_period_days: trial } : {}),
        metadata: params.subscriptionMetadata || params.metadata || {},
      },
    };

    if (allowCodes) {
      sessionParams.allow_promotion_codes = true;
    }
    if (usePromotionCode && params.promotionCodeId) {
      sessionParams.discounts = [{ promotion_code: params.promotionCodeId }];
    }

    return await stripe.checkout.sessions.create(sessionParams as any);
  }

  // Create customer portal session for managing subscription
  async createCustomerPortalSession(customerId: string, returnUrl: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  // Query products from synced stripe schema
  async getProduct(productId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.products WHERE id = ${productId}`
    );
    return result.rows[0] || null;
  }

  async listProducts(active = true) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.products WHERE active = ${active} ORDER BY created DESC`
    );
    return result.rows;
  }

  // Get products with their prices
  async listProductsWithPrices(active = true) {
    const result = await db.execute(
      sql`
        SELECT 
          p.id as product_id,
          p.name as product_name,
          p.description as product_description,
          p.active as product_active,
          p.metadata as product_metadata,
          pr.id as price_id,
          pr.unit_amount,
          pr.currency,
          pr.recurring,
          pr.active as price_active,
          pr.metadata as price_metadata
        FROM stripe.products p
        LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
        WHERE p.active = ${active}
        ORDER BY p.created DESC, pr.unit_amount ASC
      `
    );
    return result.rows;
  }

  // Get subscription from synced data
  async getSubscription(subscriptionId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.subscriptions WHERE id = ${subscriptionId}`
    );
    return result.rows[0] || null;
  }

  // Get customer's active subscription
  async getCustomerSubscription(customerId: string) {
    const result = await db.execute(
      sql`
        SELECT * FROM stripe.subscriptions 
        WHERE customer = ${customerId} 
        AND status IN ('active', 'trialing')
        ORDER BY created DESC
        LIMIT 1
      `
    );
    return result.rows[0] || null;
  }
}

export const stripeService = new StripeService();
