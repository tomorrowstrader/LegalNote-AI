-- Part 4: provider-specified firm invitations (run manually on Neon before deploy).
-- Default 'google' keeps existing pending invitations valid.

ALTER TABLE firm_invitations
  ADD COLUMN IF NOT EXISTS auth_provider text NOT NULL DEFAULT 'google';
