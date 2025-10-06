import DocumentViewer from '../DocumentViewer'

export default function DocumentViewerExample() {
  const mockData = {
    attendanceNote: `Meeting held on 14 January 2025 at 10:00 AM with Mrs. Catherine Williams regarding estate planning matters.\n\nAttendees:\n- Mrs. Catherine Williams (Client)\n- Sarah Johnson (Solicitor)\n\nPurpose: Initial consultation for comprehensive estate planning review and will preparation.\n\nDiscussion Summary:\nMrs. Williams expressed concerns about ensuring her estate is properly distributed among her three children and wishes to establish provisions for potential care needs in later life. The client owns property valued at approximately £850,000 and has investments totaling £200,000.`,
    
    keyIssues: [
      'Distribution of estate assets among three beneficiaries with specific conditions',
      'Establishment of lasting power of attorney for health and welfare decisions',
      'Tax implications of current estate structure and potential inheritance tax liability',
      'Provisions for potential long-term care funding requirements',
    ],
    
    nextSteps: [
      'Obtain full property valuations and investment portfolio statements',
      'Schedule follow-up meeting to discuss will provisions in detail',
      'Prepare draft will document for client review',
      'Arrange lasting power of attorney documentation',
      'Consult with tax specialist regarding inheritance tax planning options',
    ],
    
    legalOpinion: `LEGAL OPINION - ESTATE PLANNING\n\nBased on the consultation with Mrs. Catherine Williams, the following legal considerations apply:\n\n1. TESTAMENTARY CAPACITY\nMrs. Williams demonstrates full testamentary capacity and understanding of her estate's nature and extent.\n\n2. INHERITANCE TAX CONSIDERATIONS\nThe current estate value (approximately £1,050,000) exceeds the nil-rate band threshold of £325,000. Strategic planning is recommended to minimize potential inheritance tax liability, which could amount to approximately £290,000 under current rates.\n\n3. LASTING POWER OF ATTORNEY\nGiven the client's age and expressed concerns, establishing both property & financial affairs and health & welfare LPAs is strongly advised.\n\n4. RECOMMENDATIONS\n- Execute comprehensive will with clear distribution provisions\n- Consider establishing trusts for tax efficiency\n- Register lasting powers of attorney\n- Review beneficiary designations on pension and investment accounts`,
    
    transcript: '[00:00] Sarah Johnson: Good morning Mrs. Williams, thank you for coming in today.\n[00:02] Catherine Williams: Good morning, thank you for seeing me.\n[00:05] Sarah Johnson: I understand you\'d like to discuss your estate planning. Could you tell me about your main concerns?\n[00:10] Catherine Williams: Yes, I want to make sure everything is properly arranged for my children...',
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <DocumentViewer {...mockData} />
    </div>
  )
}
