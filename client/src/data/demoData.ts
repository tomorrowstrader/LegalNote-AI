export type PracticeAreaKey =
  | "family"
  | "immigration"
  | "conveyancing"
  | "private-client"
  | "personal-injury"
  | "employment"
  | "commercial"
  | "criminal"
  | "debt-recovery";

export interface DemoMatter {
  id: string;
  ref: string;
  clientName: string;
  title: string;
  status: "active" | "review_required" | "overdue";
  lastActivity: string;
  nextDeadline: string | null;
  riskLevel: "low" | "medium" | "high";
  obligationsDue: number;
}

export interface DemoObligation {
  id: string;
  matterId: string;
  matterTitle: string;
  type: string;
  description: string;
  dueDate: string;
  status: "overdue" | "due_soon" | "upcoming";
  daysOverdue?: number;
  daysDue?: number;
}

export interface DemoDocument {
  id: string;
  title: string;
  type: string;
  status: "approved" | "draft" | "pending_review";
  generatedAt: string;
}

export interface DemoVariant {
  practiceAreaLabel: string;
  complianceScore: number;
  matters: DemoMatter[];
  obligations: DemoObligation[];
  documents: DemoDocument[];
  stats: {
    activeMatters: number;
    overdueItems: number;
    pendingReview: number;
    documentsGenerated: number;
  };
}

function relDate(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().slice(0, 10);
}

function buildVariant(
  practiceAreaLabel: string,
  complianceScore: number,
  matters: DemoMatter[],
  obligations: DemoObligation[],
  documents: DemoDocument[],
  stats: DemoVariant["stats"]
): DemoVariant {
  return { practiceAreaLabel, complianceScore, matters, obligations, documents, stats };
}

export const DEMO_VARIANTS: Record<PracticeAreaKey, DemoVariant> = {
  family: buildVariant(
    "Family Law",
    71,
    [
      {
        id: "f1",
        ref: "FAM/2025/0412",
        clientName: "S. [Prospect]",
        title: "Child Arrangements Order — S. [Prospect]",
        status: "overdue",
        lastActivity: relDate(-3),
        nextDeadline: relDate(-1),
        riskLevel: "medium",
        obligationsDue: 2,
      },
      {
        id: "f2",
        ref: "FAM/2025/0389",
        clientName: "T. Hargreaves",
        title: "Ancillary Relief — Hargreaves v Hargreaves",
        status: "review_required",
        lastActivity: relDate(-5),
        nextDeadline: relDate(3),
        riskLevel: "medium",
        obligationsDue: 1,
      },
      {
        id: "f3",
        ref: "FAM/2025/0347",
        clientName: "N. Patel",
        title: "Non-Molestation Order — Patel",
        status: "active",
        lastActivity: relDate(-1),
        nextDeadline: relDate(7),
        riskLevel: "low",
        obligationsDue: 0,
      },
      {
        id: "f4",
        ref: "FAM/2025/0301",
        clientName: "K. Morrison",
        title: "Divorce Petition — Morrison v Morrison",
        status: "active",
        lastActivity: relDate(-2),
        nextDeadline: relDate(14),
        riskLevel: "low",
        obligationsDue: 0,
      },
    ],
    [
      {
        id: "fo1",
        matterId: "f1",
        matterTitle: "Child Arrangements Order — S. [Prospect]",
        type: "CAFCASS Section 7 Response",
        description: "File response to CAFCASS Section 7 report — deadline passed",
        dueDate: relDate(-1),
        status: "overdue",
        daysOverdue: 1,
      },
      {
        id: "fo2",
        matterId: "f1",
        matterTitle: "Child Arrangements Order — S. [Prospect]",
        type: "Position Statement",
        description: "Lodge position statement with Bristol Family Court ahead of DRA hearing",
        dueDate: relDate(-1),
        status: "overdue",
        daysOverdue: 1,
      },
      {
        id: "fo3",
        matterId: "f2",
        matterTitle: "Ancillary Relief — Hargreaves v Hargreaves",
        type: "Form E Disclosure",
        description: "Exchange of Form E financial disclosure with respondent's solicitors",
        dueDate: relDate(3),
        status: "due_soon",
        daysDue: 3,
      },
    ],
    [
      { id: "fd1", title: "Attendance Note — Child Arrangements Initial Consultation", type: "Attendance Note", status: "approved", generatedAt: relDate(-8) },
      { id: "fd2", title: "Client Care Letter — S. [Prospect]", type: "Client Care Letter", status: "approved", generatedAt: relDate(-8) },
      { id: "fd3", title: "C100 Application — Child Arrangements Order", type: "Court Form", status: "approved", generatedAt: relDate(-7) },
      { id: "fd4", title: "Position Statement — DRA Hearing", type: "Court Document", status: "draft", generatedAt: relDate(-2) },
      { id: "fd5", title: "Form E Financial Statement — Hargreaves", type: "Court Form", status: "pending_review", generatedAt: relDate(-5) },
    ],
    { activeMatters: 4, overdueItems: 2, pendingReview: 1, documentsGenerated: 11 }
  ),

  immigration: buildVariant(
    "Immigration Law",
    68,
    [
      {
        id: "i1",
        ref: "IMM/2025/0178",
        clientName: "S. [Prospect]",
        title: "Skilled Worker Visa — S. [Prospect]",
        status: "overdue",
        lastActivity: relDate(-4),
        nextDeadline: relDate(-2),
        riskLevel: "high",
        obligationsDue: 2,
      },
      {
        id: "i2",
        ref: "IMM/2025/0155",
        clientName: "A. Mensah",
        title: "ILR Application — Mensah",
        status: "review_required",
        lastActivity: relDate(-3),
        nextDeadline: relDate(4),
        riskLevel: "medium",
        obligationsDue: 1,
      },
      {
        id: "i3",
        ref: "IMM/2025/0132",
        clientName: "E. Kowalczyk",
        title: "EU Settlement Scheme (Late) — Kowalczyk",
        status: "active",
        lastActivity: relDate(-1),
        nextDeadline: relDate(10),
        riskLevel: "medium",
        obligationsDue: 0,
      },
      {
        id: "i4",
        ref: "IMM/2025/0118",
        clientName: "R. Ng",
        title: "Spouse Visa — Ng",
        status: "active",
        lastActivity: relDate(-2),
        nextDeadline: relDate(18),
        riskLevel: "low",
        obligationsDue: 0,
      },
    ],
    [
      {
        id: "io1",
        matterId: "i1",
        matterTitle: "Skilled Worker Visa — S. [Prospect]",
        type: "Sponsor Licence Check",
        description: "Confirm employer sponsor licence status — expired without renewal",
        dueDate: relDate(-2),
        status: "overdue",
        daysOverdue: 2,
      },
      {
        id: "io2",
        matterId: "i1",
        matterTitle: "Skilled Worker Visa — S. [Prospect]",
        type: "Home Office Biometrics Appointment",
        description: "Client biometrics appointment not yet booked",
        dueDate: relDate(-2),
        status: "overdue",
        daysOverdue: 2,
      },
      {
        id: "io3",
        matterId: "i2",
        matterTitle: "ILR Application — Mensah",
        type: "Continuous Residence Evidence",
        description: "Obtain further evidence of continuous residence for ILR bundle",
        dueDate: relDate(4),
        status: "due_soon",
        daysDue: 4,
      },
    ],
    [
      { id: "id1", title: "Attendance Note — Skilled Worker Visa Initial Consultation", type: "Attendance Note", status: "approved", generatedAt: relDate(-10) },
      { id: "id2", title: "Client Care Letter — S. [Prospect]", type: "Client Care Letter", status: "approved", generatedAt: relDate(-10) },
      { id: "id3", title: "Home Office Sponsor Licence Check Request", type: "Correspondence", status: "approved", generatedAt: relDate(-7) },
      { id: "id4", title: "ILR Supporting Bundle — Continuous Residence Summary", type: "Bundle", status: "pending_review", generatedAt: relDate(-3) },
    ],
    { activeMatters: 4, overdueItems: 2, pendingReview: 1, documentsGenerated: 9 }
  ),

  conveyancing: buildVariant(
    "Residential Conveyancing",
    74,
    [
      {
        id: "c1",
        ref: "CONV/2025/0891",
        clientName: "S. [Prospect]",
        title: "Purchase — S. [Prospect], 14 Maple Avenue",
        status: "overdue",
        lastActivity: relDate(-3),
        nextDeadline: relDate(-1),
        riskLevel: "high",
        obligationsDue: 2,
      },
      {
        id: "c2",
        ref: "CONV/2025/0874",
        clientName: "G. Whitfield",
        title: "Sale — Whitfield, 8 Birchwood Close",
        status: "review_required",
        lastActivity: relDate(-2),
        nextDeadline: relDate(2),
        riskLevel: "medium",
        obligationsDue: 1,
      },
      {
        id: "c3",
        ref: "CONV/2025/0858",
        clientName: "P. Osei",
        title: "Remortgage — Osei, 22 Ferndale Road",
        status: "active",
        lastActivity: relDate(-1),
        nextDeadline: relDate(8),
        riskLevel: "low",
        obligationsDue: 0,
      },
      {
        id: "c4",
        ref: "CONV/2025/0833",
        clientName: "J. Chapman",
        title: "Purchase — Chapman, New Build Plot 17",
        status: "active",
        lastActivity: relDate(-1),
        nextDeadline: relDate(21),
        riskLevel: "medium",
        obligationsDue: 0,
      },
    ],
    [
      {
        id: "co1",
        matterId: "c1",
        matterTitle: "Purchase — S. [Prospect], 14 Maple Avenue",
        type: "AML Source of Funds",
        description: "Source of funds verification overdue — exchange cannot proceed",
        dueDate: relDate(-1),
        status: "overdue",
        daysOverdue: 1,
      },
      {
        id: "co2",
        matterId: "c1",
        matterTitle: "Purchase — S. [Prospect], 14 Maple Avenue",
        type: "Search Results Review",
        description: "Local authority search results not reviewed and reported to client",
        dueDate: relDate(-1),
        status: "overdue",
        daysOverdue: 1,
      },
      {
        id: "co3",
        matterId: "c2",
        matterTitle: "Sale — Whitfield, 8 Birchwood Close",
        type: "Title Requisitions",
        description: "Respond to buyer's solicitors' title requisitions",
        dueDate: relDate(2),
        status: "due_soon",
        daysDue: 2,
      },
    ],
    [
      { id: "cvd1", title: "Attendance Note — Purchase Initial Consultation, 14 Maple Avenue", type: "Attendance Note", status: "approved", generatedAt: relDate(-9) },
      { id: "cvd2", title: "Client Care Letter — S. [Prospect]", type: "Client Care Letter", status: "approved", generatedAt: relDate(-9) },
      { id: "cvd3", title: "Report on Title — 14 Maple Avenue", type: "Report on Title", status: "approved", generatedAt: relDate(-6) },
      { id: "cvd4", title: "SDLT Return Calculation — Purchase Price £385,000", type: "Tax Document", status: "approved", generatedAt: relDate(-5) },
      { id: "cvd5", title: "Mortgage Conditions Report — Lender Requirements", type: "Lender Report", status: "pending_review", generatedAt: relDate(-2) },
      { id: "cvd6", title: "Completion Statement — Whitfield Sale", type: "Completion Statement", status: "draft", generatedAt: relDate(-1) },
    ],
    { activeMatters: 4, overdueItems: 2, pendingReview: 1, documentsGenerated: 14 }
  ),

  "private-client": buildVariant(
    "Private Client",
    76,
    [
      {
        id: "pc1",
        ref: "PROB/2025/0223",
        clientName: "S. [Prospect]",
        title: "Estate Administration — S. [Prospect] (Deceased)",
        status: "overdue",
        lastActivity: relDate(-5),
        nextDeadline: relDate(-2),
        riskLevel: "medium",
        obligationsDue: 2,
      },
      {
        id: "pc2",
        ref: "PROB/2025/0211",
        clientName: "E. Thornton",
        title: "Will Drafting — E. & R. Thornton (Mirror Wills)",
        status: "review_required",
        lastActivity: relDate(-3),
        nextDeadline: relDate(3),
        riskLevel: "low",
        obligationsDue: 1,
      },
      {
        id: "pc3",
        ref: "PROB/2025/0197",
        clientName: "H. Beaumont",
        title: "Lasting Power of Attorney — Beaumont",
        status: "active",
        lastActivity: relDate(-2),
        nextDeadline: relDate(12),
        riskLevel: "low",
        obligationsDue: 0,
      },
      {
        id: "pc4",
        ref: "PROB/2025/0184",
        clientName: "V. Cavendish",
        title: "IHT Planning — Cavendish Family Trust",
        status: "active",
        lastActivity: relDate(-1),
        nextDeadline: relDate(28),
        riskLevel: "medium",
        obligationsDue: 0,
      },
    ],
    [
      {
        id: "po1",
        matterId: "pc1",
        matterTitle: "Estate Administration — S. [Prospect] (Deceased)",
        type: "IHT400 Submission",
        description: "IHT400 inheritance tax return overdue with HMRC",
        dueDate: relDate(-2),
        status: "overdue",
        daysOverdue: 2,
      },
      {
        id: "po2",
        matterId: "pc1",
        matterTitle: "Estate Administration — S. [Prospect] (Deceased)",
        type: "Grant of Probate Application",
        description: "Application for grant of probate not yet filed with probate registry",
        dueDate: relDate(-2),
        status: "overdue",
        daysOverdue: 2,
      },
      {
        id: "po3",
        matterId: "pc2",
        matterTitle: "Will Drafting — E. & R. Thornton (Mirror Wills)",
        type: "Will Execution",
        description: "Thornton mirror wills ready for execution — appointment to be booked",
        dueDate: relDate(3),
        status: "due_soon",
        daysDue: 3,
      },
    ],
    [
      { id: "pcd1", title: "Attendance Note — Estate Administration Initial Consultation", type: "Attendance Note", status: "approved", generatedAt: relDate(-12) },
      { id: "pcd2", title: "Client Care Letter — S. [Prospect]", type: "Client Care Letter", status: "approved", generatedAt: relDate(-12) },
      { id: "pcd3", title: "IHT400 Inheritance Tax Return — Draft", type: "HMRC Return", status: "draft", generatedAt: relDate(-4) },
      { id: "pcd4", title: "Thornton Mirror Wills — Execution Copies", type: "Will", status: "approved", generatedAt: relDate(-3) },
      { id: "pcd5", title: "LPA Property & Financial Affairs — Beaumont", type: "LPA Form", status: "pending_review", generatedAt: relDate(-2) },
    ],
    { activeMatters: 4, overdueItems: 2, pendingReview: 1, documentsGenerated: 10 }
  ),

  "personal-injury": buildVariant(
    "Personal Injury",
    69,
    [
      {
        id: "pi1",
        ref: "PI/2025/0562",
        clientName: "S. [Prospect]",
        title: "Employer Liability — S. [Prospect] v Apex Manufacturing",
        status: "overdue",
        lastActivity: relDate(-4),
        nextDeadline: relDate(-2),
        riskLevel: "high",
        obligationsDue: 2,
      },
      {
        id: "pi2",
        ref: "PI/2025/0541",
        clientName: "B. Forde",
        title: "Road Traffic Accident — Forde v Insurers",
        status: "review_required",
        lastActivity: relDate(-3),
        nextDeadline: relDate(4),
        riskLevel: "medium",
        obligationsDue: 1,
      },
      {
        id: "pi3",
        ref: "PI/2025/0519",
        clientName: "L. Ahmed",
        title: "Slip & Fall — Ahmed v Tesco Stores",
        status: "active",
        lastActivity: relDate(-1),
        nextDeadline: relDate(9),
        riskLevel: "medium",
        obligationsDue: 0,
      },
      {
        id: "pi4",
        ref: "PI/2025/0498",
        clientName: "M. Delgado",
        title: "Clinical Negligence — Delgado v NHS Trust",
        status: "active",
        lastActivity: relDate(-2),
        nextDeadline: relDate(30),
        riskLevel: "high",
        obligationsDue: 0,
      },
    ],
    [
      {
        id: "pio1",
        matterId: "pi1",
        matterTitle: "Employer Liability — S. [Prospect] v Apex Manufacturing",
        type: "Pre-Action Protocol Letter",
        description: "Pre-action protocol letter of claim overdue — limitation risk",
        dueDate: relDate(-2),
        status: "overdue",
        daysOverdue: 2,
      },
      {
        id: "pio2",
        matterId: "pi1",
        matterTitle: "Employer Liability — S. [Prospect] v Apex Manufacturing",
        type: "Medical Expert Report",
        description: "Expert medical report not yet instructed — Court deadline approaching",
        dueDate: relDate(-2),
        status: "overdue",
        daysOverdue: 2,
      },
      {
        id: "pio3",
        matterId: "pi2",
        matterTitle: "Road Traffic Accident — Forde v Insurers",
        type: "Schedule of Loss",
        description: "Serve updated schedule of special damages on defendant",
        dueDate: relDate(4),
        status: "due_soon",
        daysDue: 4,
      },
    ],
    [
      { id: "pid1", title: "Attendance Note — Employer Liability Initial Consultation", type: "Attendance Note", status: "approved", generatedAt: relDate(-11) },
      { id: "pid2", title: "Client Care Letter — S. [Prospect]", type: "Client Care Letter", status: "approved", generatedAt: relDate(-11) },
      { id: "pid3", title: "Pre-Action Protocol Letter of Claim — Apex Manufacturing", type: "Letter of Claim", status: "draft", generatedAt: relDate(-1) },
      { id: "pid4", title: "Schedule of Special Damages — Forde v Insurers", type: "Schedule of Loss", status: "pending_review", generatedAt: relDate(-3) },
      { id: "pid5", title: "Medical Expert Instruction Letter — Occupational Health", type: "Expert Instruction", status: "draft", generatedAt: relDate(-2) },
    ],
    { activeMatters: 4, overdueItems: 2, pendingReview: 1, documentsGenerated: 12 }
  ),

  employment: buildVariant(
    "Employment Law",
    73,
    [
      {
        id: "e1",
        ref: "EMP/2025/0334",
        clientName: "S. [Prospect]",
        title: "Constructive Dismissal — S. [Prospect] v Nexus Group",
        status: "overdue",
        lastActivity: relDate(-3),
        nextDeadline: relDate(-1),
        riskLevel: "high",
        obligationsDue: 2,
      },
      {
        id: "e2",
        ref: "EMP/2025/0318",
        clientName: "C. Okafor",
        title: "Redundancy Dispute — Okafor v Stratford Media",
        status: "review_required",
        lastActivity: relDate(-2),
        nextDeadline: relDate(3),
        riskLevel: "medium",
        obligationsDue: 1,
      },
      {
        id: "e3",
        ref: "EMP/2025/0302",
        clientName: "H. Nguyen",
        title: "Discrimination Claim — Nguyen v City Finance Ltd",
        status: "active",
        lastActivity: relDate(-1),
        nextDeadline: relDate(11),
        riskLevel: "medium",
        obligationsDue: 0,
      },
      {
        id: "e4",
        ref: "EMP/2025/0287",
        clientName: "R. Jacobs",
        title: "Settlement Agreement — Jacobs v Bright Solutions",
        status: "active",
        lastActivity: relDate(-1),
        nextDeadline: relDate(7),
        riskLevel: "low",
        obligationsDue: 0,
      },
    ],
    [
      {
        id: "eo1",
        matterId: "e1",
        matterTitle: "Constructive Dismissal — S. [Prospect] v Nexus Group",
        type: "ACAS Early Conciliation",
        description: "ACAS early conciliation certificate not obtained — ET1 cannot be filed",
        dueDate: relDate(-1),
        status: "overdue",
        daysOverdue: 1,
      },
      {
        id: "eo2",
        matterId: "e1",
        matterTitle: "Constructive Dismissal — S. [Prospect] v Nexus Group",
        type: "ET1 Filing Deadline",
        description: "Employment tribunal claim (ET1) deadline in jeopardy — 3-month limitation",
        dueDate: relDate(-1),
        status: "overdue",
        daysOverdue: 1,
      },
      {
        id: "eo3",
        matterId: "e2",
        matterTitle: "Redundancy Dispute — Okafor v Stratford Media",
        type: "Bundle Preparation",
        description: "Prepare hearing bundle for preliminary hearing",
        dueDate: relDate(3),
        status: "due_soon",
        daysDue: 3,
      },
    ],
    [
      { id: "ed1", title: "Attendance Note — Constructive Dismissal Initial Consultation", type: "Attendance Note", status: "approved", generatedAt: relDate(-10) },
      { id: "ed2", title: "Client Care Letter — S. [Prospect]", type: "Client Care Letter", status: "approved", generatedAt: relDate(-10) },
      { id: "ed3", title: "Schedule of Loss — S. [Prospect] v Nexus Group", type: "Schedule of Loss", status: "draft", generatedAt: relDate(-3) },
      { id: "ed4", title: "ET1 Claim Form — Constructive Dismissal", type: "Tribunal Form", status: "pending_review", generatedAt: relDate(-1) },
      { id: "ed5", title: "Attendance Note — Redundancy Strategy Review — Okafor", type: "Attendance Note", status: "approved", generatedAt: relDate(-5) },
    ],
    { activeMatters: 4, overdueItems: 2, pendingReview: 1, documentsGenerated: 10 }
  ),

  commercial: buildVariant(
    "Commercial Law",
    77,
    [
      {
        id: "cm1",
        ref: "COMM/2025/0441",
        clientName: "S. [Prospect]",
        title: "Share Purchase Agreement — S. [Prospect] Ltd Acquisition",
        status: "overdue",
        lastActivity: relDate(-4),
        nextDeadline: relDate(-1),
        riskLevel: "high",
        obligationsDue: 2,
      },
      {
        id: "cm2",
        ref: "COMM/2025/0424",
        clientName: "Apex Digital Ltd",
        title: "Commercial Lease — Apex Digital, Canary Wharf",
        status: "review_required",
        lastActivity: relDate(-2),
        nextDeadline: relDate(4),
        riskLevel: "medium",
        obligationsDue: 1,
      },
      {
        id: "cm3",
        ref: "COMM/2025/0408",
        clientName: "Meridian Retail plc",
        title: "Supplier Framework Agreement — Meridian Retail",
        status: "active",
        lastActivity: relDate(-1),
        nextDeadline: relDate(10),
        riskLevel: "low",
        obligationsDue: 0,
      },
      {
        id: "cm4",
        ref: "COMM/2025/0391",
        clientName: "Harlow Ventures Ltd",
        title: "Series A Term Sheet — Harlow Ventures",
        status: "active",
        lastActivity: relDate(-2),
        nextDeadline: relDate(20),
        riskLevel: "medium",
        obligationsDue: 0,
      },
    ],
    [
      {
        id: "cmo1",
        matterId: "cm1",
        matterTitle: "Share Purchase Agreement — S. [Prospect] Ltd Acquisition",
        type: "AML Enhanced Due Diligence",
        description: "EDD not completed for seller entity — transaction cannot exchange",
        dueDate: relDate(-1),
        status: "overdue",
        daysOverdue: 1,
      },
      {
        id: "cmo2",
        matterId: "cm1",
        matterTitle: "Share Purchase Agreement — S. [Prospect] Ltd Acquisition",
        type: "Disclosure Letter Sign-off",
        description: "Disclosure letter not reviewed by partner — completion date at risk",
        dueDate: relDate(-1),
        status: "overdue",
        daysOverdue: 1,
      },
      {
        id: "cmo3",
        matterId: "cm2",
        matterTitle: "Commercial Lease — Apex Digital, Canary Wharf",
        type: "Licence to Assign",
        description: "Obtain landlord's licence to assign — consent deadline expiring",
        dueDate: relDate(4),
        status: "due_soon",
        daysDue: 4,
      },
    ],
    [
      { id: "cmd1", title: "Attendance Note — Share Purchase Initial Consultation", type: "Attendance Note", status: "approved", generatedAt: relDate(-11) },
      { id: "cmd2", title: "Client Care Letter — S. [Prospect] Ltd", type: "Client Care Letter", status: "approved", generatedAt: relDate(-11) },
      { id: "cmd3", title: "AML Enhanced Due Diligence Report — Target Entity", type: "AML Report", status: "draft", generatedAt: relDate(-2) },
      { id: "cmd4", title: "Commercial Lease — Apex Digital, Canary Wharf (Engrossment)", type: "Commercial Lease", status: "pending_review", generatedAt: relDate(-3) },
      { id: "cmd5", title: "Disclosure Letter — S. [Prospect] Ltd Acquisition", type: "Disclosure Letter", status: "draft", generatedAt: relDate(-1) },
      { id: "cmd6", title: "Supplier Framework Agreement — Meridian Retail plc", type: "Commercial Contract", status: "approved", generatedAt: relDate(-6) },
    ],
    { activeMatters: 4, overdueItems: 2, pendingReview: 1, documentsGenerated: 13 }
  ),

  criminal: buildVariant(
    "Criminal Defence",
    65,
    [
      {
        id: "cr1",
        ref: "CRIM/2025/0812",
        clientName: "S. [Prospect]",
        title: "Crown Court — S. [Prospect] (GBH s.18 OAPA)",
        status: "overdue",
        lastActivity: relDate(-5),
        nextDeadline: relDate(-2),
        riskLevel: "high",
        obligationsDue: 2,
      },
      {
        id: "cr2",
        ref: "CRIM/2025/0798",
        clientName: "D. Halcrow",
        title: "Magistrates — Halcrow (Section 5 POA)",
        status: "review_required",
        lastActivity: relDate(-2),
        nextDeadline: relDate(3),
        riskLevel: "medium",
        obligationsDue: 1,
      },
      {
        id: "cr3",
        ref: "CRIM/2025/0779",
        clientName: "M. Trevino",
        title: "Appeal — Trevino (Sentence Appeal, Crown Court)",
        status: "active",
        lastActivity: relDate(-1),
        nextDeadline: relDate(14),
        riskLevel: "medium",
        obligationsDue: 0,
      },
      {
        id: "cr4",
        ref: "CRIM/2025/0765",
        clientName: "J. Attah",
        title: "Police Station Attendance — Attah (Fraud)",
        status: "active",
        lastActivity: relDate(0),
        nextDeadline: relDate(1),
        riskLevel: "low",
        obligationsDue: 0,
      },
    ],
    [
      {
        id: "cro1",
        matterId: "cr1",
        matterTitle: "Crown Court — S. [Prospect] (GBH s.18 OAPA)",
        type: "Defence Case Statement",
        description: "DCS not filed with Crown Court — statutory deadline missed",
        dueDate: relDate(-2),
        status: "overdue",
        daysOverdue: 2,
      },
      {
        id: "cro2",
        matterId: "cr1",
        matterTitle: "Crown Court — S. [Prospect] (GBH s.18 OAPA)",
        type: "Expert Forensic Report",
        description: "Forensic expert not yet instructed — trial listing in 6 weeks",
        dueDate: relDate(-2),
        status: "overdue",
        daysOverdue: 2,
      },
      {
        id: "cro3",
        matterId: "cr2",
        matterTitle: "Magistrates — Halcrow (Section 5 POA)",
        type: "Newton Hearing Preparation",
        description: "Prepare written submissions for Newton hearing",
        dueDate: relDate(3),
        status: "due_soon",
        daysDue: 3,
      },
    ],
    [
      { id: "crd1", title: "Police Station Attendance Record — S. [Prospect] (GBH s.18)", type: "Police Station Record", status: "approved", generatedAt: relDate(-12) },
      { id: "crd2", title: "Client Care Letter — S. [Prospect]", type: "Client Care Letter", status: "approved", generatedAt: relDate(-12) },
      { id: "crd3", title: "Defence Case Statement — Crown Court", type: "Defence Statement", status: "draft", generatedAt: relDate(-3) },
      { id: "crd4", title: "Newton Hearing Written Submissions — Halcrow", type: "Court Submissions", status: "pending_review", generatedAt: relDate(-1) },
    ],
    { activeMatters: 4, overdueItems: 2, pendingReview: 1, documentsGenerated: 8 }
  ),

  "debt-recovery": buildVariant(
    "Debt Recovery",
    70,
    [
      {
        id: "dr1",
        ref: "DEBT/2025/1021",
        clientName: "S. [Prospect]",
        title: "Commercial Debt — S. [Prospect] v Dunmore Supplies Ltd",
        status: "overdue",
        lastActivity: relDate(-4),
        nextDeadline: relDate(-1),
        riskLevel: "medium",
        obligationsDue: 2,
      },
      {
        id: "dr2",
        ref: "DEBT/2025/1008",
        clientName: "Pinnacle Ltd",
        title: "Statutory Demand — Pinnacle v Kestrel Group",
        status: "review_required",
        lastActivity: relDate(-2),
        nextDeadline: relDate(2),
        riskLevel: "medium",
        obligationsDue: 1,
      },
      {
        id: "dr3",
        ref: "DEBT/2025/0994",
        clientName: "J. Forsyth",
        title: "CCJ Enforcement — Forsyth (Charging Order)",
        status: "active",
        lastActivity: relDate(-1),
        nextDeadline: relDate(9),
        riskLevel: "low",
        obligationsDue: 0,
      },
      {
        id: "dr4",
        ref: "DEBT/2025/0978",
        clientName: "Carrington Foods plc",
        title: "Invoice Dispute — Carrington v Bradwell Logistics",
        status: "active",
        lastActivity: relDate(-1),
        nextDeadline: relDate(15),
        riskLevel: "low",
        obligationsDue: 0,
      },
    ],
    [
      {
        id: "dro1",
        matterId: "dr1",
        matterTitle: "Commercial Debt — S. [Prospect] v Dunmore Supplies Ltd",
        type: "Letter Before Action",
        description: "Pre-action protocol LBA not sent — County Court claim at risk",
        dueDate: relDate(-1),
        status: "overdue",
        daysOverdue: 1,
      },
      {
        id: "dro2",
        matterId: "dr1",
        matterTitle: "Commercial Debt — S. [Prospect] v Dunmore Supplies Ltd",
        type: "MCOL Claim Filing",
        description: "Money Claim Online (MCOL) not yet filed — debt ageing",
        dueDate: relDate(-1),
        status: "overdue",
        daysOverdue: 1,
      },
      {
        id: "dro3",
        matterId: "dr2",
        matterTitle: "Statutory Demand — Pinnacle v Kestrel Group",
        type: "21-Day Response Deadline",
        description: "Monitor statutory demand — 21 days expire in 2 days",
        dueDate: relDate(2),
        status: "due_soon",
        daysDue: 2,
      },
    ],
    [
      { id: "drd1", title: "Attendance Note — Debt Recovery Initial Consultation", type: "Attendance Note", status: "approved", generatedAt: relDate(-10) },
      { id: "drd2", title: "Client Care Letter — S. [Prospect]", type: "Client Care Letter", status: "approved", generatedAt: relDate(-10) },
      { id: "drd3", title: "Letter Before Action — Dunmore Supplies Ltd", type: "Pre-Action Letter", status: "draft", generatedAt: relDate(-2) },
      { id: "drd4", title: "Statutory Demand — Pinnacle v Kestrel Group", type: "Statutory Demand", status: "approved", generatedAt: relDate(-6) },
    ],
    { activeMatters: 4, overdueItems: 2, pendingReview: 1, documentsGenerated: 9 }
  ),
};

export const PRACTICE_AREA_LABELS: Record<PracticeAreaKey, string> = {
  family: "Family Law",
  immigration: "Immigration Law",
  conveyancing: "Residential Conveyancing",
  "private-client": "Private Client",
  "personal-injury": "Personal Injury",
  employment: "Employment Law",
  commercial: "Commercial Law",
  criminal: "Criminal Defence",
  "debt-recovery": "Debt Recovery",
};

export function isValidPracticeArea(key: string): key is PracticeAreaKey {
  return key in DEMO_VARIANTS;
}

export function personaliseMatters(
  matters: DemoMatter[],
  lastName: string
): DemoMatter[] {
  if (!lastName) return matters;
  const initial = lastName.charAt(0).toUpperCase();
  const personalRef = `${initial}. ${lastName}`;
  return matters.map((m, idx) => {
    if (idx === 0) {
      return {
        ...m,
        clientName: personalRef,
        title: m.title.replace("S. [Prospect]", personalRef),
      };
    }
    return m;
  });
}

export function personaliseObligations(
  obligations: DemoObligation[],
  lastName: string
): DemoObligation[] {
  if (!lastName) return obligations;
  const initial = lastName.charAt(0).toUpperCase();
  const personalRef = `${initial}. ${lastName}`;
  return obligations.map((o) => ({
    ...o,
    matterTitle: o.matterTitle.replace("S. [Prospect]", personalRef),
    description: o.description.replace("S. [Prospect]", personalRef),
  }));
}
