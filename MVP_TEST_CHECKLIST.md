# LegalNote - MVP Test Checklist

This checklist covers all MVP functionality for internal testing and QA. Complete each section to verify the system is working correctly before pilot launch.

---

## Pre-Test Setup

### Environment Verification
- [ ] Application loads at root URL without errors
- [ ] Database connection is active (check server logs)
- [ ] Object storage is configured and accessible
- [ ] All required API keys are set (OpenAI, AssemblyAI, Resend, Twilio)

### Test User Setup
- [ ] Create test user via Replit Auth
- [ ] User appears in database after first login
- [ ] Session persists across page refreshes

---

## 1. Authentication & Session Management

### Login Flow
- [ ] Replit Auth login works correctly
- [ ] User redirected to dashboard after login
- [ ] User profile data synced from Replit Auth (name, email, avatar)

### Session Security
- [ ] Session persists for 4 hours
- [ ] Session timeout warning appears at 5 minutes remaining
- [ ] "Extend Session" button works correctly
- [ ] Auto-logout occurs after 4 hours of inactivity
- [ ] Logout button clears session completely

### Access Control
- [ ] Unauthenticated users cannot access protected routes
- [ ] Users can only see their own cases
- [ ] Users can only access their own documents

---

## 2. Firm Profile & Branding

### Firm Profile Setup
- [ ] Navigate to Settings → Firm Profile
- [ ] Save firm name, address, phone, email
- [ ] Upload firm logo (PNG/JPG)
- [ ] Upload letterhead image (optional)
- [ ] Changes persist after page refresh

### Branding Verification
- [ ] Firm logo appears in PDF exports
- [ ] Letterhead appears as PDF background (if configured)
- [ ] Firm details appear in document headers

---

## 3. User Profile & Preferences

### Profile Settings
- [ ] Navigate to Settings → Profile
- [ ] Update first name, last name, title
- [ ] Add practice areas
- [ ] Changes persist after save

### Notification Preferences
- [ ] Navigate to Settings → Notifications
- [ ] Toggle "Recording Confirmation Emails" (default: OFF)
- [ ] Toggle persists after page refresh
- [ ] Email sent only when preference is ON

---

## 4. Case Management

### Create Case
- [ ] Click "New Case" or use Quick Record
- [ ] Fill in client name, case type, description
- [ ] Set priority level (Normal/Urgent/Deadline Soon)
- [ ] Set deadline date (optional)
- [ ] Case appears on dashboard after save

### Case List & Filters
- [ ] Dashboard shows all user's cases
- [ ] Filter by status works (Active/Archived)
- [ ] Filter by priority works
- [ ] Search by client name works
- [ ] Sort by date/priority works

### Case Detail Page
- [ ] Navigate to case detail page
- [ ] All tabs visible (Overview, Transcripts, Documents, Audit Trail)
- [ ] Case metadata displays correctly
- [ ] Quick actions work (Edit, Archive, etc.)

### Case Editing
- [ ] Edit case details
- [ ] Change priority
- [ ] Update deadline
- [ ] Changes reflect in audit trail

### Case Archiving
- [ ] Archive case from detail page
- [ ] Case moves to "Archived" filter
- [ ] Unarchive case works

---

## 5. Audio Recording & Upload

### Quick Record Flow
- [ ] Click Quick Record button (top navigation)
- [ ] Consent screen appears
- [ ] Read consent statement
- [ ] "I Confirm Client Has Consented" button works
- [ ] Recording starts after consent confirmation
- [ ] Timer displays elapsed time
- [ ] Recording indicator visible
- [ ] Stop recording button works

### Audio Quality
- [ ] Recording captures audio clearly
- [ ] Test with external microphone
- [ ] Test with built-in microphone
- [ ] Audio plays back correctly

### Chunked Upload
- [ ] Progress indicator shows during upload
- [ ] Upload completes successfully
- [ ] Audio file stored in object storage
- [ ] File path saved to database

### Recording Confirmation Email
- [ ] With preference ON: Email sent after recording completes
- [ ] With preference OFF: No email sent
- [ ] Email contains case details and timestamp

---

## 6. Consent Safeguards (NEW)

### Consent Segment Capture
- [ ] Start recording and wait 5 seconds
- [ ] Click "I Confirm Client Has Consented"
- [ ] Wait 10 more seconds and stop recording
- [ ] Consent segment preserved in object storage (`consent/` prefix)
- [ ] Consent duration stored in database (exact seconds)

### Consent Evidence Display
- [ ] Navigate to case detail page
- [ ] Find "Consent Evidence" section (near Audit Trail)
- [ ] Verify consent timestamp displays
- [ ] Verify consent duration displays (MM:SS format)
- [ ] Mini audio player loads consent segment
- [ ] Play/pause controls work
- [ ] Download button works

### Consent Preservation
- [ ] Wait 7 days (or manually check cleanup service)
- [ ] Main audio recording deleted after 7 days
- [ ] Consent segment NOT deleted (preserved indefinitely)
- [ ] Consent evidence still accessible after main audio deletion

### Timestamp Accuracy Test
| Recording Duration | Consent Click Time | Expected Duration |
|-------------------|-------------------|-------------------|
| 30 seconds | 8 seconds | 8s |
| 60 seconds | 25 seconds | 25s |
| 120 seconds | 45 seconds | 45s |

- [ ] Test 1: Record 30s, consent at 8s → Duration shows ~8s
- [ ] Test 2: Record 60s, consent at 25s → Duration shows ~25s
- [ ] Test 3: Record 2min, consent at 45s → Duration shows ~45s

### Edge Cases
- [ ] Very quick consent (< 3 seconds): Still captures segment
- [ ] No consent confirmation: Fallback 20-second segment preserved
- [ ] Recording interrupted: Consent segment still preserved if confirmed

---

## 7. Safeguards Status (Settings → Security)

### Security Tab Display
- [ ] Navigate to Settings → Security
- [ ] SafeguardsStatus component visible
- [ ] Cryptographic audit trail status shows
- [ ] Session security status shows
- [ ] Consent evidence preservation status shows

### Status Indicators
- [ ] All indicators show "Active" (green) when configured
- [ ] Descriptions accurately reflect functionality
- [ ] "Timestamp-based consent preservation" mentioned

---

## 8. Transcription

### Transcription Flow
- [ ] Navigate to case with audio recording
- [ ] Click "Transcribe Audio" button
- [ ] Processing indicator appears
- [ ] Transcription completes (2-5 minutes)
- [ ] Transcript displays in Transcripts tab

### Transcript Features
- [ ] Timestamps visible in transcript
- [ ] Speaker labels visible (if diarization enabled)
- [ ] Transcript searchable
- [ ] Copy transcript button works

### Redaction
- [ ] Redact name/text in transcript
- [ ] Redacted text replaced with [REDACTED]
- [ ] Redaction logged in audit trail

---

## 9. Document Generation

### Attendance Note
- [ ] Click "Generate Attendance Note"
- [ ] AI generates document (1-2 minutes)
- [ ] Document displays correctly
- [ ] Contains: Date, attendees, background, matters discussed, actions
- [ ] Firm branding visible in PDF export

### Client Summary
- [ ] Click "Generate Summary"
- [ ] AI generates plain-language summary
- [ ] Suitable for client understanding

### Legal Opinion
- [ ] Click "Generate Legal Opinion"
- [ ] AI generates structured opinion
- [ ] Clearly marked as draft requiring review

### Document Editing
- [ ] Edit generated document
- [ ] Save changes
- [ ] Version history tracked

### Document Status
- [ ] Mark document as "Reviewed"
- [ ] Review checklist banner appears until reviewed
- [ ] Status change logged in audit trail

---

## 10. Document Export

### PDF Export
- [ ] Click "Download PDF"
- [ ] PDF generates correctly
- [ ] Firm logo in header
- [ ] Letterhead background (if configured)
- [ ] All content formatted properly

### Word Export
- [ ] Click "Download Word"
- [ ] .docx file generates correctly
- [ ] Formatting preserved
- [ ] Editable in Microsoft Word

### Format Selection
- [ ] Export format dropdown works
- [ ] PDF and Word options available

---

## 11. Document Sharing

### Share Link Creation
- [ ] Click "Share" on document
- [ ] Fill in recipient name and email
- [ ] Set expiration (1-30 days)
- [ ] Optional: Set password
- [ ] Optional: Enable SMS 2FA
- [ ] Generate link

### Share Link Access
- [ ] Access share link URL
- [ ] If password set: Password prompt appears
- [ ] If SMS 2FA enabled: Phone number prompt appears, code sent, verification works
- [ ] Document displays to recipient
- [ ] Branding visible on share page

### Share Link Expiration
- [ ] Link expires after set duration
- [ ] Expired link shows error message

### Email Delivery
- [ ] Click "Send via Email"
- [ ] Recipient receives email
- [ ] Email contains link and instructions
- [ ] Firm branding in email

---

## 12. Calendar Integration

### Google Calendar
- [ ] Navigate to Settings → Calendar
- [ ] Click "Connect Google Calendar"
- [ ] OAuth flow completes
- [ ] Calendar syncs successfully

### Outlook Calendar
- [ ] Click "Connect Outlook"
- [ ] OAuth flow completes
- [ ] Calendar syncs successfully

### Event Sync
- [ ] Create case with deadline
- [ ] Event appears in connected calendar
- [ ] Update deadline → Calendar event updates
- [ ] Delete deadline → Calendar event removed

---

## 13. Audit Trail

### Audit Logging
- [ ] Navigate to case detail → Audit Trail tab
- [ ] All actions logged with timestamps
- [ ] User attribution on each entry
- [ ] IP addresses logged (where applicable)

### Logged Events
- [ ] Case created
- [ ] Case edited
- [ ] Recording uploaded
- [ ] Consent confirmed
- [ ] Transcript generated
- [ ] Document generated
- [ ] Document edited
- [ ] Document reviewed
- [ ] Document shared
- [ ] Document downloaded
- [ ] Case archived

### Tamper Detection
- [ ] Audit entries have cryptographic signatures
- [ ] Signature verification passes for unmodified entries

### CSV Export
- [ ] Click "Export Audit Trail"
- [ ] CSV downloads correctly
- [ ] All events included with timestamps

---

## 14. Priority & Deadline Management

### Priority System
- [ ] Set case priority (Normal/Urgent/Deadline Soon)
- [ ] Priority badge displays correctly
- [ ] Filter by priority works

### Deadline Tracking
- [ ] Set deadline on case
- [ ] Deadline displays on case card
- [ ] Calendar reminder set (if calendar connected)
- [ ] Overdue cases highlighted

---

## 15. Search & Navigation

### Global Search
- [ ] Search icon in navigation
- [ ] Search by client name
- [ ] Search by case description
- [ ] Search by document content
- [ ] Results display correctly

### Navigation
- [ ] Sidebar navigation works
- [ ] All links functional
- [ ] Active state visible

### Mobile Responsiveness
- [ ] Dashboard displays on mobile
- [ ] Navigation works on mobile
- [ ] Recording works on tablet (not phone)

---

## 16. Interactive Onboarding Tour

### Tour Launch
- [ ] Tour auto-launches on first login
- [ ] Tour highlights key features
- [ ] Skip button works
- [ ] Complete tour successfully

### Tour Restart
- [ ] Navigate to profile menu
- [ ] Click "Restart Tour"
- [ ] Tour relaunches

---

## 17. Error Handling

### Network Errors
- [ ] Offline indicator appears when disconnected
- [ ] Graceful error messages on API failures
- [ ] Retry mechanisms work

### Validation Errors
- [ ] Form validation messages display
- [ ] Invalid inputs highlighted
- [ ] Clear error descriptions

### Recording Errors
- [ ] Microphone permission denied: Clear error message
- [ ] Upload failure: Retry option available
- [ ] Browser not supported: Warning displayed

---

## 18. Performance

### Load Times
- [ ] Dashboard loads in < 3 seconds
- [ ] Case detail loads in < 2 seconds
- [ ] Documents load in < 2 seconds

### Recording Performance
- [ ] No audio dropouts during recording
- [ ] Upload progress smooth
- [ ] No browser freezing

---

## 19. Security Features

### Data Isolation
- [ ] Cannot access other users' cases
- [ ] Cannot access other users' documents
- [ ] API rejects unauthorized requests

### Session Security
- [ ] Secure cookies configured
- [ ] HTTPS enforced
- [ ] Session timeout works

### Input Sanitization
- [ ] XSS prevention (try `<script>` in forms)
- [ ] SQL injection prevention
- [ ] Path traversal prevention

---

## 20. GDPR Compliance

### Audio Retention
- [ ] Audio files deleted after 7 days
- [ ] Deletion logged in audit trail
- [ ] Consent segments preserved (not deleted)

### Share Link Cleanup
- [ ] Expired share links cleaned up daily
- [ ] Access blocked after expiration

### Data Export
- [ ] User can export their data
- [ ] All personal data included

---

## Test Completion Sign-off

**Tester Name:** _____________________

**Date:** _____________________

**Environment:** Development / Staging / Production

**Overall Status:** Pass / Fail / Partial

**Critical Issues Found:**
1. _____________________
2. _____________________
3. _____________________

**Notes:**
_____________________
_____________________
_____________________

---

## Quick Safeguards Test Script

For rapid verification of consent safeguards:

```
1. Login to application
2. Go to Settings → Notifications
   ✓ Verify "Recording Confirmation Emails" toggle exists (default OFF)
   
3. Go to Settings → Security
   ✓ Verify SafeguardsStatus component displays
   ✓ Verify "Timestamp-based consent preservation" mentioned
   
4. Click Quick Record
5. Wait exactly 12 seconds, then click "I Confirm Client Has Consented"
6. Record for 10 more seconds, then Stop
7. Save the case

8. Navigate to the case detail page
   ✓ Find "Consent Evidence" section
   ✓ Verify consent timestamp shows
   ✓ Verify consent duration shows ~12 seconds
   ✓ Verify audio player works
   ✓ Verify download button works

9. Check server logs
   ✓ Look for "[ChunkedUpload] Consent confirmed" log
   ✓ Look for "timestamp-based" in consent preservation log

Test Complete!
```

---

**Version:** 1.0
**Last Updated:** November 2024
**Covers:** MVP + Consent Safeguards
