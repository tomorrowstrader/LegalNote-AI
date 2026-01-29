import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calculator as CalculatorIcon, Clock, PoundSterling, TrendingUp, Calendar, CheckCircle2, Moon, Sun } from "lucide-react";
import Logo from "@/components/Logo";
import { motion } from "framer-motion";

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const initialTheme = savedTheme || "light";
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  return { theme, toggleTheme };
}

export default function Calculator() {
  const { theme, toggleTheme } = useTheme();
  
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <Logo size="sm" />
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              data-testid="button-theme-toggle"
            >
              {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
            <Link href="/">
              <Button variant="outline" size="sm" data-testid="button-back-home">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <Badge variant="secondary" className="mb-4">
            <CalculatorIcon className="h-3 w-3 mr-1" />
            ROI Calculator
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            What's Your Documentation Costing You?
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Most solicitors spend 15-20 hours per week on administrative tasks that could be automated. 
            Calculate how much billable time you could recover.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Your Practice
                </CardTitle>
                <CardDescription>
                  Adjust the sliders to match your current workload
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="hourly-rate" className="text-base">Your Hourly Rate</Label>
                    <span className="text-2xl font-bold text-primary" data-testid="text-hourly-rate">{formatCurrency(hourlyRate)}</span>
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
                  <div className="flex justify-between items-center">
                    <Label htmlFor="admin-hours" className="text-base">Hours on Admin/Documentation per Week</Label>
                    <span className="text-2xl font-bold text-primary" data-testid="text-admin-hours">{adminHoursPerWeek}h</span>
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
                  <div className="flex justify-between items-center">
                    <Label htmlFor="meetings" className="text-base">Client Meetings per Week</Label>
                    <span className="text-2xl font-bold text-primary" data-testid="text-meetings">{meetingsPerWeek}</span>
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
                    Based on our data, LegalNote users recover approximately <strong>70%</strong> of their 
                    documentation time through automated transcription and AI-generated attendance notes.
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
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Your Potential Return
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-background rounded-lg p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Hours Recovered/Year</p>
                    <p className="text-3xl font-bold text-primary" data-testid="text-hours-recovered">{Math.round(hoursRecoveredPerYear)}</p>
                  </div>
                  <div className="bg-background rounded-lg p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Billable Value</p>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400" data-testid="text-revenue-recovered">{formatCurrency(revenueRecoveredPerYear)}</p>
                  </div>
                </div>

                <div className="bg-background rounded-lg p-6 text-center">
                  <p className="text-sm text-muted-foreground mb-2">LegalNote Pays for Itself in</p>
                  <p className="text-5xl font-bold text-primary mb-1" data-testid="text-payback-days">{paybackDays}</p>
                  <p className="text-lg text-muted-foreground">days</p>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">LegalNote Annual Cost</span>
                    <span className="font-semibold">{formatCurrency(annualCost)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Net Annual Benefit</span>
                    <span className="font-semibold text-green-600 dark:text-green-400" data-testid="text-net-benefit">{formatCurrency(netBenefit)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground">Return on Investment</span>
                    <span className="font-bold text-xl text-primary" data-testid="text-roi">{Math.round(roi)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">Automatic transcription with speaker identification</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">AI-generated attendance notes in your firm's style</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">Comprehensive audit trail for compliance</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">GDPR-compliant consent management</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Link href="/">
              <Button size="lg" className="w-full" data-testid="button-apply-access">
                Apply for Early Access
              </Button>
            </Link>
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
                "Every case is different, but 80% of the process behind it isn't. 
                Systematise the repetition so you can focus on the legal work that actually matters."
              </p>
              <p className="text-sm font-medium">The LegalNote Philosophy</p>
            </CardContent>
          </Card>
        </motion.div>
      </main>

      <footer className="border-t mt-16 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>LegalNote AI Ltd. Registered in England and Wales.</p>
          <p className="mt-1">71-75 Shelton Street, Covent Garden, London, WC2H 9JQ</p>
        </div>
      </footer>
    </div>
  );
}
