declare module "nspell" {
  interface UkSpell {
    correct(word: string): boolean;
    suggest(word: string): string[];
    add(word: string): void;
  }
  function nspell(aff: string, dic: string): UkSpell;
  export default nspell;
}
