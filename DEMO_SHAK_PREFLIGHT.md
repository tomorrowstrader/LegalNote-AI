# Shak Demo — Preflight Functionality Test

**When:** night before / morning of demo  
**Goal:** prove the golden path + new in-meeting notes before you present  
**Target runtime:** ~25–35 min if everything is green; stop and fix blockers first

---

## 0. Setup (5 min)

| Check | Pass? | Notes |
|-------|-------|-------|
| App loads (prod or stable demo env) | [ ] | |
| Logged in as demo account (`accessAllowed`) | [ ] | Avoid waitlist / pending approval |
| At least 1 sample matter with client name | [ ] | Prefer a clean “demo” matter |
| Mic permission granted in browser | [ ] | Chrome preferred |
| LiveBot backend healthy (if showing Join Meeting) | [ ] | Have a Meet/Zoom/Teams URL ready |
| Host can admit bot from waiting room | [ ] | Second device / second person if needed |
| Calendar connected (optional) | [ ] | Skip if not set up — don’t demo cold |

**Do not demo (flags off):** AML pack, SRA readiness, supervision, firm compliance, case handover, PI defence.

**Fallback if live infra fails:** `/demo/family` (or relevant practice area) showroom walkthrough.

---

## 1. Must-pass — NEW: in-meeting typed notes

These are the recent changes. Failures here are high risk for tomorrow.

### 1A. New Session + inline notes
1. [ ] Open matter → **Sessions** → **Record New Session**
2. [ ] Complete consent → recording starts
3. [ ] Type notes in the inline notes panel (use a timestamp / snippet once)
4. [ ] **Stop and Save**
5. [ ] Open **Notes** section → entry appears with **From meeting** badge
6. [ ] Content matches what you typed (prefixed meeting-notes format)

### 1B. Add Note (append, not overwrite)
1. [ ] Matter → **Notes** → **Add Note** (typed)
2. [ ] Save
3. [ ] Appears as **Note** in the list
4. [ ] Previous meeting note still present (not wiped)

### 1C. LiveBot + floating notes (matter linked)
1. [ ] Case Actions → **Join with LegalNote** (or join with matter selected)
2. [ ] Paste real meeting URL → send bot → admit from waiting room
3. [ ] Close modal if needed → floating status + **Notes** still available
4. [ ] Type notes during recording
5. [ ] End call → toast **Meeting notes saved** (or equivalent)
6. [ ] Matter **Notes** shows new **From meeting** entry
7. [ ] Meeting-to-Matter produces attendance note / docs on the matter

### 1D. LiveBot allocate-later (if you show Dashboard Join)
1. [ ] Dashboard → **Join Meeting** (no matter)
2. [ ] Type notes during call
3. [ ] End call → assign from Dashboard unassigned list
4. [ ] Notes land on the assigned matter
5. [ ] Confirm discard path does **not** create notes (know the behaviour; don’t demo discard unless asked)

---

## 2. Must-pass — core product (demo narrative)

Run these even if notes are green — this is what Shak should feel.

| # | Flow | Pass? |
|---|------|-------|
| 2.1 | Login (Google and/or Microsoft) → Dashboard | [ ] |
| 2.2 | Open sample matter — Documents / Sessions / Notes / Consent all load | [ ] |
| 2.3 | **New Note** *or* Quick Record (Ctrl/Cmd+L) → consent → short record → stop → processing starts | [ ] |
| 2.4 | Processing completes → attendance note (+ summary/transcript) on matter | [ ] |
| 2.5 | Open attendance note in DocumentViewer → edit a line → save | [ ] |
| 2.6 | Export Word and/or PDF | [ ] |
| 2.7 | Secure Share → open `/share/:linkId` in private/incognito as “client” | [ ] |
| 2.8 | Consent record visible / explainable on the matter | [ ] |

**Pick one capture path for the live demo:** either short mic recording **or** LiveBot — rehearse that one cold, don’t rely on both.

---

## 3. Strong extras (only if time + already working)

| Flow | Pass? | Skip if… |
|------|-------|----------|
| Voice quick note → transcribe → save | [ ] | Mic flaky |
| Schedule meeting + Meet/Teams link | [ ] | Calendar not connected |
| Upcoming list → Join / Send Consent | [ ] | No upcoming events |
| UpcomingMeetingPrompt (join-now window) | [ ] | Timing awkward |
| Upload transcript / Generate docs on pending session | [ ] | No pending session |
| Log a Call | [ ] | Not in demo script |

---

## 4. Known tripwires (fix or avoid in demo)

| Risk | Mitigation |
|------|------------|
| Bot stuck in waiting room | Admit LegalNote immediately; have backup mic recording |
| Meeting notes lost (tab closed before flush) | Keep same tab; don’t hard-refresh mid-call |
| Allocate-later notes only flush on assign | Assign on Dashboard before talking about Notes |
| Processing stalls | Have a pre-processed matter ready to open (“meeting from earlier”) |
| Safari MIME / mic quirks | Use Chrome |
| Recovery modals blocking UI | Clear stuck `RecordingRecovery` / `VideoBotRecovery` before demo |
| Feature-flagged nav missing | Don’t script AML / SRA / handover |

---

## 5. Demo run order (suggested ~5–8 min)

Use this once preflight is green.

1. **Problem open** — “finished the meeting, reconstructing from scribbles”
2. **Open prepared matter** — show file already has structure (Documents / Consent)
3. **Capture** — one LiveBot *or* New Session; type 1–2 solicitor notes live
4. **Landing** — attendance note opens; point at solicitor-controlled review
5. **Notes** — show typed meeting notes under Notes (“your words, on the file”)
6. **Share** — secure client link (optional if time tight)
7. **Stop** — leave them wanting more; don’t tour every tab

---

## 6. Go / no-go

**GO if:**
- [ ] One capture path works end-to-end (record → process → attendance note)
- [ ] At least one meeting-notes path works (New Session **or** LiveBot → Notes list)
- [ ] Document open + light edit works
- [ ] Fallback `/demo/...` verified once

**NO-GO / soft demo if:**
- LiveBot or AI processing is down → use pre-processed matter + Public Demo for the “join” story; still show Notes list + Add Note if those work

---

## Quick smoke (10 min version)

If short on time, only do this:

1. [ ] Login → open matter  
2. [ ] New Session: record 20s + type notes → save → Notes shows **From meeting**  
3. [ ] Add Note → list appends  
4. [ ] Open existing attendance note → export PDF  
5. [ ] Open `/demo/family` once (fallback confirmed)
