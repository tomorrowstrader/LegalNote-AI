/**
 * Firm billing helpers — Boutique per-seat conversion from governed evaluation.
 */

import { firmHasPaidAccess } from "@shared/evaluationAccess";
import { getUncachableStripeClient } from "../stripeClient";
import { storage } from "../storage";

/** Live Boutique monthly price created in Stripe (£199 / seat). Override via env if rotated. */
export const BOUTIQUE_MONTHLY_PRICE_ID =
  process.env.STRIPE_BOUTIQUE_MONTHLY_PRICE_ID || "price_1UBe82BRvCfGGlxLHRGgyg2Y";

export const BOUTIQUE_PRODUCT_ID =
  process.env.STRIPE_BOUTIQUE_PRODUCT_ID || "prod_VC2CWCvGOtRQ9g";

export const BOUTIQUE_UNIT_AMOUNT_PENCE = 19900;

export type BoutiquePriceInfo = {
  productId: string;
  priceId: string;
  unitAmount: number;
  currency: string;
  interval: string;
  plan: "boutique";
};

/** Look up Boutique monthly price (env id first, then Stripe metadata). */
export async function getBoutiqueMonthlyPrice(): Promise<BoutiquePriceInfo> {
  const stripe = await getUncachableStripeClient();
  const priceId = BOUTIQUE_MONTHLY_PRICE_ID;
  try {
    const price = await stripe.prices.retrieve(priceId);
    if (!price.active) throw new Error("Boutique price is inactive");
    return {
      productId: typeof price.product === "string" ? price.product : price.product.id,
      priceId: price.id,
      unitAmount: price.unit_amount ?? BOUTIQUE_UNIT_AMOUNT_PENCE,
      currency: price.currency,
      interval: price.recurring?.interval || "month",
      plan: "boutique",
    };
  } catch (err) {
    console.warn("[BILLING] Env Boutique price lookup failed, searching by metadata:", err);
    const products = await stripe.products.search({
      query: "metadata['plan']:'boutique' AND active:'true'",
      limit: 1,
    });
    const product = products.data[0];
    if (!product) throw new Error("Boutique product not found in Stripe");
    const prices = await stripe.prices.list({ product: product.id, active: true, limit: 20 });
    const monthly = prices.data.find(
      (p) => p.recurring?.interval === "month" && (p.recurring?.interval_count ?? 1) === 1,
    );
    if (!monthly) throw new Error("Boutique monthly price not found in Stripe");
    return {
      productId: product.id,
      priceId: monthly.id,
      unitAmount: monthly.unit_amount ?? BOUTIQUE_UNIT_AMOUNT_PENCE,
      currency: monthly.currency,
      interval: "month",
      plan: "boutique",
    };
  }
}

/**
 * Resolve a customer-facing promotion/coupon code to a Stripe promotion_code id.
 * Returns null if the code is missing or inactive — callers should surface a clear error.
 */
export async function resolvePromotionCodeId(
  code: string,
): Promise<{ promotionCodeId: string; code: string } | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const stripe = await getUncachableStripeClient();
  const list = await stripe.promotionCodes.list({
    code: trimmed,
    active: true,
    limit: 1,
  });
  const promo = list.data[0];
  if (!promo) return null;
  return { promotionCodeId: promo.id, code: promo.code };
}

export async function ensureFirmStripeCustomer(params: {
  firmId: string;
  email: string;
  name?: string;
  userId: string;
}): Promise<string> {
  const firm = await storage.getFirm(params.firmId);
  if (!firm) throw new Error("Firm not found");
  if (firm.stripeCustomerId) return firm.stripeCustomerId;

  const stripe = await getUncachableStripeClient();
  const customer = await stripe.customers.create({
    email: params.email,
    name: params.name || firm.name,
    metadata: {
      firmId: params.firmId,
      userId: params.userId,
      plan: "boutique",
    },
  });
  await storage.updateFirm(params.firmId, { stripeCustomerId: customer.id });
  return customer.id;
}

export function isPaidSubscriptionStatus(status: string | null | undefined): boolean {
  return firmHasPaidAccess({ subscriptionStatus: status });
}

/** Activate or refresh firm paid access from a Stripe subscription. */
export async function applyFirmSubscriptionFromStripe(params: {
  firmId: string;
  customerId?: string | null;
  subscriptionId: string;
  status: string;
  seatQuantity?: number | null;
  plan?: string | null;
}): Promise<void> {
  const firm = await storage.getFirm(params.firmId);
  if (!firm) {
    console.error("[BILLING] applyFirmSubscriptionFromStripe: firm not found", params.firmId);
    return;
  }

  const paid = isPaidSubscriptionStatus(params.status);
  const updates: Record<string, unknown> = {
    stripeSubscriptionId: params.subscriptionId,
    subscriptionStatus: params.status,
    subscriptionPlan: params.plan || firm.subscriptionPlan || "boutique",
  };
  if (params.customerId) updates.stripeCustomerId = params.customerId;
  if (params.seatQuantity != null && params.seatQuantity > 0) {
    updates.subscriptionSeatQuantity = params.seatQuantity;
    updates.seatLimit = params.seatQuantity;
  }
  if (paid) {
    updates.isEvaluation = false;
    if (!firm.convertedAt) updates.convertedAt = new Date();
  }

  await storage.updateFirm(params.firmId, updates as any);
  console.log(
    `[BILLING] Firm ${params.firmId} subscription ${params.subscriptionId} → ${params.status} (paid=${paid})`,
  );
}

/** Find firmId from Stripe object metadata or customer metadata. */
export async function resolveFirmIdFromStripeObject(obj: {
  metadata?: Record<string, string> | null;
  customer?: string | { id?: string } | null;
}): Promise<string | null> {
  const fromMeta = obj.metadata?.firmId;
  if (fromMeta) return fromMeta;

  const customerId =
    typeof obj.customer === "string" ? obj.customer : obj.customer?.id || null;
  if (!customerId) return null;

  // Prefer firm row with this customer id
  const firm = await storage.getFirmByStripeCustomerId(customerId);
  if (firm?.id) return firm.id;

  const stripe = await getUncachableStripeClient();
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return null;
  return (customer.metadata?.firmId as string) || null;
}
