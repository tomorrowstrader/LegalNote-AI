import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { isNotSupersededDemoMatter, isSupersededDemoMatter } from "./demoMatters";

describe("demoMatters", () => {
  it("hides only archived matters with a HART_ reference", () => {
    expect(isSupersededDemoMatter({ archived: true, matterReference: "HART_FAM/2024/0391" })).toBe(true);
    expect(isSupersededDemoMatter({ archived: false, matterReference: "HART_FAM/2024/0391" })).toBe(false);
    expect(isSupersededDemoMatter({ archived: true, matterReference: "SMI/2026/001" })).toBe(false);
    expect(isSupersededDemoMatter({ archived: true, matterReference: "HARTWELL/001" })).toBe(false);
    expect(isSupersededDemoMatter({ archived: true, matterReference: null })).toBe(false);
  });

  it("builds a NULL-safe SQL filter with a literal underscore", () => {
    const { sql, params } = new PgDialect().sqlToQuery(isNotSupersededDemoMatter);
    expect(sql).toContain("COALESCE");
    expect(params).toContain("HART\\_%");
  });
});
