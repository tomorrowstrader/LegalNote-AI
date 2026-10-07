import { describe, expect, it } from "vitest";
import { isEditorHtml, repairNameAutolinks } from "./editorHtml";

describe("editor html", () => {
  it("recognises a TipTap document and leaves markdown alone", () => {
    expect(isEditorHtml("<p><strong>ATTENDANCE NOTE</strong></p>")).toBe(true);
    expect(isEditorHtml('  <ul class="tight" data-tight="true"><li><p>One</p></li></ul>')).toBe(true);
    expect(isEditorHtml("**ATTENDANCE NOTE**\n\n**File Ref:** TBD")).toBe(false);
  });

  it("restores a name that was linked as a Norway domain", () => {
    const html = '<p>to date. <a target="_blank" rel="noopener noreferrer nofollow" href="http://Jen.No">No</a> official instruction</p>';
    expect(repairNameAutolinks(html)).toBe("<p>to date. Jen. No official instruction</p>");
    expect(repairNameAutolinks('<p><a href="http://Jen.No">Jen.No</a></p>')).toBe("<p>Jen. No</p>");
  });

  it("leaves real links alone", () => {
    const html = '<p>See <a href="https://www.lawsociety.org.uk/">the Law Society</a> and <a href="https://legalnote.ai/start">LegalNote</a>.</p>';
    expect(repairNameAutolinks(html)).toBe(html);
  });
});
