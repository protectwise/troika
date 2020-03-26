// Git commits must conform to the Conventional Commits format.
// See https://github.com/conventional-changelog/commitlint/tree/master/%40commitlint/config-conventional
// The commitlint check will be executed as a git precommit hook to enforce formatting.
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 120], //give ourselves a bit more room
    'type-enum': [
      2,
      'always',
      [
        // Ones from the base config:
        'build',
        'chore',
        'ci',
        'docs',
        'feat',
        'fix',
        'perf',
        'refactor',
        'revert',
        'style',
        'test',

        // == our custom ones: ==

        // Work in progress, where the commit shouldn't yet go into the changelog. Be careful with
        // this that you make sure there's eventually an appropriate changelog-producing commit for
        // it. If it's a partial feature that's unfinished but still possibly of interest to users,
        // consider using a true `feat:` tag but putting "WIP" or similar in the summary.
        'wip',

        // Handy when making tweaks to a feature that already had a `feat:` commit in this
        // same changelog version, where an additional changelog entry would be noisy or confusing.
        'followup'
      ]
    ]
  }
};
