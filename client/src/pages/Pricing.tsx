import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Check, 
  Shield, 
  Users, 
  Building2, 
  Sparkles, 
  Clock, 
  FileText, 
  Calendar,
  Lock,
  Headphones,
  BarChart3,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PricingTier {
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  priceUnit: string;
  bundledHours: number;
  overageRate: number;
  features: string[];
  highlighted?: boolean;
  icon: typeof Users;
  badge?: string;
}

const pricingTiers: PricingTier[] = [
  {
    name: "Solo",
    description: "Perfect for individual solicitors and sole practitioners",
    monthlyPrice: 79,
    annualPrice: 69,
    priceUnit: "/month",
    bundledHours: 25,
    overageRate: 3,
    icon: Users,
    features: [
      "Unlimited recordings & transcriptions",
      "25 hours bundled monthly",
      "Attendance notes & matter records",
      "Obligation extraction",
      "Client consent management",
      "Secure document sharing",
      "Calendar integration",
      "GDPR compliance tools",
      "Cryptographic audit trail",
      "Email support"
    ]
  },
  {
    name: "Boutique",
    description: "For growing firms with 3-9 fee earners",
    monthlyPrice: 199,
    annualPrice: 179,
    priceUnit: "/user/month",
    bundledHours: 20,
    overageRate: 2.5,
    icon: Building2,
    highlighted: true,
    badge: "Most Popular",
    features: [
      "Everything in Solo, plus:",
      "20 hours bundled per user",
      "Multi-user access",
      "Team collaboration",
      "Case assignment & workflows",
      "Admin dashboard",
      "Usage analytics",
      "Practice management integration",
      "Priority support",
      "Quarterly compliance review"
    ]
  },
  {
    name: "Firm",
    description: "Enterprise features for 10+ users",
    monthlyPrice: 45,
    annualPrice: 39,
    priceUnit: "/user/month",
    bundledHours: 25,
    overageRate: 2,
    icon: Shield,
    features: [
      "Everything in Boutique, plus:",
      "25 hours bundled per user",
      "Volume pricing",
      "Custom onboarding",
      "Dedicated account manager",
      "SLA guarantee",
      "API access",
      "SSO integration",
      "Custom retention policies",
      "White-glove support"
    ]
  }
];

const compliancePackFeatures = [
  "COLP self-audit checklist completion",
  "DPIA template customised to your firm",
  "Data usage policy template",
  "Insurer-facing documentation pack",
  "Staff training materials",
  "White-glove platform setup",
  "90-day implementation support"
];

export default function Pricing() {
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4" data-testid="badge-pricing-hero">
            <Sparkles className="w-3 h-3 mr-1" />
            Transparent Pricing
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight mb-4" data-testid="text-pricing-title">
            Compliance-First Documentation
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Professional legal documentation that pays for itself. Reduce PI risk, satisfy SRA requirements, 
            and save hours on every client meeting.
          </p>
          
          <div className="flex items-center justify-center gap-3 mb-8">
            <Label htmlFor="billing-toggle" className={cn(!isAnnual && "text-foreground", isAnnual && "text-muted-foreground")}>
              Monthly
            </Label>
            <Switch
              id="billing-toggle"
              checked={isAnnual}
              onCheckedChange={setIsAnnual}
              data-testid="switch-billing-toggle"
            />
            <Label htmlFor="billing-toggle" className={cn(isAnnual && "text-foreground", !isAnnual && "text-muted-foreground")}>
              Annual
            </Label>
            {isAnnual && (
              <Badge variant="outline" className="ml-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                Save up to 15%
              </Badge>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {pricingTiers.map((tier, index) => {
            const price = isAnnual ? tier.annualPrice : tier.monthlyPrice;
            const Icon = tier.icon;
            
            return (
              <Card 
                key={tier.name}
                className={cn(
                  "relative flex flex-col",
                  tier.highlighted && "border-primary shadow-lg scale-105"
                )}
                data-testid={`card-pricing-${tier.name.toLowerCase()}`}
              >
                {tier.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      {tier.badge}
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{tier.name}</CardTitle>
                  </div>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">£{price}</span>
                      <span className="text-muted-foreground">{tier.priceUnit}</span>
                    </div>
                    {isAnnual && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Billed annually (save £{(tier.monthlyPrice - tier.annualPrice) * 12}{tier.priceUnit.includes("user") ? "/user" : ""})
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 mb-6">
                    <Clock className="w-4 h-4 text-primary" />
                    <div className="text-sm">
                      <span className="font-medium">{tier.bundledHours} hours</span>
                      <span className="text-muted-foreground"> bundled{tier.priceUnit.includes("user") ? "/user" : ""}</span>
                      <span className="text-muted-foreground"> • £{tier.overageRate}/hr overage</span>
                    </div>
                  </div>
                  
                  <ul className="space-y-3">
                    {tier.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full" 
                    variant={tier.highlighted ? "default" : "outline"}
                    data-testid={`button-select-${tier.name.toLowerCase()}`}
                  >
                    Get Started
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <Card className="mb-16 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20" data-testid="card-compliance-pack">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/20">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">Compliance & Risk Pack</CardTitle>
                <CardDescription className="text-base">
                  One-time add-on for firms serious about risk infrastructure
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-4xl font-bold">£750</span>
                  <span className="text-muted-foreground">one-time</span>
                </div>
                <p className="text-muted-foreground mb-6">
                  Position your firm for reduced PI premiums and streamlined SRA inquiries. 
                  Everything you need to demonstrate compliance maturity to insurers and regulators.
                </p>
                <Button size="lg" data-testid="button-compliance-pack">
                  Add Compliance Pack
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
              <div>
                <ul className="space-y-3">
                  {compliancePackFeatures.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold mb-4">Why Solicitors Choose LegalNote</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
            Built specifically for UK legal practice with compliance at the core
          </p>
        </div>
        
        <div className="grid md:grid-cols-4 gap-6 mb-16">
          {[
            { icon: Lock, title: "GDPR Compliant", description: "7-day audio retention, right to erasure, consent tracking" },
            { icon: FileText, title: "SRA Ready", description: "Audit trails for every action, contemporaneous documentation" },
            { icon: BarChart3, title: "PI Risk Reduction", description: "Evidence-quality notes that protect against claims" },
            { icon: Headphones, title: "UK Support", description: "Priority support from legal tech specialists" }
          ].map((item, index) => (
            <Card key={index} className="text-center" data-testid={`card-feature-${index}`}>
              <CardContent className="pt-6">
                <div className="inline-flex p-3 rounded-xl bg-primary/10 mb-4">
                  <item.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="text-center" data-testid="card-cta">
          <CardContent className="py-12">
            <h2 className="text-2xl font-bold mb-4">Ready to transform your practice?</h2>
            <p className="text-muted-foreground max-w-xl mx-auto mb-6">
              Start your 14-day free trial. No credit card required. 
              See how LegalNote can save you hours on every client meeting.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Button size="lg" data-testid="button-start-trial">
                Start Free Trial
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button size="lg" variant="outline" data-testid="button-book-demo">
                Book a Demo
                <Calendar className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
