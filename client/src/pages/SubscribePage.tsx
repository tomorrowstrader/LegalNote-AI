import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Building2,
  Check,
  CreditCard,
  FileText,
  Loader2,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getApiErrorMessage, queryClient } from "@/lib/queryClient";

type BoutiqueBilling = {
  plan: "boutique";
  priceId: string;
  unitAmount: number;
  currency: string;
  interval: string;
  suggestedSeats: number;
  seatUsage: { members: number; pendingInvites: number; used: number; limit: number | null };
  hasPaidAccess: boolean;
  subscriptionStatus: string | null;
  subscriptionSeatQuantity: number | null;
  allowPromotionCodes: boolean;
};

function formatMoney(amountPence: number, currency: string) {
  return (amountPence / 100).toLocaleString("en-GB", {
    style: "currency",
    currency: (currency || "gbp").toUpperCase(),
  });
}

export default function SubscribePage() {
  const { isFirmAdmin, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const search = useSearch();
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const checkoutResult = params.get("checkout");

  const { data: billing, isLoading } = useQuery<BoutiqueBilling>({
    queryKey: ["/api/billing/boutique"],
    enabled: isFirmAdmin,
  });

  const [seatQuantity, setSeatQuantity] = useState(1);
  const [promotionCode, setPromotionCode] = useState("");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [mode, setMode] = useState<"card" | "invoice">("card");

  useEffect(() => {
    if (billing?.suggestedSeats) setSeatQuantity(billing.suggestedSeats);
  }, [billing?.suggestedSeats]);

  useEffect(() => {
    if (checkoutResult === "success") {
      void queryClient.invalidateQueries({ queryKey: ["/api/firm"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/billing/boutique"] });
      toast({
        title: "Subscription started",
        description: "Boutique access will unlock as soon as Stripe confirms payment.",
      });
    }
  }, [checkoutResult, toast]);

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<{ url: string }>("POST", "/api/billing/checkout", {
        seatQuantity,
        promotionCode: promotionCode.trim() || undefined,
      });
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (err) => {
      toast({
        title: "Checkout failed",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    },
  });

  const invoiceMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<{ ok: boolean }>("POST", "/api/billing/invoice-request", {
        seatQuantity,
        notes: invoiceNotes.trim() || undefined,
        promotionCode: promotionCode.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast({
        title: "Invoice request sent",
        description: "We'll reply shortly with payment instructions.",
      });
      setInvoiceNotes("");
    },
    onError: (err) => {
      toast({
        title: "Could not send request",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    },
  });

  if (authLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isFirmAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Building2 className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">Subscribe to Boutique</h1>
        <p className="mt-3 text-muted-foreground">
          Only a firm administrator can start a subscription or request an invoice.
          Ask your firm lead to open this page.
        </p>
        <Button asChild className="mt-6" variant="outline">
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  if (isLoading || !billing) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (billing.hasPaidAccess) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Check className="mx-auto mb-4 h-10 w-10 text-emerald-600" />
        <h1 className="text-2xl font-semibold tracking-tight">Boutique is active</h1>
        <p className="mt-3 text-muted-foreground">
          Your firm has paid access
          {billing.subscriptionSeatQuantity
            ? ` for ${billing.subscriptionSeatQuantity} seat${billing.subscriptionSeatQuantity === 1 ? "" : "s"}`
            : ""}
          .
        </p>
        <Button asChild className="mt-6">
          <Link href="/">Continue to dashboard</Link>
        </Button>
      </div>
    );
  }

  const unitLabel = formatMoney(billing.unitAmount, billing.currency);
  const monthlyTotal = formatMoney(billing.unitAmount * seatQuantity, billing.currency);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10" data-testid="page-subscribe">
      <p className="text-sm font-medium text-muted-foreground">LegalNote Boutique</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Continue with your firm</h1>
      <p className="mt-3 text-muted-foreground">
        {unitLabel} per seat / month. Pay by card now, or request an invoice. Promotion codes
        are supported at checkout.
      </p>

      <div className="mt-8 space-y-6 border-t border-border pt-8">
        <div className="space-y-2">
          <Label htmlFor="seats">Number of seats</Label>
          <Input
            id="seats"
            type="number"
            min={1}
            max={500}
            value={seatQuantity}
            onChange={(e) => setSeatQuantity(Math.max(1, Number(e.target.value) || 1))}
            data-testid="input-seat-quantity"
          />
          <p className="text-xs text-muted-foreground">
            Currently {billing.seatUsage.used} active
            {billing.seatUsage.pendingInvites
              ? ` (+${billing.seatUsage.pendingInvites} pending invite${billing.seatUsage.pendingInvites === 1 ? "" : "s"})`
              : ""}
            . Estimated total: <span className="font-medium text-foreground">{monthlyTotal}/month</span>
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="promo">
            <span className="inline-flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              Promotion code (optional)
            </span>
          </Label>
          <Input
            id="promo"
            placeholder="e.g. PARTNER20"
            value={promotionCode}
            onChange={(e) => setPromotionCode(e.target.value.toUpperCase())}
            data-testid="input-promotion-code"
          />
          <p className="text-xs text-muted-foreground">
            Leave blank to enter a code on the Stripe checkout page instead.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={mode === "card" ? "default" : "outline"}
            onClick={() => setMode("card")}
            data-testid="button-mode-card"
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Pay by card
          </Button>
          <Button
            type="button"
            variant={mode === "invoice" ? "default" : "outline"}
            onClick={() => setMode("invoice")}
            data-testid="button-mode-invoice"
          >
            <FileText className="mr-2 h-4 w-4" />
            Contact us for invoice
          </Button>
        </div>

        {mode === "card" ? (
          <div className="space-y-4">
            <ul className="space-y-2 text-sm text-muted-foreground">
              {[
                "No second trial — billing starts when you subscribe",
                "Coupon field available on Stripe Checkout",
                "Full write access restores for the whole firm on payment",
              ].map((line) => (
                <li key={line} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <Button
              className="w-full sm:w-auto"
              disabled={checkoutMutation.isPending}
              onClick={() => checkoutMutation.mutate()}
              data-testid="button-checkout-card"
            >
              {checkoutMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirecting…
                </>
              ) : (
                `Subscribe — ${monthlyTotal}/month`
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invoice-notes">Anything we should know? (optional)</Label>
              <Textarea
                id="invoice-notes"
                rows={3}
                value={invoiceNotes}
                onChange={(e) => setInvoiceNotes(e.target.value)}
                placeholder="Purchase order number, billing contact, preferred payment terms…"
                data-testid="input-invoice-notes"
              />
            </div>
            <Button
              className="w-full sm:w-auto"
              disabled={invoiceMutation.isPending}
              onClick={() => invoiceMutation.mutate()}
              data-testid="button-request-invoice"
            >
              {invoiceMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                "Request invoice"
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              We&apos;ll email jazz.dennis@legalnote.ai and support with your seat count and
              contact details.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
