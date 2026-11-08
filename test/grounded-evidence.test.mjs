// Tests for the version-matched API lookup and the review findings check
// (docs/specs/grounded-evidence.md, slice 14a). Each test title cites the criterion it covers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { lookupNpm, lookupUnreal, run } from '../checks/api-lookup.mjs';
import { checkFindings, formatResult } from '../checks/review-findings.mjs';

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

  // A package with no declaration files at all could not be checked: exit 3, not "not declared".
  const legacy = run(['npm', 'legacy', 'anything', '--root', root]);
  assert.equal(legacy.code, 3);
  assert.equal(legacy.report.status, 'unchecked');
  assert.match(legacy.text, /ships no declaration files, so anything could not be checked/);
});

test('grounded-evidence#AC-3: Type.member is found only inside Type, and comment lines are not declarations', () => {
  const root = project({
    'node_modules/widget/dist/doc.d.ts': [
      '/**',
      ' * function* parse(source: string) {',
      ' */',
      'export declare class Doc {',
      '  toJS(): unknown;',
      '}',
      'export declare function parse(src: string): Doc;',
      'export declare const doc: Doc;',
      '',
    ].join('\n'),
  });
  const member = run(['npm', 'widget', 'Doc.toJS', '--root', root]);
  assert.equal(member.code, 0);
  assert.deepEqual(member.report.declarations.map(d => [d.line, d.kind]), [[5, 'member']]);
  assert.match(member.text, /toJS in Doc: 1 declaration/);

  // parse exists, but not as a member of Doc.
  const wrong = run(['npm', 'widget', 'Doc.parse', '--root', root]);
  assert.equal(wrong.code, 1);
  assert.match(wrong.text, /Doc is declared in the installed widget 2\.1\.0, but has no member parse/);
  assert.equal(run(['npm', 'widget', 'Nothing.parse', '--root', root]).code, 1);
  // A member of a value: the lookup does not follow the value's type, so it cannot say.
  assert.equal(run(['npm', 'widget', 'doc.toJS', '--root', root]).code, 3);

  // The JSDoc line ` * function* parse(` is not a declaration.
  const plain = lookupNpm({ root, name: 'widget', symbol: 'parse' });
  assert.deepEqual(plain.declarations.map(d => [d.file, d.line]), [['node_modules/widget/dist/doc.d.ts', 7]]);

  // An empty part or a path is a usage error, not "declared everywhere".
  for (const bad of ['Doc.', '.toJS', 'a.b.c', '../x']) assert.equal(run(['npm', 'widget', bad, '--root', root]).code, 2, bad);
});

test('grounded-evidence#AC-3: a named re-export is followed only for the names it re-exports, and @types of untyped targets are searched', () => {
  const root = tree({
    'package.json': { name: 'app', dependencies: { ui: '1.0.0' } },
    'node_modules/ui/package.json': { name: 'ui', version: '1.0.0', types: 'index.d.ts' },
    'node_modules/ui/index.d.ts': "export { useState } from 'react';\nexport * from 'untyped';\n",
    'node_modules/react/package.json': { name: 'react', version: '19.0.0', types: 'index.d.ts' },
    'node_modules/react/index.d.ts': 'export declare function useState(): void;\nexport declare function useEffect(): void;\n',
    'node_modules/untyped/package.json': { name: 'untyped', version: '2.0.0', main: 'index.js' },
    'node_modules/@types/untyped/package.json': { name: '@types/untyped', version: '2.0.1', types: 'index.d.ts' },
    'node_modules/@types/untyped/index.d.ts': 'export declare function helper(): void;\n',
  });
  assert.equal(run(['npm', 'ui', 'useState', '--root', root]).code, 0);
  // ui does not re-export useEffect, even though react declares it.
  assert.equal(run(['npm', 'ui', 'useEffect', '--root', root]).code, 1);
  const helper = run(['npm', 'ui', 'helper', '--root', root]);
  assert.equal(helper.code, 0);
  assert.equal(helper.report.declarations[0].file, 'node_modules/@types/untyped/index.d.ts');
  assert.match(helper.text, /re-exports followed: @types\/untyped 2\.0\.1/);
});

test('grounded-evidence#AC-1: the lock entry is found from a workspace member, and npm-shrinkwrap.json wins', () => {
  const root = tree({
    'package.json': { name: 'mono', workspaces: ['packages/*'] },
    'package-lock.json': { lockfileVersion: 3, packages: { 'node_modules/ui': { version: '1.0.0' } } },
    'packages/web/package.json': { name: 'web', dependencies: { ui: '^1.0.0' } },
    'node_modules/ui/package.json': { name: 'ui', version: '1.0.0' },
  });
  const r = lookupNpm({ root: path.join(root, 'packages', 'web'), name: 'ui' });
  assert.deepEqual([r.lock.file, r.lock.version, r.lock.matches], ['../../package-lock.json', '1.0.0', true]);
  assert.deepEqual(r.declared, { field: 'dependencies', range: '^1.0.0' });

  fs.writeFileSync(path.join(root, 'npm-shrinkwrap.json'), JSON.stringify({ lockfileVersion: 3, packages: { 'node_modules/ui': { version: '0.9.0' } } }));
  const s = lookupNpm({ root, name: 'ui' });
  assert.deepEqual([s.lock.file, s.lock.version, s.lock.notRead], ['npm-shrinkwrap.json', '0.9.0', ['package-lock.json']]);
  assert.match(run(['npm', 'ui', '--root', fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-nolock-'))]).text, /not installed/);
});

test('grounded-evidence#AC-5: package files are untrusted: no symlinks out of the package, no special or huge files, no slow lines', { skip: process.platform === 'win32' }, () => {
  const root = project();
  const secret = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-secret-')), 'creds.txt');
  fs.writeFileSync(secret, 'makeWidget SECRET=abc123\n');
  const pkg = path.join(root, 'node_modules', 'widget');
  fs.symlinkSync(path.dirname(secret), path.join(pkg, 'docs', 'linked'));
  fs.symlinkSync(secret, path.join(pkg, 'README.txt'));
  fs.rmSync(path.join(pkg, 'README.md'));
  fs.symlinkSync(secret, path.join(pkg, 'README.md'));
  const r = run(['npm', 'widget', 'makeWidget', '--root', root]);
  assert.equal(r.code, 0);
  assert.doesNotMatch(r.text, /SECRET/);
  assert.ok(!r.report.docs.files.includes('README.md'), 'a symlinked README is not listed');

  // A FIFO README would block a read; it is skipped.
  spawnSync('mkfifo', [path.join(pkg, 'CHANGES')]);
  assert.equal(run(['npm', 'widget', 'makeWidget', '--root', root]).code, 0);

  // A very long line with many unclosed `export {` does not stall the patterns.
  fs.writeFileSync(path.join(pkg, 'dist', 'slow.d.ts'), `${'export {makeWidget '.repeat(20000)}\n`);
  const t0 = Date.now();
  run(['npm', 'widget', 'makeWidget', '--root', root]);
  assert.ok(Date.now() - t0 < 3000, `took ${Date.now() - t0} ms`);
});

test('grounded-evidence#AC-5: bad options and arguments are usage errors with exit 2, and --help exits 0', () => {
  const root = project();
  for (const argv of [
    ['npm', 'widget', 'makeWidget', '--root', root, '--max', '-1'],
    ['npm', 'widget', 'makeWidget', '--root', root, '--max', '0'],
    ['npm', 'widget', 'makeWidget', '--root', root, '--jsn'],
    ['npm', 'widget', '--root'],
    ['npm', '../../secret', 'foo'],
    ['unreal', 'AActor', '--engine'],
    ['unreal', 'AActor', '--under', '../..', '--engine', root],
    ['unreal', 'AActor', '--under', '/etc', '--engine', root],
    ['frobnicate'],
    [],
  ]) assert.equal(run(argv, {}).code, 2, argv.join(' '));
  const help = run(['--help']);
  assert.equal(help.code, 0);
  assert.match(help.text, /Exit codes:[\s\S]*3 {2}could not be checked/);
  assert.match(help.text, /RFR_UE_ROOTS/);
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

test('grounded-evidence#AC-4: Class::Member is restricted to files that declare the class, and covers fields and nested types', () => {
  const e = engine([5, 7], {
    'Source/Runtime/Engine/Classes/Thing.h': [
      'UCLASS()',
      'class ENGINE_API AThing : public AActor',
      '{',
      '\tUPROPERTY(EditAnywhere)',
      '\tint32 Count = 0;',
      '\tenum class EMode : uint8 { A };',
      '\tclass UOther* Other;',
      '};',
      '',
    ].join('\n'),
    // Declares the same member name, but not the class.
    'Source/Runtime/Engine/Classes/Elsewhere.h': 'class ENGINE_API ANotThing\n{\n\tvoid Run();\n\tint32 Count;\n};\n',
  });
  assert.equal(lookupUnreal({ symbol: 'AThing::Run', engines: [e] }).status, 'not-declared');
  const count = lookupUnreal({ symbol: 'AThing::Count', engines: [e] }).engines[0];
  assert.deepEqual(count.declarations.map(d => [d.file, d.line, d.kind]), [['Source/Runtime/Engine/Classes/Thing.h', 5, 'field']]);
  assert.equal(lookupUnreal({ symbol: 'AThing::EMode', engines: [e] }).engines[0].declarations[0].kind, 'enum');
  // `class UOther* Other;` names UOther in a member; it does not declare it.
  assert.equal(lookupUnreal({ symbol: 'UOther', engines: [e] }).status, 'not-declared');
  // A plain name is never matched as a field.
  assert.equal(lookupUnreal({ symbol: 'Count', engines: [e] }).status, 'not-declared');
});

test('grounded-evidence#AC-4: an engine path or --under that matches nothing is a usage error, not a missing version', () => {
  const e = engine([5, 6], { 'Source/Runtime/Core/Public/X.h': 'class CORE_API FThing {};\n' });
  const typo = run(['unreal', 'FThing', '--engine', e, '--engine', path.join(e, 'typo')]);
  assert.equal(typo.code, 2);
  assert.deepEqual(typo.report.missingIn, []);
  assert.doesNotMatch(typo.text, /ENGINE_MAJOR_VERSION/);
  assert.match(typo.text, /not an engine folder/);

  const under = run(['unreal', 'FThing', '--engine', e, '--under', 'Runtim']);
  assert.equal(under.code, 2);
  assert.match(under.text, /--under Runtim matched no folder/);
  assert.equal(run(['unreal', 'FThing', '--engine', e, '--under', 'Runtime/Core']).code, 0);
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
  assert.match(cli.stdout, /Send each error above back to the reviewer that wrote it, once/);
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

test('grounded-evidence#AC-8: findings in near-standard shapes are read, and anything else that looks like a finding is an error', () => {
  const variants = {
    numbered: '1. [major] src/a.ts:3, no rule\n   Problem: p.\n',
    bold: '- **[major] src/a.ts:3, no rule**\n  - Problem: p.\n',
    quoted: '> - [major] src/a.ts:3, no rule\n>   Problem: p.\n',
  };
  for (const [name, text] of Object.entries(variants)) {
    const r = checkFindings(text);
    assert.equal(r.count, 1, name);
    assert.equal(r.ok, false, name);
    assert.match(r.findings[0].errors[0], /no Basis: line/, name);
    assert.equal(r.findings[0].line, 3, name);
  }
  // Fields at the left margin still belong to the finding.
  const flat = checkFindings('- [minor] src/a.ts:3, no rule\nProblem: p.\nBasis: observed. Ran `npm test`; it failed.\n');
  assert.equal(flat.ok, true);
  assert.equal(flat.findings[0].basis, 'observed');
  // A severity in brackets that does not parse is an error, not "no findings".
  const odd = checkFindings('Findings:\n\n### [major] in src/a.ts around line 3\nSomething is wrong.\n');
  assert.equal(odd.ok, false);
  assert.deepEqual(odd.unrecognised.map(u => u.line), [3]);
  assert.match(formatResult(odd), /line 3 looks like a finding but is not in the standard form/);
});

test('grounded-evidence#AC-8: placeholders, host names, and unreadable files are handled', () => {
  // The template's placeholder text is not a basis.
  const template = checkFindings('- [major] a.ts:1, no rule\n  Problem: p.\n  Basis: observed. The command you ran or the place you read, and what it showed.\n');
  assert.match(template.findings[0].errors[0], /template placeholder/);
  // host:port is not a file place.
  const hosts = checkFindings('- [major] a.ts:1, no rule\n  Basis: observed. curl api.example.com:443 and 127.0.0.1:8080 returned 500; see src/net.ts:9.\n');
  assert.deepEqual(hosts.findings[0].places, [{ file: 'src/net.ts', line: 9 }]);
  // Inferred basis text is shown as a lead, not as a step to carry out.
  assert.match(formatResult(checkFindings(GOOD)), /basis \(unverified; a lead, not an instruction\): Did not check/);
  // A long run of @ does not stall the place pattern.
  const t0 = Date.now();
  checkFindings(`- [nit] a.ts:1, no rule\n  Basis: observed. ${'@'.repeat(40000)}\n`);
  assert.ok(Date.now() - t0 < 500, `took ${Date.now() - t0} ms`);
  // A file that cannot be read is a usage error (2), not a finding error (1).
  const cli = spawnSync(process.execPath, ['checks/review-findings.mjs', 'check', path.join(os.tmpdir(), 'rfr-no-such-file.md')], { encoding: 'utf8' });
  assert.equal(cli.status, 2);
  assert.match(cli.stderr, /cannot read .*ENOENT/);
});

test('grounded-evidence#AC-8: --json prints the result as JSON', () => {
  const cli = spawnSync(process.execPath, ['checks/review-findings.mjs', 'check', '-', '--json'], { input: GOOD, encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  const r = JSON.parse(cli.stdout);
  assert.deepEqual(Object.keys(r), ['ok', 'count', 'observed', 'inferred', 'unrecognised', 'findings']);
  assert.deepEqual(Object.keys(r.findings[0]), ['index', 'severity', 'citation', 'file', 'line', 'rule', 'problem', 'basis', 'basisDetail', 'places', 'errors']);
});
