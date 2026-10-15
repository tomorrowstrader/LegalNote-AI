import { describe, expect, it } from "vitest";
import { PRACTICE_AREAS } from "@shared/schema";
import { getPracticeAreaPromptContext } from "./practiceAreaConfig";

describe("practice area attendance prompt", () => {
  it("does not assign an AML risk level", () => {
    for (const area of PRACTICE_AREAS) {
      const prompt = getPracticeAreaPromptContext(area);
      expect(prompt.toLowerCase()).not.toContain("aml risk");
      expect(prompt).not.toMatch(/HIGH AML|LOW AML/);
    }
  });
});
