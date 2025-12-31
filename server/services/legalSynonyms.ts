/**
 * UK Legal Synonyms Dictionary for Search Enhancement
 * 
 * Maps common legal terms to their synonyms and related terms
 * to improve search results when solicitors use different terminology.
 */

export const LEGAL_SYNONYMS: Record<string, string[]> = {
  // Property/Conveyancing
  'completion': ['settlement', 'closing', 'exchange'],
  'settlement': ['completion', 'closing', 'exchange'],
  'conveyancing': ['property transfer', 'real estate', 'house purchase', 'house sale'],
  'mortgage': ['loan', 'charge', 'secured lending', 'home loan'],
  'freehold': ['fee simple', 'absolute ownership'],
  'leasehold': ['lease', 'tenancy', 'term of years'],
  'searches': ['enquiries', 'due diligence'],
  'title': ['ownership', 'deed', 'property rights'],
  'exchange': ['contract exchange', 'exchanging contracts'],
  'deposit': ['down payment', 'earnest money'],
  'stamp duty': ['SDLT', 'land tax', 'transfer tax'],
  
  // Legal professionals
  'solicitor': ['lawyer', 'attorney', 'legal advisor', 'counsel'],
  'lawyer': ['solicitor', 'attorney', 'legal advisor', 'counsel'],
  'barrister': ['counsel', 'advocate', 'QC', 'KC'],
  'counsel': ['barrister', 'advocate', 'QC', 'KC'],
  'client': ['customer', 'instructing party', 'matter party'],
  
  // Court proceedings
  'claimant': ['plaintiff', 'applicant', 'petitioner'],
  'defendant': ['respondent', 'accused'],
  'respondent': ['defendant', 'opposing party'],
  'trial': ['hearing', 'court case', 'proceedings'],
  'hearing': ['trial', 'court appearance', 'proceedings'],
  'judgment': ['ruling', 'decision', 'order', 'verdict'],
  'verdict': ['judgment', 'decision', 'finding'],
  'appeal': ['challenge', 'review'],
  'injunction': ['order', 'restraining order', 'prohibition'],
  
  // Documents
  'contract': ['agreement', 'deed', 'arrangement'],
  'agreement': ['contract', 'arrangement', 'understanding'],
  'deed': ['document', 'instrument', 'conveyance'],
  'will': ['testament', 'last will', 'testamentary document'],
  'power of attorney': ['POA', 'LPA', 'lasting power of attorney'],
  'LPA': ['power of attorney', 'lasting power of attorney'],
  
  // Employment
  'dismissal': ['termination', 'sacking', 'firing', 'redundancy'],
  'redundancy': ['layoff', 'dismissal', 'termination'],
  'employment': ['job', 'work', 'position', 'role'],
  'employer': ['company', 'business', 'firm', 'organisation'],
  'employee': ['worker', 'staff member', 'team member'],
  'grievance': ['complaint', 'dispute', 'issue'],
  'tribunal': ['employment tribunal', 'ET', 'court'],
  
  // Family law
  'divorce': ['dissolution', 'separation', 'split'],
  'matrimonial': ['marital', 'marriage', 'spousal'],
  'custody': ['residence', 'child arrangements', 'living arrangements'],
  'maintenance': ['alimony', 'spousal support', 'child support'],
  'contact': ['access', 'visitation', 'time with'],
  
  // Financial
  'fee': ['cost', 'charge', 'price', 'payment'],
  'costs': ['fees', 'expenses', 'charges'],
  'damages': ['compensation', 'award', 'payout'],
  'settlement': ['agreement', 'resolution', 'compromise'],
  
  // Actions
  'instruct': ['engage', 'appoint', 'retain', 'hire'],
  'advise': ['counsel', 'recommend', 'suggest', 'inform'],
  'negotiate': ['discuss', 'bargain', 'mediate'],
  'litigate': ['sue', 'take to court', 'prosecute'],
  'sue': ['litigate', 'take legal action', 'bring proceedings'],
  
  // Time-related
  'deadline': ['due date', 'time limit', 'cut-off'],
  'limitation': ['time bar', 'deadline', 'limitation period'],
  
  // Compliance/Regulatory
  'GDPR': ['data protection', 'privacy', 'DPA'],
  'SRA': ['Solicitors Regulation Authority', 'regulator'],
  'AML': ['anti-money laundering', 'money laundering checks'],
  'KYC': ['know your client', 'client verification', 'ID check'],
  'consent': ['permission', 'agreement', 'authorisation'],
  
  // Criminal
  'arrest': ['detention', 'apprehension'],
  'charge': ['accusation', 'indictment', 'prosecution'],
  'bail': ['release', 'bond'],
  'sentence': ['punishment', 'penalty', 'prison term'],
  'conviction': ['guilty verdict', 'finding of guilt'],
  'acquittal': ['not guilty', 'discharge'],
};

/**
 * Expands a search query with synonyms
 * Returns the original terms plus any synonyms found
 */
export function expandSearchWithSynonyms(query: string): string[] {
  const words = query.toLowerCase().trim().split(/\s+/);
  const expandedTerms = new Set<string>([query.toLowerCase().trim()]);
  
  // Check single words
  for (const word of words) {
    if (LEGAL_SYNONYMS[word]) {
      for (const synonym of LEGAL_SYNONYMS[word]) {
        expandedTerms.add(synonym.toLowerCase());
      }
    }
  }
  
  // Check multi-word phrases (2-3 word combinations)
  const queryLower = query.toLowerCase().trim();
  for (const [term, synonyms] of Object.entries(LEGAL_SYNONYMS)) {
    if (queryLower.includes(term.toLowerCase())) {
      for (const synonym of synonyms) {
        expandedTerms.add(synonym.toLowerCase());
      }
    }
  }
  
  return Array.from(expandedTerms);
}

/**
 * Gets synonyms for a specific term
 */
export function getSynonyms(term: string): string[] {
  const lowerTerm = term.toLowerCase().trim();
  return LEGAL_SYNONYMS[lowerTerm] || [];
}

/**
 * Checks if two terms are synonymous
 */
export function areSynonyms(term1: string, term2: string): boolean {
  const lower1 = term1.toLowerCase().trim();
  const lower2 = term2.toLowerCase().trim();
  
  if (lower1 === lower2) return true;
  
  const synonyms1 = LEGAL_SYNONYMS[lower1] || [];
  const synonyms2 = LEGAL_SYNONYMS[lower2] || [];
  
  return synonyms1.includes(lower2) || synonyms2.includes(lower1);
}
