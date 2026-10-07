import type { SpellAdapter } from "@shared/ukSpellcheck";
import nspell from "nspell";

let loading: Promise<SpellAdapter> | null = null;

/**
 * Hunspell en-GB, loaded on demand so the note screen does not carry the
 * word list until someone asks for a spell check.
 */
export function loadUkSpellchecker(): Promise<SpellAdapter> {
  if (!loading) {
    loading = createUkSpellchecker().catch((error) => {
      loading = null;
      throw error;
    });
  }
  return loading;
}

async function createUkSpellchecker(): Promise<SpellAdapter> {
  const [affMod, dicMod] = await Promise.all([
    import("../../../node_modules/dictionary-en-gb/index.aff?raw"),
    import("../../../node_modules/dictionary-en-gb/index.dic?raw"),
  ]);
  const spell = nspell(affMod.default, dicMod.default);
  return {
    correct: (word) => spell.correct(word),
    suggest: (word) => spell.suggest(word),
    add: (word) => { spell.add(word); },
  };
}
