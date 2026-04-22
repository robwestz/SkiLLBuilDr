module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",     // new feature or builder
        "fix",      // bug fix
        "refactor", // no behaviour change
        "test",     // tests only
        "chore",    // build, CI, deps, docs, config
        "perf",     // performance improvement
        "revert",   // revert a previous commit
      ],
    ],
    "header-max-length": [2, "always", 100],
    "subject-full-stop": [2, "never", "."],
    // AI agents write detailed bodies — don't limit line length
    "body-max-line-length": [0, "always", Infinity],
  },
};
