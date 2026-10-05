import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkPlugin, unreflectedObjectPtrs } from '../checks/unreal/tier1.mjs';

const SAMPLE = path.resolve('examples/unreal/RfrSample');
const HOLDER = 'Lifelike & Believable Animation Design';

function copySample(mutate) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-ue-'));
  const dir = path.join(root, 'RfrSample');
  fs.cpSync(SAMPLE, dir, { recursive: true });
  mutate?.(dir);
  return dir;
}

function descriptor(dir, change) {
  const file = path.join(dir, 'RfrSample.uplugin');
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  change(d);
  fs.writeFileSync(file, JSON.stringify(d, null, '\t'));
}

const errorsOf = (dir, opts = {}) => checkPlugin(dir, { copyright: HOLDER, allowMissingFabUrl: true, ...opts }).errors;

test('the sample plugin passes', () => {
  assert.deepEqual(errorsOf(SAMPLE), []);
});

test('FabURL is required unless explicitly allowed to be missing', () => {
  assert.ok(errorsOf(SAMPLE, { allowMissingFabUrl: false }).some(e => e.includes('FabURL is missing')));
});

test('descriptor problems are reported', () => {
  const dir = copySample(d => descriptor(d, x => {
    x.EngineVersion = '5.6';
    x.Modules[0].Type = 'Developer';
    delete x.Modules[0].PlatformAllowList;
    x.Modules.push({ Name: 'Other', Type: 'Editor', PlatformAllowList: ['Win32'] });
    x.Modules.push({ Name: 'Old', Type: 'Runtime', WhitelistPlatforms: ['Win64'] });
  }));
  const errors = errorsOf(dir);
  assert.ok(errors.some(e => e.startsWith('FAB-001') && e.includes('EngineVersion')), errors.join('\n'));
  assert.ok(errors.some(e => e.startsWith('UE-005') && e.includes('Developer')), errors.join('\n'));
  assert.ok(errors.some(e => e.includes('module RfrSample needs a non-empty PlatformAllowList')), errors.join('\n'));
  assert.ok(errors.some(e => e.includes('"Win32"')), errors.join('\n'));
  assert.ok(errors.some(e => e.includes('WhitelistPlatforms')), errors.join('\n'));
});

test('folder and file problems are reported', () => {
  const dir = copySample(d => {
    fs.mkdirSync(path.join(d, 'Binaries'));
    fs.mkdirSync(path.join(d, 'Docs'));
    fs.mkdirSync(path.join(d, 'Content', 'ThirdParty'), { recursive: true });
    fs.writeFileSync(path.join(d, 'Resources-setup.exe'), '');
    fs.mkdirSync(path.join(d, 'Source', 'RfrSample', 'Private', 'x'.repeat(150)));
  });
  const errors = errorsOf(dir);
  for (const needle of ['Binaries/ from the plugin folder', 'Docs/ is not a standard folder', 'Content/ThirdParty', '.exe', 'characters (limit 170)', '"Resources-setup.exe"']) {
    assert.ok(errors.some(e => e.includes(needle)), `${needle}\n${errors.join('\n')}`);
  }
});

test('extra folders are fine when listed in FilterPlugin.ini', () => {
  const dir = copySample(d => {
    fs.mkdirSync(path.join(d, 'Docs'));
    fs.mkdirSync(path.join(d, 'Config'));
    fs.writeFileSync(path.join(d, 'Config', 'FilterPlugin.ini'), '[FilterPlugin]\n/Docs/...\n');
  });
  assert.deepEqual(errorsOf(dir), []);
});

test('copyright headers are required in source files', () => {
  const dir = copySample(d => {
    fs.writeFileSync(path.join(d, 'Source/RfrSample/Private/Missing.cpp'), '#include "RfrSampleSubsystem.h"\n');
    fs.writeFileSync(path.join(d, 'Source/RfrSample/Private/Placeholder.cpp'), '// Fill out your copyright notice in the Description page of Project Settings.\n');
  });
  const errors = errorsOf(dir);
  assert.ok(errors.some(e => e.includes('Missing.cpp: first line must be a // copyright comment')), errors.join('\n'));
  assert.ok(errors.some(e => e.includes("Placeholder.cpp: replace Epic's default")), errors.join('\n'));
  assert.ok(errorsOf(SAMPLE, { copyright: 'Someone Else' }).some(e => e.startsWith('FAB-002')));
});

test('finds TObjectPtr members without UPROPERTY', () => {
  const header = [
    'UCLASS()', 'class UFoo : public UObject', '{',
    '\tUPROPERTY()', '\tTObjectPtr<UBar> Good;',
    '\tUPROPERTY(EditAnywhere)', '\t// comment between', '\tTObjectPtr<UBar> AlsoGood = nullptr;',
    '\tTObjectPtr<UBar> Bad;',
    '\tvoid Use(TObjectPtr<UBar> Param);',
    '};',
  ].join('\n');
  assert.deepEqual(unreflectedObjectPtrs(header), [9]);
});

test('Target.cs files in the example project need BuildSettingsVersion.V6', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-ue-project-'));
  fs.mkdirSync(path.join(project, 'Source'));
  fs.writeFileSync(path.join(project, 'Source', 'Host.Target.cs'), 'DefaultBuildSettings = BuildSettingsVersion.V5;');
  assert.ok(errorsOf(SAMPLE, { project }).some(e => e.startsWith('UE-006')));
  fs.writeFileSync(path.join(project, 'Source', 'Host.Target.cs'), 'DefaultBuildSettings = BuildSettingsVersion.V6;');
  assert.deepEqual(errorsOf(SAMPLE, { project }), []);
});

test('automation report summary uses index.json counts', async () => {
  const { summarize } = await import('../checks/unreal/ci/read-automation-report.mjs');
  assert.deepEqual(summarize({ succeeded: 2, succeededWithWarnings: 0, failed: 1, notRun: 0, tests: [{}, {}, {}] }),
    { succeeded: 2, succeededWithWarnings: 0, failed: 1, notRun: 0, total: 3 });
  assert.equal(summarize({ tests: [{ state: 'Success' }, { state: 'Fail' }] }).failed, 1);
});

test('build output folders are reported once and not descended into (#24)', () => {
  const dir = copySample(d => {
    fs.mkdirSync(path.join(d, 'Binaries', 'Win64'), { recursive: true });
    fs.writeFileSync(path.join(d, 'Binaries', 'Win64', 'UnrealEditor-RfrSample.dll'), '');
    fs.mkdirSync(path.join(d, 'Intermediate', 'Build', 'Win64'), { recursive: true });
    fs.writeFileSync(path.join(d, 'Intermediate', 'Build', 'Win64', 'x-y.obj'), '');
  });
  assert.deepEqual(errorsOf(dir).sort(), [
    'FAB-003: remove Binaries/ from the plugin folder; it is build output',
    'FAB-003: remove Intermediate/ from the plugin folder; it is build output',
  ]);
});

test('third-party source in a module ThirdParty folder keeps its own notice (#25)', () => {
  const dir = copySample(d => {
    const lib = path.join(d, 'Source', 'RfrSample', 'ThirdParty', 'lib', 'include');
    fs.mkdirSync(lib, { recursive: true });
    fs.writeFileSync(path.join(lib, 'lib.h'), '#pragma once\nclass Foo\n{\n\tTObjectPtr<UObject> X;\n};\n');
  });
  const errors = errorsOf(dir).filter(e => e.startsWith('FAB-002') || e.startsWith('UE-002'));
  assert.deepEqual(errors, []);
});

test('FAB-002 accepts any of several copyright holders (#26)', () => {
  const dir = copySample(d => {
    fs.writeFileSync(path.join(d, 'Source/RfrSample/Private/Upstream.cpp'), '// Copyright (c) Open3DStream Contributors\n');
    fs.writeFileSync(path.join(d, 'Source/RfrSample/Private/Neither.cpp'), '// Copyright Someone Else\n');
  });
  const one = errorsOf(dir);
  assert.ok(one.some(e => e.includes('Upstream.cpp')), one.join('\n'));
  const both = errorsOf(dir, { copyright: [HOLDER, 'Open3DStream Contributors'] });
  assert.ok(!both.some(e => e.includes('Upstream.cpp')), both.join('\n'));
  const neither = both.find(e => e.includes('Neither.cpp'));
  assert.ok(neither && neither.includes(HOLDER) && neither.includes('Open3DStream Contributors'), both.join('\n'));
});

test('the CLI accepts --copyright more than once (#26)', async () => {
  const { spawnSync } = await import('node:child_process');
  const dir = copySample(d => {
    fs.writeFileSync(path.join(d, 'Source/RfrSample/Private/Upstream.cpp'), '// Copyright (c) Open3DStream Contributors\n');
  });
  const run = (...holders) => spawnSync(process.execPath, ['checks/unreal/tier1.mjs', dir, ...holders.flatMap(h => ['--copyright', h]), '--allow-missing-fab-url'], { encoding: 'utf8' });
  assert.equal(run(HOLDER).status, 1);
  const ok = run(HOLDER, 'Open3DStream Contributors');
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
});

test('a ThirdParty folder anywhere under Source/ is accepted (#36)', () => {
  const dir = copySample(d => {
    fs.mkdirSync(path.join(d, 'Source', 'RfrSample', 'ThirdParty', 'lib'), { recursive: true });
    fs.writeFileSync(path.join(d, 'Source', 'RfrSample', 'ThirdParty', 'lib', 'LICENSE.txt'), 'MIT');
    fs.mkdirSync(path.join(d, 'Source', 'ThirdParty', 'other'), { recursive: true });
  });
  assert.deepEqual(errorsOf(dir), []);
});
