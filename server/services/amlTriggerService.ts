import OpenAI from "openai";

const AML_TRIGGER_PATTERNS = [
  { pattern: /\bcash\s+payment/i, category: "source_of_funds", label: "Cash payment mentioned" },
  { pattern: /\bcash\b/i, category: "source_of_funds", label: "Cash reference" },
  { pattern: /\bsource\s+of\s+funds?\b/i, category: "source_of_funds", label: "Source of funds discussed" },
  { pattern: /\bsource\s+of\s+wealth\b/i, category: "source_of_funds", label: "Source of wealth discussed" },
  { pattern: /\bpolitically\s+exposed\b/i, category: "pep", label: "Politically exposed person reference" },
  { pattern: /\bPEP\b/i, category: "pep", label: "PEP reference" },
  { pattern: /\bsanctions?\b/i, category: "sanctions", label: "Sanctions reference" },
  { pattern: /\bbeneficial\s+owner/i, category: "beneficial_ownership", label: "Beneficial ownership discussed" },
  { pattern: /\bUBO\b/i, category: "beneficial_ownership", label: "UBO reference" },
  { pattern: /\bshell\s+compan/i, category: "corporate_structure", label: "Shell company reference" },
  { pattern: /\boffshore\b/i, category: "jurisdiction", label: "Offshore reference" },
  { pattern: /\btax\s+haven/i, category: "jurisdiction", label: "Tax haven reference" },
  { pattern: /\bhigh[\s-]?risk\s+(jurisdiction|countr)/i, category: "jurisdiction", label: "High-risk jurisdiction" },
  { pattern: /\bthird[\s-]?party\s+fund/i, category: "source_of_funds", label: "Third-party funding" },
  { pattern: /\bstructur(ed|ing)\s+(transaction|payment)/i, category: "structuring", label: "Structured transaction" },
  { pattern: /\bmoney\s+launder/i, category: "aml_direct", label: "Money laundering reference" },
  { pattern: /\bdue\s+diligence\b/i, category: "cdd", label: "Due diligence discussed" },
  { pattern: /\bCDD\b/i, category: "cdd", label: "CDD reference" },
  { pattern: /\bEDD\b/i, category: "edd", label: "Enhanced due diligence reference" },
  { pattern: /\benhanced\s+due\s+diligence\b/i, category: "edd", label: "Enhanced due diligence discussed" },
  { pattern: /\bsuspicious\s+activit/i, category: "sar", label: "Suspicious activity reference" },
  { pattern: /\bSAR\b/i, category: "sar", label: "SAR reference" },
  { pattern: /\bcryptocurrenc/i, category: "source_of_funds", label: "Cryptocurrency reference" },
  { pattern: /\bcrypto\s+asset/i, category: "source_of_funds", label: "Crypto asset reference" },
  { pattern: /\binheritance\b/i, category: "source_of_funds", label: "Inheritance reference" },
  { pattern: /\blottery\b/i, category: "source_of_funds", label: "Lottery winnings reference" },
  { pattern: /\bgift(?:ed)?\s+(?:funds?|money|deposit)/i, category: "source_of_funds", label: "Gifted funds reference" },
];

export interface AmlTrigger {
  pattern: string;
  category: string;
  label: string;
  excerpt: string;
}

export function detectAmlTriggers(text: string): AmlTrigger[] {
  if (!text || text.trim().length === 0) return [];

  const triggers: AmlTrigger[] = [];
  const seenLabels = new Set<string>();

  for (const { pattern, category, label } of AML_TRIGGER_PATTERNS) {
    const match = pattern.exec(text);
    if (match && !seenLabels.has(label)) {
      seenLabels.add(label);
      const start = Math.max(0, match.index - 60);
      const end = Math.min(text.length, match.index + match[0].length + 60);
      const excerpt = (start > 0 ? "..." : "") + text.slice(start, end).trim() + (end < text.length ? "..." : "");
      triggers.push({
        pattern: pattern.source,
        category,
        label,
        excerpt,
      });
    }
  }

  return triggers;
}

export async function detectAmlTriggersAI(text: string): Promise<AmlTrigger[]> {
  if (!text || text.trim().length === 0) return [];

  const regexTriggers = detectAmlTriggers(text);

  try {
    const openai = new OpenAI();
    const truncated = text.length > 8000 ? text.slice(0, 8000) + "..." : text;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      max_tokens: 1000,
      messages: [
        {
          role: "system",
          content: `You are a UK AML compliance analyst reviewing legal meeting transcripts for potential money laundering, terrorist financing, and regulatory compliance indicators.

Analyse the transcript and identify AML-relevant triggers in these categories:
- source_of_funds: Unexplained wealth, unusual transaction patterns, cash-heavy dealings, gifted deposits
- pep: Politically exposed persons, government officials, diplomatic connections
- sanctions: Sanctioned individuals, entities, or jurisdictions
- beneficial_ownership: Complex ownership structures, nominees, trusts hiding UBOs
- corporate_structure: Shell companies, layering through multiple entities
- jurisdiction: High-risk countries (FATF grey/black list), offshore jurisdictions
- structuring: Transaction splitting, threshold avoidance
- aml_direct: Explicit ML/TF references
- edd: Enhanced due diligence triggers
- sar: Suspicious activity indicators
- unusual_instructions: Rush transactions, reluctance to provide information, changed instructions, unusual complexity
- value_changes: Sudden property value changes, unexplained price adjustments, below-market transactions

Return a JSON array of objects with: category, label (short description), excerpt (relevant text snippet, max 120 chars).
Return [] if no AML triggers found. Only return genuine compliance concerns, not routine legal discussions.`
        },
        {
          role: "user",
          content: truncated
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return regexTriggers;

    const parsed = JSON.parse(content);
    const aiTriggers: AmlTrigger[] = (parsed.triggers || parsed || [])
      .filter((t: any) => t.category && t.label)
      .map((t: any) => ({
        pattern: "ai_analysis",
        category: t.category,
        label: t.label,
        excerpt: t.excerpt || "",
      }));

    const merged = [...regexTriggers];
    const existingLabels = new Set(regexTriggers.map(t => t.label.toLowerCase()));
    for (const aiTrigger of aiTriggers) {
      if (!existingLabels.has(aiTrigger.label.toLowerCase())) {
        merged.push(aiTrigger);
        existingLabels.add(aiTrigger.label.toLowerCase());
      }
    }

    console.log(`[AML-AI] Found ${aiTriggers.length} AI triggers, ${regexTriggers.length} regex triggers, ${merged.length} merged total`);
    return merged;
  } catch (error) {
    console.error("[AML-AI] AI trigger detection failed, falling back to regex:", error);
    return regexTriggers;
  }
}

export function getAmlRiskSuggestion(triggers: AmlTrigger[]): "low" | "medium" | "high" | null {
  if (triggers.length === 0) return null;

  const categories = new Set(triggers.map(t => t.category));

  if (categories.has("sar") || categories.has("aml_direct") || categories.has("structuring")) {
    return "high";
  }

  if (categories.has("pep") || categories.has("sanctions") || categories.has("jurisdiction") || categories.has("edd")) {
    return "high";
  }

  if (categories.has("unusual_instructions") || categories.has("value_changes")) {
    return "medium";
  }

  if (categories.has("beneficial_ownership") || categories.has("corporate_structure") || categories.size >= 3) {
    return "medium";
  }

  return "low";
}
