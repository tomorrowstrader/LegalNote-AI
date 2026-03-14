// Seed script to create LegalNote one-time service products in Stripe
// Run with: npx tsx server/seed-stripe-services.ts
// These complement the subscription products with high-ticket services

import { getUncachableStripeClient } from './stripeClient';

async function createServiceProducts() {
  console.log('Creating LegalNote service products in Stripe...');
  
  const stripe = await getUncachableStripeClient();

  // Check if service products already exist
  const existingProducts = await stripe.products.search({ 
    query: "metadata['app']:'legalnote-ai' AND metadata['type']:'service'" 
  });
  
  if (existingProducts.data.length > 0) {
    console.log('Service products already exist. Skipping creation.');
    console.log('Existing products:', existingProducts.data.map(p => p.name));
    return;
  }

  // 1. Implementation Package - Standard
  console.log('Creating Implementation Package (Standard)...');
  const implStandard = await stripe.products.create({
    name: 'Meeting to Matter Implementation - Standard',
    description: 'Complete firm setup and onboarding package. Includes discovery call, account configuration, custom templates, 2x training sessions, 3 months subscription, email support, and go-live check-in.',
    metadata: {
      app: 'legalnote-ai',
      type: 'service',
      category: 'implementation',
      tier: 'standard',
    },
  });

  await stripe.prices.create({
    product: implStandard.id,
    unit_amount: 150000, // £1,500.00 in pence
    currency: 'gbp',
    metadata: {
      type: 'service',
      category: 'implementation',
    },
  });

  console.log(`  Created: ${implStandard.name} - £1,500`);

  // 2. Implementation Package - Premium
  console.log('Creating Implementation Package (Premium)...');
  const implPremium = await stripe.products.create({
    name: 'Meeting to Matter Implementation - Premium',
    description: 'Premium onboarding for larger firms. Includes everything in Standard plus additional training sessions, workflow customisation, and extended support period.',
    metadata: {
      app: 'legalnote-ai',
      type: 'service',
      category: 'implementation',
      tier: 'premium',
    },
  });

  await stripe.prices.create({
    product: implPremium.id,
    unit_amount: 250000, // £2,500.00 in pence
    currency: 'gbp',
    metadata: {
      type: 'service',
      category: 'implementation',
    },
  });

  console.log(`  Created: ${implPremium.name} - £2,500`);

  // 3. Implementation Package - Founding Client
  console.log('Creating Implementation Package (Founding Client)...');
  const implFounding = await stripe.products.create({
    name: 'Meeting to Matter Implementation - Founding Client',
    description: 'Special founding client rate for early adopters. Full implementation package with testimonial/case study rights.',
    metadata: {
      app: 'legalnote-ai',
      type: 'service',
      category: 'implementation',
      tier: 'founding',
    },
  });

  await stripe.prices.create({
    product: implFounding.id,
    unit_amount: 100000, // £1,000.00 in pence
    currency: 'gbp',
    metadata: {
      type: 'service',
      category: 'implementation',
    },
  });

  console.log(`  Created: ${implFounding.name} - £1,000`);

  // 4. Framework Consulting - Single Session
  console.log('Creating Framework Consulting Session...');
  const consultSession = await stripe.products.create({
    name: 'Meeting to Matter Consulting Session',
    description: 'Single consulting session covering methodology, process audit, or documentation workflow analysis. 90-minute virtual session.',
    metadata: {
      app: 'legalnote-ai',
      type: 'service',
      category: 'consulting',
    },
  });

  await stripe.prices.create({
    product: consultSession.id,
    unit_amount: 50000, // £500.00 in pence
    currency: 'gbp',
    metadata: {
      type: 'service',
      category: 'consulting',
    },
  });

  console.log(`  Created: ${consultSession.name} - £500`);

  // 5. Framework Consulting - Full Workshop
  console.log('Creating Framework Workshop...');
  const consultWorkshop = await stripe.products.create({
    name: 'Meeting to Matter Framework Workshop',
    description: 'Comprehensive methodology workshop for your firm. Half-day (3 hours) covering documentation standards, compliance, and implementation planning.',
    metadata: {
      app: 'legalnote-ai',
      type: 'service',
      category: 'consulting',
    },
  });

  await stripe.prices.create({
    product: consultWorkshop.id,
    unit_amount: 150000, // £1,500.00 in pence
    currency: 'gbp',
    metadata: {
      type: 'service',
      category: 'consulting',
    },
  });

  console.log(`  Created: ${consultWorkshop.name} - £1,500`);

  // 6. Virtual Workshop
  console.log('Creating Virtual Workshop...');
  const virtualWorkshop = await stripe.products.create({
    name: 'Documentation Mastery Virtual Workshop',
    description: 'Half-day virtual workshop (Zoom). Covers documentation liability, Meeting to Matter framework, practical exercises, and implementation roadmap.',
    metadata: {
      app: 'legalnote-ai',
      type: 'service',
      category: 'training',
    },
  });

  await stripe.prices.create({
    product: virtualWorkshop.id,
    unit_amount: 100000, // £1,000.00 in pence
    currency: 'gbp',
    metadata: {
      type: 'service',
      category: 'training',
    },
  });

  console.log(`  Created: ${virtualWorkshop.name} - £1,000`);

  // 7. Open Workshop - Per Attendee
  console.log('Creating Open Workshop Ticket...');
  const openWorkshop = await stripe.products.create({
    name: 'Open Workshop Ticket',
    description: 'Individual ticket for open enrolment workshop. Join solicitors from multiple firms for group training session.',
    metadata: {
      app: 'legalnote-ai',
      type: 'service',
      category: 'training',
    },
  });

  await stripe.prices.create({
    product: openWorkshop.id,
    unit_amount: 25000, // £250.00 in pence
    currency: 'gbp',
    metadata: {
      type: 'service',
      category: 'training',
    },
  });

  console.log(`  Created: ${openWorkshop.name} - £250`);

  // 8. Advisory Retainer (recurring monthly)
  console.log('Creating Advisory Retainer...');
  const advisoryRetainer = await stripe.products.create({
    name: 'Legal Ops Advisory Retainer',
    description: 'Monthly advisory support. Includes monthly strategy call, email/messaging support, quarterly workflow review, and priority feature access.',
    metadata: {
      app: 'legalnote-ai',
      type: 'service',
      category: 'retainer',
    },
  });

  // Standard retainer - £500/month
  await stripe.prices.create({
    product: advisoryRetainer.id,
    unit_amount: 50000, // £500.00 in pence
    currency: 'gbp',
    recurring: { interval: 'month' },
    metadata: {
      type: 'service',
      category: 'retainer',
      tier: 'standard',
    },
  });

  // Premium retainer - £1,000/month
  await stripe.prices.create({
    product: advisoryRetainer.id,
    unit_amount: 100000, // £1,000.00 in pence
    currency: 'gbp',
    recurring: { interval: 'month' },
    metadata: {
      type: 'service',
      category: 'retainer',
      tier: 'premium',
    },
  });

  console.log(`  Created: ${advisoryRetainer.name} - £500-£1,000/month`);

  console.log('\n✓ All service products created successfully!');
  console.log('\nProduct categories created:');
  console.log('  - Implementation packages (one-time): £1,000 - £2,500');
  console.log('  - Consulting sessions (one-time): £500 - £1,500');
  console.log('  - Training workshops (one-time): £250 - £1,000');
  console.log('  - Advisory retainers (recurring): £500 - £1,000/month');
}

createServiceProducts().catch(console.error);
