export default [
  {
    files: ["server/**/*.ts"],
    ignores: ["server/logSanitize.ts"],
    rules: {
      "no-console": "error",
    },
  },
];
