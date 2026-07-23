import { buildSignedKeyTermsQuery } from "./server/services/keyTermsSign";

const ktExp = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;

const query = buildSignedKeyTermsQuery(
  { evaluationPeriodDays: 21, feeEarnerCount: 3, expiresAtUnix: ktExp },
  { ref: "penn-chambers" },
);

console.log("");
console.log("https://legalnote.ai/dpa?" + query);
console.log("");
