/**
 * UK Legal Vocabulary for AssemblyAI Word Boost
 * 
 * This list improves transcription accuracy for common legal terms,
 * UK courts, regulatory bodies, and practice management systems.
 * 
 * AssemblyAI limits: max 1000 words, each word max 6 words
 */

export const UK_LEGAL_VOCABULARY = [
  // Practice Management Systems
  'Clio', 'Clio Manage', 'iManage', 'LEAP', 'PracticePanther',
  'Actionstep', 'MyCase', 'Smokeball', 'LegalNote',
  
  // Regulatory Bodies
  'SRA', 'Solicitors Regulation Authority', 'Law Society',
  'Legal Ombudsman', 'Bar Standards Board', 'BSB',
  'Legal Services Board', 'LSB', 'CILEx',
  'Legal Aid Agency', 'LAA',
  
  // UK Courts
  'Supreme Court', 'Court of Appeal', 'High Court',
  'Crown Court', 'County Court', "Magistrates' Court",
  'Employment Tribunal', 'First-tier Tribunal', 'Upper Tribunal',
  'Family Court', 'Court of Protection',
  'Chancery Division', 'Queen\'s Bench', 'King\'s Bench',
  'Administrative Court', 'Commercial Court', 'Technology Court',
  
  // Court Divisions & Offices
  'Central London County Court', 'Royal Courts of Justice',
  'Old Bailey', 'Rolls Building', 'Strand',
  'HMCTS', 'HM Courts Tribunals Service',
  
  // Legal Professionals
  'solicitor', 'barrister', 'counsel', 'QC', 'KC',
  'legal executive', 'paralegal', 'trainee solicitor',
  'partner', 'associate', 'of counsel',
  'chambers', 'silk', 'junior counsel',
  
  // Legal Documents
  'witness statement', 'claim form', 'defence',
  'counterclaim', 'reply', 'schedule of loss',
  'particulars of claim', 'acknowledgement of service',
  'statement of case', 'skeleton argument',
  'bundle', 'chronology', 'dramatis personae',
  'pleadings', 'disclosure', 'inspection',
  'Part 36 offer', 'Calderbank offer',
  'costs budget', 'bill of costs', 'points of dispute',
  
  // Legal Proceedings
  'claimant', 'defendant', 'appellant', 'respondent',
  'applicant', 'third party', 'intervener',
  'litigation friend', 'McKenzie friend',
  'pre-action protocol', 'Letter of Claim',
  'Letter Before Action', 'LBA',
  'allocation questionnaire', 'directions questionnaire',
  'case management conference', 'CMC',
  'pre-trial review', 'PTR',
  'trial', 'hearing', 'adjournment',
  
  // Civil Procedure
  'CPR', 'Civil Procedure Rules',
  'Practice Direction', 'PD',
  'Part 7 claim', 'Part 8 claim', 'Part 20 claim',
  'summary judgment', 'default judgment',
  'strike out', 'unless order',
  'freezing order', 'Mareva injunction',
  'search order', 'Anton Piller',
  'Norwich Pharmacal order',
  'interim injunction', 'interlocutory',
  
  // Evidence & Disclosure
  'standard disclosure', 'specific disclosure',
  'Peruvian Guano', 'train of inquiry',
  'e-disclosure', 'Technology Assisted Review', 'TAR',
  'privilege', 'legal professional privilege', 'LPP',
  'litigation privilege', 'legal advice privilege',
  'without prejudice', 'without prejudice save as to costs',
  'WPSATC', 'open correspondence',
  
  // Contract Law
  'breach of contract', 'repudiatory breach',
  'anticipatory breach', 'fundamental breach',
  'consideration', 'offer and acceptance',
  'implied terms', 'express terms',
  'conditions', 'warranties', 'innominate terms',
  'exemption clause', 'limitation clause',
  'liquidated damages', 'penalty clause',
  'frustration', 'force majeure',
  'misrepresentation', 'duress', 'undue influence',
  
  // Property Law
  'freehold', 'leasehold', 'commonhold',
  'conveyancing', 'completion', 'exchange',
  'Land Registry', 'title deeds',
  'easement', 'covenant', 'restrictive covenant',
  'right of way', 'wayleave',
  'tenancy', 'landlord', 'tenant',
  'assured shorthold tenancy', 'AST',
  'Section 21 notice', 'Section 8 notice',
  'forfeiture', 'dilapidations',
  'SDLT', 'Stamp Duty Land Tax',
  
  // Employment Law
  'unfair dismissal', 'constructive dismissal',
  'wrongful dismissal', 'redundancy',
  'TUPE', 'Transfer of Undertakings',
  'ACAS', 'early conciliation',
  'settlement agreement', 'compromise agreement',
  'garden leave', 'notice period',
  'restrictive covenants', 'non-compete',
  'whistleblowing', 'protected disclosure',
  'discrimination', 'protected characteristics',
  'Equality Act', 'EHRC',
  
  // Family Law
  'divorce', 'dissolution', 'annulment',
  'decree nisi', 'decree absolute',
  'financial remedy', 'Form E',
  'ancillary relief', 'MPS', 'maintenance pending suit',
  'child arrangements order', 'CAO',
  'prohibited steps order', 'PSO',
  'specific issue order', 'SIO',
  'CAFCASS', "Children's Guardian",
  'non-molestation order', 'occupation order',
  
  // Wills & Probate
  'will', 'codicil', 'intestacy',
  'probate', 'letters of administration',
  'executor', 'administrator',
  'beneficiary', 'residuary estate',
  'IHT', 'Inheritance Tax',
  'nil rate band', 'residence nil rate band',
  'deed of variation', 'disclaimer',
  'lasting power of attorney', 'LPA',
  'Court of Protection', 'deputyship',
  
  // Criminal Law
  'indictable offence', 'summary offence',
  'either way offence', 'triable either way',
  'plea', 'guilty plea', 'not guilty',
  'bail', 'remand', 'custody time limits',
  'PACE', 'Police and Criminal Evidence Act',
  'caution', 'interview under caution',
  'appropriate adult', 'duty solicitor',
  'CPS', 'Crown Prosecution Service',
  'disclosure', 'unused material',
  'CPIA', 'Criminal Procedure and Investigations Act',
  
  // Immigration
  'Home Office', 'UKVI',
  'visa', 'leave to remain', 'ILR',
  'indefinite leave to remain',
  'points-based system', 'PBS',
  'Tier 2', 'Skilled Worker',
  'sponsor licence', 'certificate of sponsorship', 'CoS',
  'asylum', 'refugee status',
  'First-tier Tribunal Immigration',
  
  // Commercial & Corporate
  'Companies House', 'articles of association',
  'shareholders agreement', 'share purchase agreement', 'SPA',
  'asset purchase agreement', 'APA',
  'due diligence', 'data room',
  'completion accounts', 'locked box',
  'warranties and indemnities', 'disclosure letter',
  'material adverse change', 'MAC',
  'conditions precedent', 'CP',
  
  // Insolvency
  'administration', 'administrator',
  'liquidation', 'winding up', 'liquidator',
  'creditors voluntary liquidation', 'CVL',
  'compulsory liquidation',
  'company voluntary arrangement', 'CVA',
  'individual voluntary arrangement', 'IVA',
  'bankruptcy', 'trustee in bankruptcy',
  'preferential creditor', 'secured creditor',
  'floating charge', 'fixed charge',
  
  // Data Protection & GDPR
  'GDPR', 'General Data Protection Regulation',
  'ICO', 'Information Commissioner',
  'data controller', 'data processor',
  'data subject', 'personal data',
  'special category data', 'sensitive data',
  'lawful basis', 'legitimate interests',
  'consent', 'right to erasure',
  'subject access request', 'SAR',
  'data protection impact assessment', 'DPIA',
  
  // Financial Amounts (common UK amounts)
  'fifteen thousand', 'fifty thousand',
  'one hundred thousand', 'two hundred thousand',
  'five hundred thousand', 'one million',
  'two million', 'five million', 'ten million',
  
  // Common Legal Phrases
  'in the matter of', 'inter alia',
  'prima facie', 'res judicata',
  'obiter dicta', 'ratio decidendi',
  'stare decisis', 'ultra vires',
  'bona fide', 'ex parte',
  'in camera', 'suo motu',
];

/**
 * Build the keyterms list for Universal-3 Pro's keyterms_prompt parameter.
 * Combines case-specific terms with practice-area-specific vocabulary and general legal vocabulary.
 * Universal-3 Pro accepts keyterms_prompt as an array of strings (up to 1,000 terms,
 * max 6 words each). Note: keyterms_prompt and prompt are mutually exclusive in the API.
 */
export function buildWordBoostList(caseData: {
  clientName?: string;
  title?: string;
  matterReference?: string;
  practiceArea?: string;
  participants?: Array<{ name?: string }>;
}): string[] {
  const caseSpecificTerms: string[] = [];
  
  if (caseData.clientName) {
    const nameParts = caseData.clientName.split(/\s+/);
    caseSpecificTerms.push(caseData.clientName);
    nameParts.forEach(part => {
      if (part.length > 2) {
        caseSpecificTerms.push(part);
      }
    });
  }
  
  if (caseData.matterReference) {
    caseSpecificTerms.push(caseData.matterReference);
  }
  
  if (caseData.participants) {
    caseData.participants.forEach(p => {
      if (p.name) {
        caseSpecificTerms.push(p.name);
        const nameParts = p.name.split(/\s+/);
        nameParts.forEach(part => {
          if (part.length > 2) {
            caseSpecificTerms.push(part);
          }
        });
      }
    });
  }
  
  let practiceAreaTerms: string[] = [];
  if (caseData.practiceArea) {
    try {
      const { PRACTICE_AREA_WORD_BOOST } = require('./practiceAreaConfig');
      const paTerms = PRACTICE_AREA_WORD_BOOST[caseData.practiceArea];
      if (paTerms) {
        practiceAreaTerms = paTerms;
      }
    } catch {
    }
  }
  
  const uniqueTerms = Array.from(new Set([...caseSpecificTerms, ...practiceAreaTerms, ...UK_LEGAL_VOCABULARY]));
  
  return uniqueTerms.slice(0, 1000);
}

/**
 * Build keyterms config for Universal-3 Pro transcription.
 *
 * Strategy: use Universal-3 Pro's native `prompt` field for legal context injection
 * (practice area, session type, client name, matter reference). Because the API does
 * not allow `prompt` and `keyterms_prompt` in the same request, this function always
 * produces a nativePrompt and omits keyterms from the payload. The keyterms list is
 * still populated on the returned config for diagnostic/logging purposes, but the
 * AssemblyAIService will prefer nativePrompt and skip keyterms_prompt when it is set.
 *
 * If nativePrompt construction fails for any reason, the config falls back to
 * keyterms_prompt only (no prompt field), ensuring at least term-level boosts.
 */
export function buildKeytermsConfig(caseData: {
  clientName?: string;
  title?: string;
  matterReference?: string;
  practiceArea?: string;
  participants?: Array<{ name?: string }>;
  sessionType?: string;
}): import('./assemblyAIService').KeytermsConfig {
  const keyterms = buildWordBoostList(caseData);
  
  let nativePrompt: string | undefined;
  try {
    const { buildNativePrompt } = require('./practiceAreaConfig');
    nativePrompt = buildNativePrompt({
      practiceArea: caseData.practiceArea,
      sessionType: caseData.sessionType,
      clientName: caseData.clientName,
      matterReference: caseData.matterReference,
    });
  } catch {
    // Fall through — nativePrompt remains undefined, keyterms_prompt will be used instead
  }

  return { keyterms, nativePrompt };
}
