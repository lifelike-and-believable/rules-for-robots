#!/usr/bin/env node
// Unreal Tier 1 checks: run on any machine, no engine needed (PLAN.md section 7).
// Enforces UE-002, UE-005, UE-006, FAB-001, FAB-002, FAB-003.
//
// Usage: node checks/unreal/tier1.mjs <plugin-dir> --copyright "<holder>"
//          [--project <example-project-dir>] [--allow-missing-fab-url]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MODULE_TYPES = new Set([
  'Runtime', 'RuntimeNoCommandlet', 'RuntimeAndProgram', 'CookedOnly', 'UncookedOnly', 'DeveloperTool',
  'Editor', 'EditorNoCommandlet', 'EditorAndProgram', 'Program', 'ServerOnly', 'ClientOnly', 'ClientOnlyNoCommandlet',
]);
export const UE5_PLATFORMS = new Set(['Win64', 'Mac', 'Linux', 'LinuxArm64', 'Android', 'IOS', 'TVOS', 'VisionOS']);
const ALLOWED_TOP = new Set(['Source', 'Content', 'Resources', 'Config']);
const FORBIDDEN_TOP = new Set(['Binaries', 'Build', 'Intermediate', 'Saved', 'DerivedDataCache']);
const SOURCE_EXT = new Set(['.h', '.cpp', '.inl', '.cs']);
const SEGMENT = /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/;
const MAX_PATH = 170;

function walk(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    out.push({ rel: path.relative(base, full).split(path.sep).join('/'), dir: entry.isDirectory() });
    if (entry.isDirectory()) walk(full, base, out);
  }
  return out;
}

function readFilterPlugin(pluginDir) {
  const file = path.join(pluginDir, 'Config', 'FilterPlugin.ini');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').map(l => l.trim()).filter(l => l.startsWith('/'));
}

// TObjectPtr members whose declaration is not preceded by a UPROPERTY macro.
export function unreflectedObjectPtrs(headerText) {
  const lines = headerText.split('\n');
  const findings = [];
  lines.forEach((line, i) => {
    if (!/^\s*(mutable\s+)?TObjectPtr<[^;()]*>\s+\w+\s*(=[^;]*|\{[^;]*\})?;/.test(line)) return;
    let j = i - 1;
    while (j >= 0 && (/^\s*$/.test(lines[j]) || /^\s*(\/\/|\/\*|\*)/.test(lines[j]))) j--;
    if (j < 0 || !/UPROPERTY\s*\(/.test(lines[j])) findings.push(i + 1);
  });
  return findings;
}

export function checkPlugin(pluginDir, { copyright, project, allowMissingFabUrl = false } = {}) {
  const errors = [];
  const warnings = [];
  const err = (code, msg) => errors.push(`${code}: ${msg}`);

  const descriptors = fs.readdirSync(pluginDir).filter(f => f.endsWith('.uplugin'));
  if (descriptors.length !== 1) {
    err('FAB-003', `expected exactly one .uplugin at the plugin root, found ${descriptors.length}`);
    return { errors, warnings };
  }
  const pluginName = path.basename(pluginDir);
  let descriptor;
  try {
    descriptor = JSON.parse(fs.readFileSync(path.join(pluginDir, descriptors[0]), 'utf8'));
  } catch (e) {
    err('FAB-001', `${descriptors[0]} is not valid JSON: ${e.message}`);
    return { errors, warnings };
  }

  // FAB-001: descriptor fields.
  if (!/^5\.\d+\.0$/.test(descriptor.EngineVersion ?? '')) err('FAB-001', `EngineVersion must look like "5.6.0" (found ${JSON.stringify(descriptor.EngineVersion)})`);
  if (!descriptor.FabURL) {
    if (allowMissingFabUrl) warnings.push('FAB-001: FabURL is not set yet; add it once the Fab product exists');
    else err('FAB-001', 'FabURL is missing');
  }
  if ('MarketplaceURL' in descriptor) warnings.push('FAB-001: MarketplaceURL is the old Marketplace field; Fab uses FabURL');
  const modules = descriptor.Modules ?? [];
  if (!modules.length) err('FAB-003', 'a code plugin needs at least one module');
  for (const m of modules) {
    const name = m.Name ?? '(unnamed module)';
    if (m.Type === 'Developer') err('UE-005', `module ${name} uses the deprecated Developer type; use DeveloperTool, Editor, or UncookedOnly`);
    else if (!MODULE_TYPES.has(m.Type)) err('UE-005', `module ${name} has unknown Type ${JSON.stringify(m.Type)}`);
    if ('WhitelistPlatforms' in m || 'BlacklistPlatforms' in m) err('FAB-001', `module ${name} uses UE4 WhitelistPlatforms/BlacklistPlatforms; use PlatformAllowList/PlatformDenyList`);
    const list = m.PlatformAllowList ?? m.PlatformDenyList;
    if (!Array.isArray(list) || list.length === 0) err('FAB-001', `module ${name} needs a non-empty PlatformAllowList or PlatformDenyList`);
    else for (const p of list) if (!UE5_PLATFORMS.has(p)) err('FAB-001', `module ${name} lists platform ${JSON.stringify(p)}, which is not a UE5 platform name`);
  }
  for (const dep of descriptor.Plugins ?? []) {
    warnings.push(`FAB-001: depends on plugin ${dep.Name}; confirm it ships with the engine (Fab forbids depending on user-made plugins)`);
  }

  // FAB-003: folder layout, names, lengths, file types.
  const entries = walk(pluginDir);
  const filtered = readFilterPlugin(pluginDir);
  for (const e of entries.filter(e => e.dir && !e.rel.includes('/'))) {
    if (FORBIDDEN_TOP.has(e.rel)) err('FAB-003', `remove ${e.rel}/ from the plugin folder; it is build output`);
    else if (!ALLOWED_TOP.has(e.rel) && !filtered.some(f => f.startsWith(`/${e.rel}/`))) {
      err('FAB-003', `${e.rel}/ is not a standard folder; list it in Config/FilterPlugin.ini (for example /${e.rel}/...)`);
    }
  }
  for (const e of entries) {
    const full = `${pluginName}/${e.rel}`;
    if (full.length > MAX_PATH) err('FAB-003', `path is ${full.length} characters (limit ${MAX_PATH}): ${full}`);
    const bad = e.rel.split('/').find(s => !SEGMENT.test(s));
    if (bad) err('FAB-003', `name ${JSON.stringify(bad)} in ${e.rel} uses characters other than English letters, digits, and underscores`);
    if (!e.dir && /\.(exe|msi)$/i.test(e.rel)) err('FAB-003', `${e.rel}: .exe and .msi files are not allowed`);
    if (e.dir && /(^|\/)ThirdParty$/.test(e.rel) && e.rel !== 'Source/ThirdParty') err('FAB-003', `${e.rel}: third-party code belongs in Source/ThirdParty`);
  }

  // FAB-002 and UE-002: source files.
  for (const e of entries.filter(e => !e.dir && e.rel.startsWith('Source/') && SOURCE_EXT.has(path.extname(e.rel)))) {
    if (e.rel.startsWith('Source/ThirdParty/')) continue;
    const text = fs.readFileSync(path.join(pluginDir, e.rel), 'utf8');
    const first = text.split('\n').find(l => l.trim()) ?? '';
    if (/Fill out your copyright notice/i.test(text)) err('FAB-002', `${e.rel}: replace Epic's default copyright placeholder`);
    else if (!/^\s*\/\/.*copyright/i.test(first) || (copyright && !first.includes(copyright))) {
      err('FAB-002', `${e.rel}: first line must be a // copyright comment${copyright ? ` naming ${copyright}` : ''}`);
    }
    if (e.rel.endsWith('.h')) {
      for (const line of unreflectedObjectPtrs(text)) err('UE-002', `${e.rel}:${line}: TObjectPtr member without UPROPERTY()`);
    }
  }

  // UE-006: Target.cs files in an example project.
  if (project) {
    for (const e of walk(project).filter(e => !e.dir && e.rel.endsWith('.Target.cs'))) {
      const text = fs.readFileSync(path.join(project, e.rel), 'utf8');
      if (!/BuildSettingsVersion\.V6/.test(text)) err('UE-006', `${e.rel}: set DefaultBuildSettings = BuildSettingsVersion.V6`);
    }
  }

  return { errors, warnings };
}

function main() {
  const args = process.argv.slice(2);
  const opt = name => { const i = args.indexOf(name); return i === -1 ? undefined : args[i + 1]; };
  const pluginDir = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
  if (!pluginDir) {
    console.error('usage: tier1.mjs <plugin-dir> --copyright "<holder>" [--project <dir>] [--allow-missing-fab-url]');
    process.exit(2);
  }
  const { errors, warnings } = checkPlugin(path.resolve(pluginDir), {
    copyright: opt('--copyright'),
    project: opt('--project') && path.resolve(opt('--project')),
    allowMissingFabUrl: args.includes('--allow-missing-fab-url'),
  });
  for (const w of warnings) console.warn(`warning ${w}`);
  for (const e of errors) console.error(`error ${e}`);
  console.log(`${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(errors.length ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
