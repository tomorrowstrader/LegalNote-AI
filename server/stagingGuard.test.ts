import { describe, expect, it } from "vitest";
import {
  isStaging,
  stagingAllowedRecipients,
  stagingBlocksSms,
  stagingIsolationProblems,
  unmarkedStagingProblem,
} from "./stagingGuard";

const MARKER = "legalnote.environment=development";

const goodStaging = {
  NODE_ENV: "production",
  LEGALNOTE_ENVIRONMENT: "staging",
  APP_URL: "https://legalnote-staging.up.railway.app",
  STRIPE_SECRET_KEY: "sk_test_abc",
  STRIPE_PUBLISHABLE_KEY: "pk_test_abc",
  BACKBLAZE_BUCKET_NAME: "legalnote-staging-audio",
};

describe("isStaging", () => {
  it("is on only when LEGALNOTE_ENVIRONMENT is staging", () => {
    expect(isStaging({ LEGALNOTE_ENVIRONMENT: "staging" })).toBe(true);
    expect(isStaging({ LEGALNOTE_ENVIRONMENT: " Staging " })).toBe(true);
    expect(isStaging({ LEGALNOTE_ENVIRONMENT: "production" })).toBe(false);
    expect(isStaging({})).toBe(false);
  });
});

describe("stagingIsolationProblems", () => {
  it("lets a fully isolated staging server start", () => {
    expect(stagingIsolationProblems({ env: goodStaging, marker: MARKER })).toEqual([]);
  });

  it("refuses the live database (no marker) and an unreadable marker", () => {
    expect(stagingIsolationProblems({ env: goodStaging, marker: null })).toHaveLength(1);
    expect(stagingIsolationProblems({ env: goodStaging, marker: undefined })).toHaveLength(1);
    expect(stagingIsolationProblems({ env: goodStaging, marker: "production" })).toHaveLength(1);
  });

  it("refuses the live web address or a missing one", () => {
    expect(stagingIsolationProblems({ env: { ...goodStaging, APP_URL: "https://legalnote.ai" }, marker: MARKER })).toHaveLength(1);
    expect(stagingIsolationProblems({ env: { ...goodStaging, APP_URL: "https://www.legalnote.ai/x" }, marker: MARKER })).toHaveLength(1);
    expect(stagingIsolationProblems({ env: { ...goodStaging, APP_URL: undefined }, marker: MARKER })).toHaveLength(1);
  });

  it("refuses live Stripe keys", () => {
    expect(stagingIsolationProblems({ env: { ...goodStaging, STRIPE_SECRET_KEY: "sk_live_x" }, marker: MARKER })).toHaveLength(1);
    expect(stagingIsolationProblems({ env: { ...goodStaging, STRIPE_SECRET_KEY: "rk_live_x" }, marker: MARKER })).toHaveLength(1);
    expect(stagingIsolationProblems({ env: { ...goodStaging, STRIPE_PUBLISHABLE_KEY: "pk_live_x" }, marker: MARKER })).toHaveLength(1);
  });

  it("refuses a storage bucket that is not the staging one", () => {
    expect(stagingIsolationProblems({ env: { ...goodStaging, BACKBLAZE_BUCKET_NAME: "legalnote-audio" }, marker: MARKER })).toHaveLength(1);
  });

  it("refuses live document signing but allows the DocuSign demo account", () => {
    expect(stagingIsolationProblems({
      env: { ...goodStaging, DPA_SIGNING_ENABLED: "true", DOCUSIGN_BASE_PATH: "https://eu.docusign.net/restapi" },
      marker: MARKER,
    })).toHaveLength(1);
    expect(stagingIsolationProblems({ env: { ...goodStaging, DPA_SIGNING_ENABLED: "true" }, marker: MARKER })).toEqual([]);
  });

  it("refuses the seal bypass connection", () => {
    expect(stagingIsolationProblems({ env: { ...goodStaging, SEAL_BYPASS_DATABASE_URL: "postgres://x" }, marker: MARKER })).toHaveLength(1);
  });
});

describe("unmarkedStagingProblem", () => {
  it("stops a production server on the test database without staging mode", () => {
    expect(unmarkedStagingProblem({ env: { NODE_ENV: "production" }, marker: MARKER })).not.toBeNull();
  });

  it("never stops live on its own database, or when the marker cannot be read", () => {
    expect(unmarkedStagingProblem({ env: { NODE_ENV: "production" }, marker: null })).toBeNull();
    expect(unmarkedStagingProblem({ env: { NODE_ENV: "production" }, marker: undefined })).toBeNull();
  });

  it("does not apply to staging or to local development", () => {
    expect(unmarkedStagingProblem({ env: goodStaging, marker: MARKER })).toBeNull();
    expect(unmarkedStagingProblem({ env: { NODE_ENV: "development" }, marker: MARKER })).toBeNull();
  });
});

describe("stagingAllowedRecipients", () => {
  const staging = { LEGALNOTE_ENVIRONMENT: "staging", STAGING_EMAIL_ALLOWLIST: "qa@legalnote.ai, @mailinator-test.example" };

  it("holds back everyone not on the tester list", () => {
    expect(stagingAllowedRecipients(["client@gmail.com"], staging)).toEqual({ allowed: [], suppressed: ["client@gmail.com"] });
  });

  it("lets listed addresses and domains through, case-insensitively and in display-name form", () => {
    const result = stagingAllowedRecipients(
      ["QA@LegalNote.ai", "Tester <x@mailinator-test.example>", "partner@firm.co.uk"],
      staging,
    );
    expect(result.allowed).toEqual(["QA@LegalNote.ai", "Tester <x@mailinator-test.example>"]);
    expect(result.suppressed).toEqual(["partner@firm.co.uk"]);
  });

  it("does not match a domain by its ending alone", () => {
    expect(stagingAllowedRecipients(["a@evil-mailinator-test.example"], staging).allowed).toEqual([]);
  });

  it("holds back everything when the list is empty", () => {
    expect(stagingAllowedRecipients(["qa@legalnote.ai"], { LEGALNOTE_ENVIRONMENT: "staging" }).allowed).toEqual([]);
  });

  it("changes nothing on live", () => {
    expect(stagingAllowedRecipients(["client@gmail.com"], {})).toEqual({ allowed: ["client@gmail.com"], suppressed: [] });
  });
});

describe("stagingBlocksSms", () => {
  it("blocks all SMS on staging only", () => {
    expect(stagingBlocksSms({ LEGALNOTE_ENVIRONMENT: "staging" })).toBe(true);
    expect(stagingBlocksSms({})).toBe(false);
  });
});
