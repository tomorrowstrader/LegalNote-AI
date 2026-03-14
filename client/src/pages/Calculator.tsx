import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Shield, Clock, FileCheck, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SecondaryPageHeader } from "@/components/SecondaryPageHeader";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EarlyAccessForm } from "@/components/EarlyAccessForm";

export default function Calculator() {
  const [isEarlyAccessOpen, setIsEarlyAccessOpen] = useState(false);
  const [hourlyRate, setHourlyRate] = useState(200);
  const [adminHoursPerWeek, setAdminHoursPerWeek] = useState(8);
  const [meetingsPerWeek, setMeetingsPerWeek] = useState(6);

  const LEGALNOTE_MONTHLY_COST = 199;
  const EFFICIENCY_GAIN = 0.7;

  const hoursRecoveredPerWeek = adminHoursPerWeek * EFFICIENCY_GAIN;
  const hoursRecoveredPerYear = hoursRecoveredPerWeek * 48;
  const revenueRecoveredPerYear = hoursRecoveredPerYear * hourlyRate;
  const revenueRecoveredPerMonth = revenueRecoveredPerYear / 12;
  const annualCost = LEGALNOTE_MONTHLY_COST * 12;
  const netBenefit = revenueRecoveredPerYear - annualCost;
  const roi = ((revenueRecoveredPerYear - annualCost) / annualCost) * 100;
  const paybackDays = Math.ceil((LEGALNOTE_MONTHLY_COST / (revenueRecoveredPerMonth)) * 30);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  };

  const [showPaybackDays, setShowPaybackDays] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <SecondaryPageHeader />

      <main className="max-w-6xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <Badge variant="secondary" className="mb-4">
            <Shield className="h-3 w-3 mr-1" />
            Practice Protection Calculator
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            What's Incomplete Documentation Costing Your Practice?
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Professional indemnity claims often stem from inadequate file notes. 
            Calculate the value of consistent, defensible documentation across every client meeting.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card>
              <CardHeader className="pb-8">
                <CardTitle className="flex items-center gap-2 mb-3">
                  <FileCheck className="h-5 w-5 text-primary" />
                  Your Documentation Profile
                </CardTitle>
                <CardDescription>
                  Adjust the sliders to reflect your current practice
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="space-y-4">
                  <div className="flex justify-between items-center gap-4">
                    <Label htmlFor="hourly-rate" className="text-base flex-shrink-0">Your Hourly Rate</Label>
                    <span className="text-2xl font-bold text-primary flex-shrink-0" data-testid="text-hourly-rate">{formatCurrency(hourlyRate)}</span>
                  </div>
                  <Slider
                    id="hourly-rate"
                    min={100}
                    max={500}
                    step={25}
                    value={[hourlyRate]}
                    onValueChange={(value) => setHourlyRate(value[0])}
                    data-testid="slider-hourly-rate"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>£100</span>
                    <span>£500</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center gap-4">
                    <Label htmlFor="admin-hours" className="text-base">Weekly Documentation Hours</Label>
                    <span className="text-2xl font-bold text-primary flex-shrink-0" data-testid="text-admin-hours">{adminHoursPerWeek}h</span>
                  </div>
                  <Slider
                    id="admin-hours"
                    min={2}
                    max={25}
                    step={1}
                    value={[adminHoursPerWeek]}
                    onValueChange={(value) => setAdminHoursPerWeek(value[0])}
                    data-testid="slider-admin-hours"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>2 hours</span>
                    <span>25 hours</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center gap-4">
                    <Label htmlFor="meetings" className="text-base">Meetings per Week</Label>
                    <span className="text-2xl font-bold text-primary flex-shrink-0" data-testid="text-meetings">{meetingsPerWeek}</span>
                  </div>
                  <Slider
                    id="meetings"
                    min={1}
                    max={20}
                    step={1}
                    value={[meetingsPerWeek]}
                    onValueChange={(value) => setMeetingsPerWeek(value[0])}
                    data-testid="slider-meetings"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1 meeting</span>
                    <span>20 meetings</span>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    LegalNote ensures every client meeting is properly documented with verbatim transcripts, 
                    structured attendance notes, and a complete audit trail, reducing <strong>70%</strong> of manual documentation effort.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="space-y-6"
          >
            <Card className="border-primary/50 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Documentation Value
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-background rounded-lg p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Hours Reallocated/Year</p>
                    <p className="text-3xl font-bold text-primary" data-testid="text-hours-recovered">{Math.round(hoursRecoveredPerYear)}</p>
                  </div>
                  <div className="bg-background rounded-lg p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Billable Capacity</p>
                    <p className="text-3xl font-bold text-amber-700 dark:text-amber-400" data-testid="text-revenue-recovered">{formatCurrency(revenueRecoveredPerYear)}</p>
                  </div>
                </div>

                <div className="bg-background rounded-lg p-6 text-center relative overflow-hidden">
                  <AnimatePresence mode="wait">
                    {!showPaybackDays ? (
                      <motion.div
                        key="cta"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="py-4"
                      >
                        <p className="text-sm text-muted-foreground mb-4">See the investment perspective</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setShowPaybackDays(true)}
                          data-testid="button-reveal-investment"
                        >
                          View Investment Details
                        </Button>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="result"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="py-2"
                      >
                        <p className="text-sm text-muted-foreground mb-2">Investment Recovery Period</p>
                        <p className="text-5xl font-bold text-primary mb-1" data-testid="text-payback-days">{paybackDays}</p>
                        <p className="text-lg text-muted-foreground">days</p>
                        <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wider font-medium opacity-50">
                          Based on £199/mo early adopter rate
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Annual Investment</span>
                    <span className="font-semibold">{showPaybackDays ? formatCurrency(annualCost) : "••••"}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Net Annual Value</span>
                    <span className="font-semibold text-amber-700 dark:text-amber-400" data-testid="text-net-benefit">
                      {showPaybackDays ? formatCurrency(netBenefit) : "••••"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground">Return on Investment</span>
                    <span className="font-bold text-xl text-primary" data-testid="text-roi">
                      {showPaybackDays ? `${Math.round(roi)}%` : "••••"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-4 font-medium">Beyond the Numbers</p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">Verbatim transcripts with speaker attribution for every meeting</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">Structured attendance notes ready for your review and sign-off</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">Tamper-evident audit trail with cryptographic verification</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">Documented consent workflow aligned with SRA requirements</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button 
              size="lg" 
              className="w-full" 
              data-testid="button-apply-access"
              onClick={() => setIsEarlyAccessOpen(true)}
            >
              Apply for Early Access
            </Button>

            <Dialog open={isEarlyAccessOpen} onOpenChange={setIsEarlyAccessOpen}>
              <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none bg-transparent">
                <DialogHeader className="sr-only">
                  <DialogTitle>Request Early Access</DialogTitle>
                  <DialogDescription>
                    Join our exclusive waitlist for LegalNote.
                  </DialogDescription>
                </DialogHeader>
                <EarlyAccessForm onSuccess={() => setIsEarlyAccessOpen(false)} />
              </DialogContent>
            </Dialog>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-16 text-center"
        >
          <Card className="max-w-3xl mx-auto">
            <CardContent className="pt-6">
              <p className="text-lg italic text-muted-foreground mb-4">
                "The best defence against a PI claim isn't luck. It's a complete file. 
                LegalNote ensures every client interaction is properly documented before you leave the room."
              </p>
              <p className="text-sm font-medium">Compliance-First Documentation</p>
            </CardContent>
          </Card>
        </motion.div>
      </main>

      <footer className="border-t mt-16 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>LegalNote Ltd. Registered in England and Wales.</p>
          <p className="mt-1">71-75 Shelton Street, Covent Garden, London, WC2H 9JQ</p>
        </div>
      </footer>
    </div>
  );
}
