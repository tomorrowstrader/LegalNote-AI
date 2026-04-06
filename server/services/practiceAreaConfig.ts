import type { PracticeArea } from "@shared/schema";

export const PRACTICE_AREA_WORD_BOOST: Record<PracticeArea, string[]> = {
  residential_conveyancing: [
    'conveyancing', 'completion', 'exchange', 'contracts',
    'Land Registry', 'title deeds', 'title register',
    'freehold', 'leasehold', 'commonhold',
    'SDLT', 'Stamp Duty Land Tax', 'stamp duty',
    'mortgage', 'mortgage offer', 'redemption',
    'searches', 'local authority search', 'environmental search',
    'drainage search', 'coal mining search',
    'fixtures and fittings', 'property information form',
    'TA6', 'TA7', 'TA10', 'TA13',
    'transfer deed', 'TR1', 'AP1',
    'indemnity insurance', 'title insurance',
    'chain', 'gazumping', 'gazundering',
    'deposit', 'exchange deposit',
    'completion statement', 'completion date',
    'requisitions on title', 'enquiries',
    'restrictive covenant', 'easement', 'right of way',
    'ground rent', 'service charge', 'management company',
    'leasehold reform', 'lease extension',
    'Help to Buy', 'shared ownership',
    'new build', 'NHBC', 'building warranty',
    'chancel repair liability',
    'boundary', 'boundary dispute',
    'planning permission', 'building regulations',
  ],
  commercial_property: [
    'commercial lease', 'lease renewal', 'break clause',
    'dilapidations', 'schedule of dilapidations',
    'rent review', 'open market rent',
    'Landlord and Tenant Act', 'Section 25 notice', 'Section 26 request',
    'business lease', 'FRI lease',
    'alienation', 'assignment', 'subletting',
    'user clause', 'alterations licence',
    'service charge', 'insurance rent',
    'SDLT', 'Stamp Duty Land Tax',
    'Land Registry', 'title register',
    'heads of terms', 'agreement for lease',
    'licence to assign', 'licence to alter',
    'guarantor', 'authorised guarantee agreement', 'AGA',
    'tenant covenant', 'landlord covenant',
    'forfeiture', 'peaceable re-entry',
    'development', 'planning permission',
    'building regulations', 'party wall',
    'environmental', 'contamination',
    'compulsory purchase', 'CPO',
    'option agreement', 'pre-emption',
    'overage', 'clawback',
  ],
  wills_probate: [
    'will', 'codicil', 'testator', 'testatrix',
    'intestacy', 'intestate', 'intestacy rules',
    'probate', 'grant of probate', 'letters of administration',
    'executor', 'executrix', 'administrator',
    'beneficiary', 'residuary estate', 'residue',
    'specific legacy', 'pecuniary legacy', 'demonstrative legacy',
    'IHT', 'Inheritance Tax', 'IHT400', 'IHT205',
    'nil rate band', 'NRB', 'residence nil rate band', 'RNRB',
    'transferable nil rate band', 'TNRB',
    'deed of variation', 'disclaimer',
    'trust', 'discretionary trust', 'life interest trust',
    'IPDI', 'immediate post-death interest',
    'personal representative', 'estate',
    'estate accounts', 'distribution',
    'attestation', 'witness', 'undue influence',
    'testamentary capacity', 'Banks v Goodfellow',
    'contentious probate', 'Inheritance Act claim',
    'Section 4 Inheritance', '1975 Act',
    'lasting power of attorney', 'LPA',
    'Court of Protection', 'deputyship',
    'advance decision', 'living will',
  ],
  lasting_power_of_attorney: [
    'lasting power of attorney', 'LPA',
    'health and welfare LPA', 'property and financial affairs LPA',
    'Office of the Public Guardian', 'OPG',
    'certificate provider', 'donor', 'attorney',
    'replacement attorney', 'named person',
    'mental capacity', 'Mental Capacity Act',
    'best interests', 'deputyship',
    'Court of Protection', 'COP',
    'advance decision', 'advance directive',
    'life-sustaining treatment',
    'joint and several', 'jointly',
    'restrictions', 'conditions', 'guidance',
    'registration', 'LP1F', 'LP1H',
    'LP2', 'LP3', 'LPA002',
    'capacity assessment', 'impaired capacity',
    'undue pressure', 'safeguarding',
    'revocation', 'disclaimer',
    'enduring power of attorney', 'EPA',
  ],
  family_divorce_financial: [
    'divorce', 'dissolution', 'annulment',
    'petition', 'petitioner', 'respondent',
    'conditional order', 'final order',
    'decree nisi', 'decree absolute',
    'financial remedy', 'financial order',
    'Form E', 'Form A', 'Form H', 'Form D81',
    'ancillary relief', 'clean break',
    'maintenance pending suit', 'MPS',
    'spousal maintenance', 'periodical payments',
    'lump sum order', 'property adjustment order',
    'pension sharing order', 'pension attachment',
    'CETV', 'cash equivalent transfer value',
    'matrimonial home', 'Mesher order', 'Martin order',
    'consent order', 'undertaking',
    'FDR', 'first directions appointment', 'FDA',
    'section 25 factors', 'Matrimonial Causes Act',
    'needs', 'contributions', 'conduct',
    'non-disclosure', 'Form E questionnaire',
    'prenuptial agreement', 'postnuptial agreement',
    'cohabitation', 'TOLATA', 'trust of land',
  ],
  family_children_arrangements: [
    'child arrangements order', 'CAO',
    'lives with', 'spends time with',
    'prohibited steps order', 'PSO',
    'specific issue order', 'SIO',
    'CAFCASS', "Children's Guardian", 'family court adviser',
    'Section 7 report', 'Section 37 report',
    'welfare checklist', 'paramountcy principle',
    'Children Act', 'Children Act 1989',
    'parental responsibility', 'PR',
    'special guardianship order', 'SGO',
    'care order', 'supervision order',
    'emergency protection order', 'EPO',
    'non-molestation order', 'occupation order',
    'fact-finding hearing', 'Scott schedule',
    'contact', 'residence',
    'relocation', 'leave to remove',
    'Hague Convention', 'abduction',
    'practice direction 12J', 'PD12J',
    'domestic abuse', 'safeguarding',
    'mediation', 'MIAM',
    'Family Procedure Rules', 'FPR',
  ],
  employment_employee: [
    'unfair dismissal', 'constructive dismissal',
    'wrongful dismissal', 'dismissal',
    'redundancy', 'selection criteria',
    'TUPE', 'Transfer of Undertakings',
    'ACAS', 'early conciliation', 'EC certificate',
    'settlement agreement', 'compromise agreement',
    'ET1', 'ET3', 'employment tribunal',
    'discrimination', 'protected characteristics',
    'Equality Act', 'Equality Act 2010',
    'whistleblowing', 'protected disclosure',
    'Public Interest Disclosure Act',
    'detriment', 'victimisation', 'harassment',
    'notice period', 'garden leave',
    'restrictive covenants', 'non-compete',
    'non-solicitation', 'confidentiality clause',
    'gross misconduct', 'disciplinary procedure',
    'grievance', 'grievance procedure',
    'ACAS Code of Practice',
    'statutory sick pay', 'SSP',
    'maternity', 'paternity', 'shared parental leave',
    'flexible working', 'right to request',
    'minimum wage', 'national living wage',
    'working time regulations', 'WTR',
    'holiday pay', 'unlawful deduction from wages',
  ],
  employment_employer: [
    'employment contract', 'contract of employment',
    'staff handbook', 'company policy',
    'disciplinary procedure', 'disciplinary hearing',
    'grievance procedure', 'investigation',
    'TUPE', 'Transfer of Undertakings',
    'ACAS', 'ACAS Code of Practice',
    'settlement agreement', 'protected conversation',
    'redundancy', 'collective consultation',
    'Section 188', 'Section 189',
    'unfair dismissal', 'fair reason',
    'capability', 'conduct', 'SOSR',
    'some other substantial reason',
    'Equality Act', 'reasonable adjustments',
    'occupational health', 'fit note',
    'restrictive covenants', 'non-compete',
    'garden leave', 'notice period',
    'whistleblowing', 'protected disclosure',
    'data protection', 'monitoring',
    'right to work', 'sponsorship',
    'agency workers', 'IR35',
    'zero hours contract', 'worker status',
    'employment status', 'self-employed',
    'tribunal', 'ET1', 'ET3', 'response',
  ],
  personal_injury_rta: [
    'personal injury', 'PI claim',
    'road traffic accident', 'RTA',
    'whiplash', 'soft tissue injury',
    'Civil Liability Act', 'tariff',
    'OIC', 'Official Injury Claim',
    'medical report', 'medical evidence',
    'prognosis', 'diagnosis',
    'MedCo', 'medical expert',
    'special damages', 'general damages',
    'loss of earnings', 'future loss',
    'care and assistance', 'Ogden tables',
    'multiplier', 'multiplicand',
    'contributory negligence',
    'Part 36 offer', 'settlement',
    'CRU', 'Compensation Recovery Unit',
    'interim payment', 'periodical payment',
    'rehabilitation', 'best practice',
    'liability', 'breach of duty',
    'causation', 'remoteness',
    'hire charges', 'credit hire',
    'protocol', 'pre-action protocol',
    'costs', 'fixed costs', 'QOCS',
    'qualified one-way costs shifting',
    'JSA', 'Judicial Studies Board guidelines',
  ],
  clinical_negligence: [
    'clinical negligence', 'medical negligence',
    'breach of duty', 'duty of care',
    'Bolam test', 'Bolitho', 'Montgomery',
    'informed consent', 'material risk',
    'causation', 'but for test',
    'NHS', 'NHS Resolution',
    'NHSR', 'NHS Trust',
    'duty of candour', 'candour',
    'medical records', 'disclosure',
    'expert evidence', 'medical expert',
    'condition and prognosis',
    'breach report', 'causation report',
    'screening', 'misdiagnosis', 'delayed diagnosis',
    'surgical error', 'wrong site surgery',
    'birth injury', 'cerebral palsy',
    'stillbirth', 'neonatal',
    'fatal claim', 'dependency claim',
    'inquest', 'coroner',
    'Law Reform Act', 'Fatal Accidents Act',
    'bereavement damages',
    'AVMA', 'Action against Medical Accidents',
    'limitation', 'date of knowledge',
    'Section 14', 'Limitation Act',
    'Part 35', 'single joint expert',
  ],
  housing_tenancy: [
    'assured shorthold tenancy', 'AST',
    'assured tenancy', 'regulated tenancy',
    'Section 21 notice', 'Section 8 notice',
    'Renters Reform Bill',
    'eviction', 'possession', 'possession order',
    'notice to quit', 'notice seeking possession',
    'tenant', 'landlord', 'tenancy agreement',
    'deposit', 'deposit protection',
    'DPS', 'deposit protection scheme',
    'TDS', 'MyDeposits', 'DPS scheme',
    'disrepair', 'repair obligation',
    'Section 11', 'Landlord and Tenant Act 1985',
    'housing conditions', 'fitness for habitation',
    'Homes Act', 'Homes Fitness Act',
    'HMO', 'house in multiple occupation',
    'licensing', 'selective licensing',
    'housing benefit', 'universal credit',
    'rent arrears', 'Ground 8',
    'Ground 17', 'succession',
    'right to rent', 'immigration check',
    'service charge', 'leasehold',
    'commonhold', 'enfranchisement',
    'right to buy', 'RTB',
    'housing association', 'social housing',
    'homelessness', 'housing duty',
  ],
  debt_litigation: [
    'debt', 'debtor', 'creditor',
    'county court judgment', 'CCJ',
    'enforcement', 'writ of control',
    'high court enforcement', 'HCEO',
    'bailiff', 'enforcement agent',
    'attachment of earnings',
    'charging order', 'order for sale',
    'third party debt order',
    'insolvency', 'bankruptcy',
    'statutory demand', 'winding up petition',
    'IVA', 'individual voluntary arrangement',
    'DRO', 'debt relief order',
    'breathing space', 'moratorium',
    'Pre-action protocol for debt claims',
    'particulars of claim', 'defence',
    'counterclaim', 'set-off',
    'summary judgment', 'default judgment',
    'mediation', 'ADR',
    'small claims', 'fast track', 'multi-track',
    'allocation', 'directions questionnaire',
    'costs', 'fixed costs',
    'interest', 'statutory interest',
    'Late Payment Act',
    'Consumer Credit Act', 'CCA',
    'unfair relationship', 'Section 140A',
  ],
  criminal_defence: [
    'PACE', 'Police and Criminal Evidence Act',
    'caution', 'interview under caution',
    'appropriate adult', 'duty solicitor',
    'police station', 'custody suite',
    'custody time limits', 'detention',
    'bail', 'conditional bail', 'unconditional bail',
    'remand', 'remand in custody',
    'CPS', 'Crown Prosecution Service',
    'charge', 'indictment',
    'plea', 'guilty plea', 'not guilty plea',
    'basis of plea', 'Newton hearing',
    'sentencing', 'sentencing guidelines',
    'community order', 'suspended sentence',
    'custodial sentence', 'immediate custody',
    'magistrates court', 'Crown Court',
    'summary offence', 'either way offence',
    'indictable offence', 'triable either way',
    'allocation', 'sending',
    'disclosure', 'unused material',
    'CPIA', 'Criminal Procedure and Investigations Act',
    'defence statement', 'defence case statement',
    'prosecution evidence', 'witness',
    'character', 'previous convictions',
    'legal aid', 'representation order',
    'means test', 'interests of justice test',
    'appeal', 'Crown Court appeal',
    'judicial review', 'case stated',
  ],
  immigration: [
    'Home Office', 'UKVI',
    'UK Visas and Immigration',
    'visa', 'entry clearance',
    'leave to remain', 'LTR',
    'indefinite leave to remain', 'ILR',
    'settlement', 'naturalisation',
    'British citizenship', 'registration',
    'points-based system', 'PBS',
    'Skilled Worker visa', 'Tier 2',
    'Global Talent', 'Innovator Founder',
    'Student visa', 'Tier 4',
    'Family visa', 'spouse visa', 'partner visa',
    'parent visa', 'Appendix FM',
    'minimum income requirement', 'MIR',
    'genuineness', 'relationship',
    'sponsor licence', 'certificate of sponsorship', 'CoS',
    'compliance', 'SMS', 'sponsor management system',
    'asylum', 'refugee status',
    'humanitarian protection',
    'First-tier Tribunal Immigration',
    'Upper Tribunal', 'IAC',
    'deportation', 'removal', 'administrative removal',
    'human rights', 'Article 8', 'ECHR',
    'EU Settlement Scheme', 'EUSS',
    'pre-settled status', 'settled status',
    'EEA national', 'right to work',
    'curtailment', 'revocation',
    'judicial review', 'JR',
    'fresh claim', 'further submissions',
  ],
  corporate_commercial: [
    'Companies House', 'company formation',
    'articles of association', 'memorandum',
    'shareholders agreement', 'SHA',
    'share purchase agreement', 'SPA',
    'asset purchase agreement', 'APA',
    'due diligence', 'data room',
    'completion', 'completion accounts',
    'locked box', 'leakage',
    'warranties', 'indemnities',
    'disclosure letter', 'disclosure bundle',
    'material adverse change', 'MAC',
    'conditions precedent', 'CP',
    'board resolution', 'shareholder resolution',
    'written resolution', 'special resolution',
    'ordinary resolution',
    'directors duties', 'Section 172',
    'fiduciary duty', 'duty of care',
    'dividend', 'distribution',
    'allotment', 'share issue', 'pre-emption',
    'EMI', 'enterprise management incentive',
    'share option scheme', 'CSOP',
    'joint venture', 'JV',
    'partnership agreement', 'LLP',
    'limited liability partnership',
    'terms and conditions', 'T&Cs',
    'commercial agreement', 'supply agreement',
    'distribution agreement', 'agency agreement',
    'NDA', 'non-disclosure agreement',
    'intellectual property', 'IP assignment',
  ],
};

/**
 * Build a native context prompt for Universal-3 Pro's plain-English context injection.
 * This replaces the old word_boost approach for practice-area context setting.
 */
export function buildNativePrompt(params: {
  practiceArea?: string;
  sessionType?: string;
  clientName?: string;
  matterReference?: string;
}): string {
  const parts: string[] = [
    'This is a UK legal meeting recording. The speakers are legal professionals (solicitors, paralegals) and their clients.',
  ];

  if (params.practiceArea) {
    const practiceAreaLabels: Record<string, string> = {
      residential_conveyancing: 'residential conveyancing (property purchase, sale, or remortgage)',
      commercial_property: 'commercial property (leases, acquisitions, or disposals)',
      wills_probate: 'wills and probate (estate administration, inheritance)',
      lasting_power_of_attorney: 'lasting power of attorney (LPA preparation and registration)',
      family_divorce_financial: 'family law — divorce and financial remedy proceedings',
      family_children_arrangements: 'family law — children arrangements and child welfare',
      employment_employee: 'employment law (employee/claimant perspective)',
      employment_employer: 'employment law (employer/respondent perspective)',
      personal_injury_rta: 'personal injury and road traffic accident claims',
      clinical_negligence: 'clinical negligence claims',
      housing_tenancy: 'housing and tenancy law (landlord-tenant disputes, possession)',
      debt_litigation: 'debt recovery and civil litigation',
      criminal_defence: 'criminal defence (police station attendance, magistrates or Crown Court)',
      immigration: 'UK immigration law (visas, leave to remain, asylum)',
      corporate_commercial: 'corporate and commercial law (company transactions, contracts)',
    };
    const label = practiceAreaLabels[params.practiceArea] || params.practiceArea.replace(/_/g, ' ');
    parts.push(`The matter relates to ${label}.`);
  }

  if (params.sessionType) {
    const sessionTypeLabels: Record<string, string> = {
      telephone_call: 'a telephone call between solicitor and client',
      police_station: 'a police station attendance (interview under caution or voluntary interview)',
      client_meeting: 'a client meeting at the solicitor\'s office',
      court_hearing: 'a court hearing or tribunal',
      full_meeting: 'a legal meeting',
    };
    const label = sessionTypeLabels[params.sessionType] || params.sessionType.replace(/_/g, ' ');
    parts.push(`The recording is from ${label}.`);
  }

  if (params.clientName) {
    parts.push(`The client's name is ${params.clientName}.`);
  }

  if (params.matterReference) {
    parts.push(`The matter reference is ${params.matterReference}.`);
  }

  parts.push('Expect UK legal terminology, court names, regulatory bodies, and legal procedure references throughout.');

  return parts.join(' ');
}

export function getAmlRiskDefault(practiceArea: PracticeArea): "low" | "medium" | "high" {
  switch (practiceArea) {
    case "residential_conveyancing":
    case "commercial_property":
      return "high";
    case "criminal_defence":
      return "low";
    default:
      return "medium";
  }
}

export function getPracticeAreaPromptContext(practiceArea: PracticeArea): string {
  const contexts: Record<PracticeArea, string> = {
    residential_conveyancing: `PRACTICE AREA CONTEXT — RESIDENTIAL CONVEYANCING:
This attendance note relates to a residential conveyancing matter. Use conveyancing-specific terminology throughout:
- Reference SDLT (Stamp Duty Land Tax), Land Registry forms (TR1, AP1), and searches (local authority, environmental, drainage)
- Use terms like "exchange", "completion", "title deeds", "requisitions on title", "property information form"
- Reference relevant forms: TA6, TA7, TA10, TA13
- Note any chain-related issues, mortgage conditions, or indemnity insurance requirements
- Ensure next steps reference Land Registry registration, SDLT return filing, and post-completion tasks
- This is a HIGH AML risk area — note any source of funds or beneficial ownership discussions`,

    commercial_property: `PRACTICE AREA CONTEXT — COMMERCIAL PROPERTY:
This attendance note relates to a commercial property matter. Use commercial property terminology:
- Reference Landlord and Tenant Act provisions, Section 25/26 notices, break clauses, rent reviews
- Use terms like "FRI lease", "alienation", "user clause", "dilapidations", "heads of terms"
- Note any SDLT considerations, licence requirements, or guarantor arrangements
- Reference authorised guarantee agreements (AGA) where relevant
- This is a HIGH AML risk area — note any source of funds or beneficial ownership discussions`,

    wills_probate: `PRACTICE AREA CONTEXT — WILLS & PROBATE:
This attendance note relates to a wills and probate matter. Use probate-specific terminology:
- Reference IHT (Inheritance Tax), nil rate band, residence nil rate band, IHT400/IHT205 forms
- Use terms like "testator", "executor", "beneficiary", "residuary estate", "specific legacy"
- Note testamentary capacity considerations (Banks v Goodfellow test)
- Reference relevant trusts: discretionary trusts, life interest trusts, IPDI
- Note any Inheritance Act 1975 considerations or contentious probate issues`,

    lasting_power_of_attorney: `PRACTICE AREA CONTEXT — LASTING POWER OF ATTORNEY:
This attendance note relates to a Lasting Power of Attorney matter. Use LPA-specific terminology:
- Reference Mental Capacity Act 2005, Office of the Public Guardian (OPG)
- Distinguish between Health & Welfare LPA and Property & Financial Affairs LPA
- Use terms like "donor", "attorney", "certificate provider", "replacement attorney"
- Reference relevant forms: LP1F, LP1H, LP2, LP3
- Note capacity assessment findings and any concerns about undue pressure`,

    family_divorce_financial: `PRACTICE AREA CONTEXT — FAMILY LAW (DIVORCE / FINANCIAL REMEDY):
This attendance note relates to a family law financial remedy matter. Use family law terminology:
- Reference Form E, Form A, Form H, Form D81, FDR (Financial Dispute Resolution)
- Use terms like "ancillary relief", "clean break", "consent order", "periodical payments"
- Reference CETV (cash equivalent transfer value) for pension matters
- Note Section 25 factors under the Matrimonial Causes Act 1973
- Reference Mesher/Martin orders where property adjustment is discussed`,

    family_children_arrangements: `PRACTICE AREA CONTEXT — FAMILY LAW (CHILDREN / ARRANGEMENTS):
This attendance note relates to a children arrangements matter. Use children law terminology:
- Reference CAFCASS, Section 7 reports, welfare checklist, paramountcy principle
- Use terms like "child arrangements order", "lives with", "spends time with"
- Reference prohibited steps orders (PSO), specific issue orders (SIO)
- Note any Practice Direction 12J (PD12J) domestic abuse considerations
- Reference MIAM (Mediation Information and Assessment Meeting) requirements
- Note parental responsibility status and any safeguarding concerns`,

    employment_employee: `PRACTICE AREA CONTEXT — EMPLOYMENT LAW (EMPLOYEE):
This attendance note relates to an employment matter for the employee/claimant. Use employment terminology:
- Reference ACAS early conciliation, ET1 form, employment tribunal procedure
- Use terms like "unfair dismissal", "constructive dismissal", "redundancy", "TUPE"
- Reference Equality Act 2010, protected characteristics, reasonable adjustments
- Note ACAS Code of Practice compliance in any disciplinary/grievance context
- Reference settlement agreement terms where relevant
- Note limitation periods (3 months less 1 day from effective date of termination)`,

    employment_employer: `PRACTICE AREA CONTEXT — EMPLOYMENT LAW (EMPLOYER):
This attendance note relates to an employment matter for the employer/respondent. Use employment terminology:
- Reference ACAS Code of Practice, fair reason for dismissal, procedural fairness
- Use terms like "capability", "conduct", "SOSR", "redundancy", "collective consultation"
- Note Section 188/189 obligations for collective redundancy situations
- Reference settlement agreement and protected conversation provisions
- Note TUPE implications where business transfer is involved
- Reference right to work checks and sponsorship obligations where relevant`,

    personal_injury_rta: `PRACTICE AREA CONTEXT — PERSONAL INJURY / RTA:
This attendance note relates to a personal injury or road traffic accident claim. Use PI terminology:
- Reference Civil Liability Act 2018 tariff for whiplash/soft tissue injuries
- Use terms like "special damages", "general damages", "loss of earnings", "care and assistance"
- Reference MedCo for medical reporting, OIC (Official Injury Claim) portal
- Note Part 36 offers, QOCS (qualified one-way costs shifting)
- Reference CRU (Compensation Recovery Unit) considerations
- Use JSB (Judicial Studies Board) guidelines for quantum assessment`,

    clinical_negligence: `PRACTICE AREA CONTEXT — CLINICAL NEGLIGENCE:
This attendance note relates to a clinical negligence matter. Use clinical negligence terminology:
- Reference Bolam test, Bolitho, and Montgomery v Lanarkshire for informed consent
- Use terms like "breach of duty", "causation", "but for test", "duty of candour"
- Reference NHS Resolution, medical records disclosure, expert evidence requirements
- Note limitation considerations: date of knowledge under Section 14 Limitation Act
- Reference Fatal Accidents Act / Law Reform Act where applicable
- Note any inquest or coroner's findings`,

    housing_tenancy: `PRACTICE AREA CONTEXT — HOUSING / TENANCY:
This attendance note relates to a housing or tenancy matter. Use housing law terminology:
- Reference Section 21 / Section 8 notices, assured shorthold tenancy (AST)
- Use terms like "possession order", "deposit protection", "disrepair", "fitness for habitation"
- Reference Section 11 Landlord and Tenant Act 1985 for repair obligations
- Note HMO (house in multiple occupation) licensing requirements where relevant
- Reference Renters Reform Bill provisions where applicable
- Note housing benefit / universal credit implications`,

    debt_litigation: `PRACTICE AREA CONTEXT — DEBT / LITIGATION:
This attendance note relates to a debt or civil litigation matter. Use litigation terminology:
- Reference CPR (Civil Procedure Rules), pre-action protocols, allocation
- Use terms like "CCJ", "enforcement", "statutory demand", "summary judgment"
- Reference Part 36 offers, costs budgeting, directions questionnaire
- Note insolvency options: IVA, DRO, bankruptcy, breathing space
- Reference Consumer Credit Act where consumer credit is involved
- Note small claims / fast track / multi-track allocation`,

    criminal_defence: `PRACTICE AREA CONTEXT — CRIMINAL DEFENCE:
This attendance note relates to a criminal defence matter. Use criminal law terminology:
- Reference PACE (Police and Criminal Evidence Act 1984) throughout
- Use terms like "caution", "interview under caution", "appropriate adult", "custody time limits"
- Reference CPIA (Criminal Procedure and Investigations Act) for disclosure obligations
- Note CPS (Crown Prosecution Service) charging decisions, sentencing guidelines
- Reference bail conditions, remand, plea considerations
- Note legal aid eligibility: representation order, means test, interests of justice test
- This is a LOW AML risk area by default`,

    immigration: `PRACTICE AREA CONTEXT — IMMIGRATION:
This attendance note relates to an immigration matter. Use immigration terminology:
- Reference Home Office, UKVI (UK Visas and Immigration) procedures
- Use terms like "leave to remain", "ILR", "entry clearance", "settlement"
- Reference points-based system, Skilled Worker visa, sponsor licence, CoS
- Note Appendix FM requirements for family visa applications, minimum income requirement
- Reference First-tier Tribunal Immigration and Asylum Chamber for appeals
- Note Article 8 ECHR considerations where human rights grounds apply
- Reference EU Settlement Scheme where relevant`,

    corporate_commercial: `PRACTICE AREA CONTEXT — CORPORATE / COMMERCIAL:
This attendance note relates to a corporate or commercial matter. Use corporate/commercial terminology:
- Reference Companies House, articles of association, shareholders agreements
- Use terms like "SPA", "APA", "due diligence", "warranties and indemnities", "disclosure letter"
- Note directors' duties under Section 172 Companies Act 2006
- Reference EMI / CSOP share option schemes where relevant
- Note any conditions precedent, material adverse change clauses
- Reference LLP / partnership agreement terms where applicable`,
  };

  return contexts[practiceArea];
}

export function getClientCareLetterPrompt(params: {
  firmName: string;
  firmAddress?: string;
  firmPhone?: string;
  firmEmail?: string;
  sraNumber?: string;
  feeEarnerName: string;
  clientName: string;
  matterDescription: string;
  practiceArea: string;
  costsEstimate?: string;
  matterReference?: string;
}): string {
  return `You are a UK solicitor preparing a client care letter in accordance with the SRA Standards and Regulations.

Generate a professional client care letter with the following sections:

1. **Introduction** — Confirm the firm's instruction, identify the fee earner, and describe the matter.
2. **Scope of Work** — Clearly describe what the firm has been instructed to do.
3. **Your Fee Earner** — Name and role of the person handling the matter.
4. **Costs Information** — Include the solicitor's costs estimate range. State clearly that this is an estimate and actual costs may vary. Reference hourly rates or fixed fees as appropriate.
5. **Billing Arrangements** — How and when the client will be billed.
6. **Complaints Procedure** — The firm's internal complaints procedure: first raise with the fee earner, then the firm's complaints partner, and include a timeline (8 weeks).
7. **Legal Ombudsman** — If still dissatisfied, the client can contact the Legal Ombudsman within 6 months of the firm's final response. Include: Legal Ombudsman, PO Box 6167, Slough, SL1 0EH. Phone: 0300 555 0333. Website: www.legalombudsman.org.uk
8. **SRA** — The firm is regulated by the Solicitors Regulation Authority. Include the SRA number if provided. Clients can raise concerns about solicitor conduct with the SRA: www.sra.org.uk
9. **Data Protection** — Brief note on GDPR compliance and data handling.
10. **Next Steps** — What happens next in the matter.

Use the following details:

Firm: ${params.firmName}
${params.firmAddress ? `Address: ${params.firmAddress}` : ''}
${params.firmPhone ? `Phone: ${params.firmPhone}` : ''}
${params.firmEmail ? `Email: ${params.firmEmail}` : ''}
${params.sraNumber ? `SRA Number: ${params.sraNumber}` : ''}
Fee Earner: ${params.feeEarnerName}
Client: ${params.clientName}
Matter: ${params.matterDescription}
Practice Area: ${params.practiceArea}
${params.costsEstimate ? `Costs Estimate: ${params.costsEstimate}` : 'Costs Estimate: To be confirmed by the fee earner'}
${params.matterReference ? `Matter Reference: ${params.matterReference}` : ''}

Date: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}

Format the letter professionally with clear headings. Use formal but accessible language. The letter should be ready for the solicitor to review, personalise if needed, and send to the client.`;
}
