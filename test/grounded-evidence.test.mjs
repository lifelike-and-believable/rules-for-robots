// Tests for the version-matched API lookup and the review findings check
// (docs/specs/grounded-evidence.md, slice 14a). Each test title cites the criterion it covers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { lookupNpm, lookupUnreal, run } from '../checks/api-lookup.mjs';
import { checkFindings } from '../checks/review-findings.mjs';

function tree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-grounded-'));
  for (const [file, content] of Object.entries(files)) {
    const p = path.join(root, file);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return root;
}

const project = (extra = {}) => tree({
  'package.json': { name: 'app', dependencies: { widget: '^2.0.0', '@acme/kit': '1.x' }, devDependencies: { legacy: '^1.0.0' } },
  'package-lock.json': {
    lockfileVersion: 3,
    packages: {
      '': { name: 'app' },
      'node_modules/widget': { version: '2.1.0' },
      'node_modules/@acme/kit': { version: '1.4.0' },
      'node_modules/legacy': { version: '1.0.0' },
    },
  },
  'node_modules/widget/package.json': { name: 'widget', version: '2.1.0', exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' }, './extra': { types: { default: './dist/extra.d.ts' } } } },
  'node_modules/widget/dist/index.d.ts': [
    "export { makeWidget } from './make';",
    'export interface WidgetOptions {',
    '  size?: number;',
    '  render(target: Element): void;',
    '}',
    "export * from 'widget-core';",
    '',
  ].join('\n'),
  'node_modules/widget/dist/make.d.ts': 'export declare function makeWidget(options?: WidgetOptions): Widget;\n',
  'node_modules/widget/dist/extra.d.ts': 'export declare const extra: number;\n',
  'node_modules/widget/docs/guide.md': '# Guide\n\nCall `makeWidget()` to start.\nThe `resize` option was removed in 2.0.\n',
  'node_modules/widget/README.md': '# widget\n',
  'node_modules/widget/CHANGELOG.md': '# Changes\n',
  'node_modules/widget-core/package.json': { name: 'widget-core', version: '2.1.0', types: 'index.d.ts' },
  'node_modules/widget-core/index.d.ts': 'export declare class CoreWidget {}\n',
  'node_modules/@acme/kit/package.json': { name: '@acme/kit', version: '1.4.2', main: 'index.js' },
  'node_modules/@acme/kit/index.js': 'module.exports = {};\n',
  'node_modules/@types/acme__kit/package.json': { name: '@types/acme__kit', version: '1.4.0', types: 'index.d.ts' },
  'node_modules/@types/acme__kit/index.d.ts': 'export function kitThing(): void;\n',
  'node_modules/legacy/package.json': { name: 'legacy', version: '1.0.0', main: 'index.js' },
  ...extra,
});

test('grounded-evidence#AC-1: the npm lookup reports the installed version, the lock entry, and the declared range', () => {
  const root = project();
  const r = lookupNpm({ root, name: 'widget' });
  assert.equal(r.status, 'found');
  assert.deepEqual(r.installed, { version: '2.1.0', path: 'node_modules/widget' });
  assert.equal(r.lock.file, 'package-lock.json');
  assert.equal(r.lock.version, '2.1.0');
  assert.equal(r.lock.matches, true);
  assert.deepEqual(r.declared, { field: 'dependencies', range: '^2.0.0' });

  // A scoped package whose installed version differs from the lock entry.
  const kit = run(['npm', '@acme/kit', '--root', root]);
  assert.equal(kit.report.installed.version, '1.4.2');
  assert.equal(kit.report.lock.matches, false);
  assert.match(kit.text, /package-lock\.json: 1\.4\.0 +\(differs from the installed 1\.4\.2/);
  assert.equal(kit.code, 0);

  // Found from a folder below the project root, by walking up.
  const nested = path.join(root, 'packages', 'web');
  fs.mkdirSync(nested, { recursive: true });
  assert.equal(lookupNpm({ root: nested, name: 'widget' }).installed.path, '../../node_modules/widget');

  // Not installed.
  const missing = run(['npm', 'nothing-here', '--root', root]);
  assert.equal(missing.code, 2);
  assert.equal(missing.report.status, 'not-installed');
  assert.match(missing.text, /nothing-here is not installed/);
});

test('grounded-evidence#AC-1: lockfiles the lookup does not read are named, not guessed at', () => {
  const root = tree({
    'package.json': { name: 'app', dependencies: { widget: '^2.0.0' } },
    'pnpm-lock.yaml': 'lockfileVersion: 9.0\n',
    'node_modules/widget/package.json': { name: 'widget', version: '2.1.0' },
  });
  const r = run(['npm', 'widget', '--root', root]);
  assert.equal(r.report.lock.file, null);
  assert.deepEqual(r.report.lock.notRead, ['pnpm-lock.yaml']);
  assert.match(r.text, /not read: pnpm-lock\.yaml/);
});

test('grounded-evidence#AC-2: the report lists type entries, an @types package, docs folders, README, and changelog', () => {
  const root = project();
  const widget = lookupNpm({ root, name: 'widget' });
  assert.deepEqual(widget.docs.types, ['dist/index.d.ts', 'dist/extra.d.ts']);
  assert.equal(widget.docs.typesPackage, null);
  assert.deepEqual(widget.docs.folders, ['docs']);
  assert.deepEqual(widget.docs.files, ['CHANGELOG.md', 'README.md']);

  const kit = lookupNpm({ root, name: '@acme/kit' });
  assert.deepEqual(kit.docs.types, []);
  assert.deepEqual(kit.docs.typesPackage, { name: '@types/acme__kit', version: '1.4.0', path: 'node_modules/@types/acme__kit' });
  assert.match(run(['npm', '@acme/kit', '--root', root]).text, /types: none in the package; @types\/acme__kit 1\.4\.0/);
});

test('grounded-evidence#AC-3: a symbol is found in declarations, members, re-exports, and docs, or reported as not declared', () => {
  const root = project();
  const fn = lookupNpm({ root, name: 'widget', symbol: 'makeWidget' });
  assert.equal(fn.status, 'found');
  assert.deepEqual(fn.declarations.map(d => [d.file, d.line, d.kind]), [
    ['node_modules/widget/dist/index.d.ts', 1, 'export'],
    ['node_modules/widget/dist/make.d.ts', 1, 'function'],
  ]);
  assert.match(fn.declarations[1].excerpt[0], /declare function makeWidget/);
  assert.deepEqual(fn.mentions.map(m => [m.file, m.line]), [['node_modules/widget/docs/guide.md', 3]]);

  const member = lookupNpm({ root, name: 'widget', symbol: 'WidgetOptions.render' });
  assert.deepEqual(member.declarations.map(d => [d.line, d.kind]), [[4, 'member']]);

  // Declared in a package the wrapper re-exports from.
  const core = run(['npm', 'widget', 'CoreWidget', '--root', root]);
  assert.equal(core.code, 0);
  assert.equal(core.report.declarations[0].file, 'node_modules/widget-core/index.d.ts');
  assert.match(core.text, /re-exports followed: widget-core 2\.1\.0/);

  // Declared only in the @types package.
  assert.equal(lookupNpm({ root, name: '@acme/kit', symbol: 'kitThing' }).declarations[0].file, 'node_modules/@types/acme__kit/index.d.ts');

  // Mentioned in the docs but not declared: exit 1, and the docs line is still shown.
  const gone = run(['npm', 'widget', 'resize', '--root', root]);
  assert.equal(gone.code, 1);
  assert.equal(gone.report.status, 'not-declared');
  assert.match(gone.text, /resize is not declared in the installed widget 2\.1\.0 declaration files/);
  assert.match(gone.text, /docs\/guide\.md:4/);

  // A package with no declaration files at all says nothing could be checked.
  const legacy = run(['npm', 'legacy', 'anything', '--root', root]);
  assert.equal(legacy.code, 1);
  assert.match(legacy.text, /ships no declaration files/);
});

const engine = (version, headers) => tree({
  'Engine/Build/Build.version': { MajorVersion: version[0], MinorVersion: version[1], PatchVersion: 0 },
  ...Object.fromEntries(Object.entries(headers).map(([f, c]) => [`Engine/${f}`, c])),
});

test('grounded-evidence#AC-4: the Unreal lookup reports each engine version and whether it declares the symbol', () => {
  const older = engine([5, 6], {
    'Source/Runtime/Engine/Classes/GameFramework/Actor.h': 'class ENGINE_API UWorld;\nclass ENGINE_API AActor : public UObject\n{\n\tvoid OldThing();\n};\n',
    'Source/Runtime/Core/Public/Misc/Fwd.h': 'class FNewThing;\n',
    'Source/ThirdParty/Lib/lib.h': 'class FNewThing {};\n',
  });
  const newer = engine([5, 8], {
    'Source/Runtime/Engine/Classes/GameFramework/Actor.h': 'class ENGINE_API AActor : public UObject\n{\n\tvoid NewThing(int32 Count);\n};\n',
    'Source/Runtime/Core/Public/Misc/NewThing.h': 'struct CORE_API FNewThing\n{\n};\n#define UE_NEW_MACRO 1\nenum class ENewMode : uint8\n{\n};\n',
    'Plugins/Runtime/Extra/Source/Extra/Public/Extra.h': 'using FExtraHandle = int32;\n',
  });

  const r = lookupUnreal({ symbol: 'FNewThing', engines: [older, newer] });
  assert.equal(r.status, 'not-declared');
  assert.deepEqual(r.engines.map(e => [e.version, e.status]), [['5.6.0', 'not-declared'], ['5.8.0', 'found']]);
  assert.deepEqual(r.missingIn, ['5.6.0']);
  assert.deepEqual(r.engines[1].declarations.map(d => [d.file, d.line, d.kind]), [['Source/Runtime/Core/Public/Misc/NewThing.h', 1, 'class']]);

  // Macros, enums, and aliases under Plugins.
  assert.equal(lookupUnreal({ symbol: 'UE_NEW_MACRO', engines: [newer] }).engines[0].declarations[0].kind, 'macro');
  assert.equal(lookupUnreal({ symbol: 'ENewMode', engines: [newer] }).engines[0].declarations[0].kind, 'enum');
  assert.equal(lookupUnreal({ symbol: 'FExtraHandle', engines: [newer] }).engines[0].declarations[0].kind, 'alias');

  // Class::Member is looked up only in files that declare the class.
  const member = lookupUnreal({ symbol: 'AActor::NewThing', engines: [older, newer] });
  assert.deepEqual(member.engines.map(e => e.status), ['not-declared', 'found']);
  assert.equal(member.engines[1].declarations[0].kind, 'function');

  // Engines come from RFR_UE_ROOTS when no --engine is given; the given dir may be the Engine folder.
  const viaEnv = run(['unreal', 'FNewThing'], { RFR_UE_ROOTS: [older, path.join(newer, 'Engine')].join(path.delimiter) });
  assert.equal(viaEnv.code, 1);
  assert.match(viaEnv.text, /Missing in 5\.6\.0: wrap its use/);
  assert.equal(run(['unreal', 'AActor', '--engine', older, '--engine', newer]).code, 0);
  assert.equal(run(['unreal', 'AActor'], {}).code, 2);
});

test('grounded-evidence#AC-5: --json prints the report as JSON, and the scripts need nothing but Node', () => {
  const root = project();
  const npm = spawnSync(process.execPath, ['checks/api-lookup.mjs', 'npm', 'widget', 'makeWidget', '--root', root, '--json'], { encoding: 'utf8' });
  assert.equal(npm.status, 0, npm.stderr);
  const n = JSON.parse(npm.stdout);
  assert.equal(n.kind, 'npm');
  assert.equal(n.installed.version, '2.1.0');
  assert.equal(n.declarations.length, 2);
  for (const key of ['lock', 'declared', 'docs', 'mentions', 'status']) assert.ok(key in n, key);

  const e = engine([5, 7], { 'Source/Runtime/Core/Public/X.h': 'class CORE_API FThing {};\n' });
  const ue = spawnSync(process.execPath, ['checks/api-lookup.mjs', 'unreal', 'FThing', '--engine', e, '--json'], { encoding: 'utf8' });
  assert.equal(ue.status, 0, ue.stderr);
  const u = JSON.parse(ue.stdout);
  assert.equal(u.kind, 'unreal');
  assert.equal(u.engines[0].version, '5.7.0');
  assert.equal(u.engines[0].declarations[0].kind, 'class');

  for (const script of ['checks/api-lookup.mjs', 'checks/review-findings.mjs']) {
    const imports = [...fs.readFileSync(script, 'utf8').matchAll(/^import .* from '([^']+)'/gm)].map(m => m[1]);
    assert.ok(imports.every(i => i.startsWith('node:')), `${script} imports only node: modules, got ${imports.join(', ')}`);
    assert.doesNotMatch(fs.readFileSync(script, 'utf8'), /\b(fetch|https?\.request|writeFileSync|rmSync|unlinkSync)\(/, `${script} reads only`);
  }
});

const GOOD = `Findings, most severe first:

- [major] src/api.ts:12, WA-006
  Problem: calls \`client.fetchAll\`, which the installed client does not have.
  Failure scenario: the type check fails, and at runtime the call throws.
  Fix: use \`client.list\`.
  Basis: observed. Ran \`npm run typecheck\`; src/api.ts:12 reports TS2339.
- [minor] src/form.tsx:40, no rule
  Problem: the handler reads \`event.target.value\` when the value can be empty.
  Failure scenario: an empty submit
    stores an empty name.
  Fix: return early on an empty value.
  Basis: inferred. Did not check whether the form's required attribute already blocks an empty submit.
`;

test('grounded-evidence#AC-8: well-formed findings are parsed with their basis, places, and inferred list', () => {
  const r = checkFindings(GOOD);
  assert.equal(r.ok, true);
  assert.equal(r.count, 2);
  assert.equal(r.observed, 1);
  assert.deepEqual(r.inferred, [2]);
  const [a, b] = r.findings;
  assert.deepEqual([a.severity, a.file, a.line, a.rule, a.basis], ['major', 'src/api.ts', 12, 'WA-006', 'observed']);
  assert.deepEqual(a.places, [{ file: 'src/api.ts', line: 12 }]);
  assert.equal(b.rule, 'no rule');
  assert.equal(b.basis, 'inferred');
  assert.match(b.basisDetail, /required attribute/);
  assert.deepEqual(b.places, []);
});

test('grounded-evidence#AC-8: a missing, unknown, or empty basis and an unknown severity are errors', () => {
  const bad = `- [major] a.ts:1, no rule
  Problem: p.
  Fix: f.
- [minor] b.ts:2, no rule
  Problem: p.
  Basis: guessed from the name.
- [nit] c.ts:3, no rule
  Problem: p.
  Basis: observed.
- [high] d.ts:4, no rule
  Problem: p.
  Basis: inferred: did not run it.
`;
  const r = checkFindings(bad);
  assert.equal(r.ok, false);
  assert.deepEqual(r.findings.map(f => f.errors.length), [1, 1, 1, 1]);
  assert.match(r.findings[0].errors[0], /no Basis: line/);
  assert.match(r.findings[1].errors[0], /neither observed nor inferred/);
  assert.match(r.findings[2].errors[0], /observed but not what was run or read/);
  assert.match(r.findings[3].errors[0], /unknown severity "high"/);

  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-findings-')), 'bad.md');
  fs.writeFileSync(file, bad);
  const cli = spawnSync(process.execPath, ['checks/review-findings.mjs', 'check', file], { encoding: 'utf8' });
  assert.equal(cli.status, 1);
  assert.match(cli.stdout, /Send the findings with errors back to the reviewer/);
});

test('grounded-evidence#AC-8: a no-findings reply passes, and a task list in it is not taken for findings', () => {
  const none = 'No findings. Checked:\n\n- [x] auth paths\n- [ ] not applicable: migrations\n';
  const r = checkFindings(none);
  assert.equal(r.ok, true);
  assert.equal(r.count, 0);
  const cli = spawnSync(process.execPath, ['checks/review-findings.mjs', 'check', '-'], { input: none, encoding: 'utf8' });
  assert.equal(cli.status, 0);
  assert.match(cli.stdout, /No findings/);
});

test('grounded-evidence#AC-8: --json prints the result as JSON', () => {
  const cli = spawnSync(process.execPath, ['checks/review-findings.mjs', 'check', '-', '--json'], { input: GOOD, encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  const r = JSON.parse(cli.stdout);
  assert.deepEqual(Object.keys(r), ['ok', 'count', 'observed', 'inferred', 'findings']);
  assert.deepEqual(Object.keys(r.findings[0]), ['index', 'severity', 'citation', 'file', 'line', 'rule', 'problem', 'basis', 'basisDetail', 'places', 'errors']);
});
