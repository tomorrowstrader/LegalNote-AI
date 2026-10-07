import { createRequire } from "node:module";
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  addSpellVocabulary,
  isSpellingAccepted,
  spellingIssuesInSegments,
  spellingSuggestions,
  type SpellAdapter,
} from "./ukSpellcheck";

const require = createRequire(import.meta.url);

function fakeSpell(words: string[]): SpellAdapter {
  const dict = new Set(words.map((word) => word.toLowerCase()));
  return {
    correct(word) {
      return dict.has(word.toLowerCase());
    },
    suggest(word) {
      if (word === "recieve") return ["receive", "relieve"];
      if (word === "color") return ["colour"];
      return [];
    },
    add(word) {
      dict.add(word.toLowerCase());
    },
  };
}

describe("UK spelling review", () => {
  const spell = fakeSpell(["receive", "colour", "the", "client", "will", "advice", "full", "time", "practice"]);

  it("accepts a known UK spelling and a hyphen whose parts are known", () => {
    expect(isSpellingAccepted("colour", spell)).toBe(true);
    expect(isSpellingAccepted("full-time", spell)).toBe(true);
    expect(isSpellingAccepted("client's", spell)).toBe(true);
  });

  it("rejects a misspelling and an American spelling that is not in the word list", () => {
    expect(isSpellingAccepted("recieve", spell)).toBe(false);
    expect(isSpellingAccepted("color", spell)).toBe(false);
  });

  it("skips short abbreviations and points at each remaining word", () => {
    const issues = spellingIssuesInSegments(
      [
        { text: "The NMC client will recieve colour advice.", from: 0 },
        { text: "recieve", from: 80, skip: true },
      ],
      spell,
    );
    expect(issues.map((issue) => issue.word)).toEqual(["recieve"]);
    expect(issues[0]).toMatchObject({ from: 20, to: 27 });
    expect(spellingSuggestions("recieve", spell)).toEqual(["receive", "relieve"]);
  });

  it("learns a client name so it is not flagged", () => {
    const local = fakeSpell(["the", "met"]);
    addSpellVocabulary(local, ["Jazz Adeyemi"]);
    const issues = spellingIssuesInSegments([{ text: "Jazz met the client.", from: 0 }], local);
    expect(issues.map((issue) => issue.word)).toEqual(["client"]);
  });

  it("checks against the UK English word list", () => {
    const nspell = require("nspell") as (aff: Buffer, dic: Buffer) => SpellAdapter;
    const spell = nspell(
      fs.readFileSync("node_modules/dictionary-en-gb/index.aff"),
      fs.readFileSync("node_modules/dictionary-en-gb/index.dic"),
    );
    expect(spell.correct("colour")).toBe(true);
    expect(spell.correct("color")).toBe(false);
    expect(isSpellingAccepted("NMC", spell)).toBe(true);
    expect(isSpellingAccepted("recieve", spell)).toBe(false);
    expect(spellingSuggestions("organize", spell)[0]).toBe("organise");
  });
});
