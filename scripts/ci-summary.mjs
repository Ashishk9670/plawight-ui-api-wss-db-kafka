// Turns the merged Playwright JSON report into a Markdown summary.
// Usage: node scripts/ci-summary.mjs merged.json > summary.md
import fs from 'node:fs';

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.log(
    '## Playwright results\n\nNo merged report was produced (all test jobs were skipped or failed to start).',
  );
  process.exit(0);
}

const report = JSON.parse(fs.readFileSync(file, 'utf8'));
const byProject = new Map();
const problems = [];
const flaky = [];

const count = (project, key) => {
  const row = byProject.get(project) ?? { passed: 0, failed: 0, flaky: 0, skipped: 0 };
  row[key]++;
  byProject.set(project, row);
};

function walk(suite, titles = []) {
  const here = suite.title && !suite.file ? [...titles, suite.title] : titles;
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const name = [...here, spec.title].filter(Boolean).join(' › ');
      const where = `${spec.file}:${spec.line}`;
      switch (test.status) {
        case 'expected':
          count(test.projectName, 'passed');
          break;
        case 'skipped':
          count(test.projectName, 'skipped');
          break;
        case 'flaky':
          count(test.projectName, 'flaky');
          flaky.push({ project: test.projectName, name, where, retries: test.results.length - 1 });
          break;
        default: {
          count(test.projectName, 'failed');
          const error = test.results.at(-1)?.error?.message?.split('\n')[0] ?? '';
          problems.push({ project: test.projectName, name, where, error });
        }
      }
    }
  }
  for (const child of suite.suites ?? []) walk(child, here);
}
for (const suite of report.suites ?? []) walk(suite);

const total = [...byProject.values()].reduce(
  (acc, r) => ({
    passed: acc.passed + r.passed,
    failed: acc.failed + r.failed,
    flaky: acc.flaky + r.flaky,
    skipped: acc.skipped + r.skipped,
  }),
  { passed: 0, failed: 0, flaky: 0, skipped: 0 },
);
const seconds = Math.round((report.stats?.duration ?? 0) / 1000);
const icon = total.failed ? '❌' : total.flaky ? '⚠️' : '✅';

const lines = [
  `## ${icon} Playwright results`,
  '',
  `**${total.passed} passed**, ${total.failed} failed, ${total.flaky} flaky, ${total.skipped} skipped in ${seconds}s`,
  '',
  '| Project | Passed | Failed | Flaky | Skipped |',
  '|---|---:|---:|---:|---:|',
  ...[...byProject.entries()]
    .sort()
    .map(([p, r]) => `| ${p} | ${r.passed} | ${r.failed} | ${r.flaky} | ${r.skipped} |`),
];

if (problems.length) {
  lines.push(
    '',
    '### Failures',
    '',
    ...problems.map((p) => `- \`${p.project}\` ${p.name} (\`${p.where}\`)${p.error ? `: ${p.error}` : ''}`),
  );
}
if (flaky.length) {
  lines.push(
    '',
    '### Flaky (passed only after a retry)',
    '',
    ...flaky.map(
      (f) => `- \`${f.project}\` ${f.name} (\`${f.where}\`), ${f.retries} retr${f.retries === 1 ? 'y' : 'ies'}`,
    ),
  );
}
lines.push('', 'Artifacts: `playwright-report` (HTML with traces) and `allure-report` on this run.');
console.log(lines.join('\n'));
