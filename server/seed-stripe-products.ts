// Seed script to create LegalNote subscription products in Stripe
// Run with: npx tsx server/seed-stripe-products.ts

import { getUncachableStripeClient } from './stripeClient';

async function createProducts() {
  console.log('Creating LegalNote products in Stripe...');
  
  const stripe = await getUncachableStripeClient();

  // Check if products already exist
  const existingProducts = await stripe.products.search({ 
    query: "metadata['app']:'legalnote-ai'" 
  });
  
  if (existingProducts.data.length > 0) {
    console.log('Products already exist. Skipping creation.');
    console.log('Existing products:', existingProducts.data.map(p => p.name));
    return;
  }

  // Create Solo Plan
  console.log('Creating Solo Plan...');
  const soloProduct = await stripe.products.create({
    name: 'Solo Plan',
    description: 'Professional legal documentation for solo practitioners. Includes AI transcription, attendance notes, AI summaries, and secure document sharing.',
    metadata: {
      app: 'legalnote-ai',
      plan: 'solo',
      features: 'unlimited_recordings,ai_transcription,attendance_notes,ai_summaries,document_sharing,firm_branding,calendar_sync',
    },
  });

  // Create Solo Plan monthly price (£99/month)
  const soloMonthlyPrice = await stripe.prices.create({
    product: soloProduct.id,
    unit_amount: 9900, // £99.00 in pence
    currency: 'gbp',
    recurring: { interval: 'month' },
    metadata: {
      plan: 'solo',
      billing_period: 'monthly',
    },
  });

  // Create Solo Plan annual price (£999/year - 2 months free)
  const soloAnnualPrice = await stripe.prices.create({
    product: soloProduct.id,
    unit_amount: 99900, // £999.00 in pence
    currency: 'gbp',
    recurring: { interval: 'year' },
    metadata: {
      plan: 'solo',
      billing_period: 'annual',
    },
  });

  console.log(`Solo Plan created: ${soloProduct.id}`);
  console.log(`  Monthly price: ${soloMonthlyPrice.id} (£99/month)`);
  console.log(`  Annual price: ${soloAnnualPrice.id} (£999/year)`);

  // Create Team Plan
  console.log('Creating Team Plan...');
  const teamProduct = await stripe.products.create({
    name: 'Team Plan',
    description: 'Legal documentation for boutique law firms. Includes everything in Solo plus multi-user access, team collaboration, and priority support.',
    metadata: {
      app: 'legalnote-ai',
      plan: 'team',
      features: 'everything_in_solo,multi_user,team_collaboration,priority_support,admin_dashboard,audit_reports',
    },
  });

  // Create Team Plan base monthly price (£199/month for first seat)
  const teamMonthlyPrice = await stripe.prices.create({
    product: teamProduct.id,
    unit_amount: 19900, // £199.00 in pence
    currency: 'gbp',
    recurring: { interval: 'month' },
    metadata: {
      plan: 'team',
      billing_period: 'monthly',
      includes_seats: '1',
    },
  });

  // Create per-seat addon (£49/month per additional user)
  const seatAddonProduct = await stripe.products.create({
    name: 'Additional Team Seat',
    description: 'Add an additional user to your Team Plan.',
    metadata: {
      app: 'legalnote-ai',
      addon: 'team_seat',
    },
  });

  const seatAddonPrice = await stripe.prices.create({
    product: seatAddonProduct.id,
    unit_amount: 4900, // £49.00 in pence
    currency: 'gbp',
    recurring: { interval: 'month' },
    metadata: {
      addon: 'team_seat',
      billing_period: 'monthly',
    },
  });

  console.log(`Team Plan created: ${teamProduct.id}`);
  console.log(`  Monthly price: ${teamMonthlyPrice.id} (£199/month base)`);
  console.log(`Additional Seat addon: ${seatAddonProduct.id}`);
  console.log(`  Per-seat price: ${seatAddonPrice.id} (£49/month)`);

  console.log('\nAll products created successfully!');
  console.log('\nPrice IDs for frontend integration:');
  console.log(`SOLO_MONTHLY_PRICE_ID: ${soloMonthlyPrice.id}`);
  console.log(`SOLO_ANNUAL_PRICE_ID: ${soloAnnualPrice.id}`);
  console.log(`TEAM_MONTHLY_PRICE_ID: ${teamMonthlyPrice.id}`);
  console.log(`SEAT_ADDON_PRICE_ID: ${seatAddonPrice.id}`);
}

createProducts().catch(console.error);
