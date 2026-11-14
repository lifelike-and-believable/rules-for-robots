// unattended AC-10: a project declares the outside services it makes things in ("services" in
// .claude/rfr.json). On a declared service, making is not refused; destroying, reaching other people,
// and buying still are. The declaration counts only as merged to the default branch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { mcpNever } from '../plugins/core/scripts/guard-mcp-tools.mjs';
import { declaredServices } from '../plugins/core/scripts/lib.mjs';

const declared = ['higgsfield', 'adobe_for_creativity'];
const decide = (tool, services) => (mcpNever({ tool_name: tool }, services) ? 'refuse' : 'allow');

test('unattended#AC-10: on a declared service, generating, creating, editing, and uploading are not refused', () => {
  for (const tool of [
    'mcp__Higgsfield__generate_image', 'mcp__Higgsfield__generate_video', 'mcp__Higgsfield__generate_audio', 'mcp__Higgsfield__media_upload',
    'mcp__Higgsfield__create_project', 'mcp__Higgsfield__upscale_image', 'mcp__Higgsfield__remove_background',
    'mcp__Adobe_for_creativity__image_remove_background', 'mcp__Adobe_for_creativity__image_vectorize', 'mcp__Adobe_for_creativity__video_resize',
    'mcp__claude_ai_Higgsfield__generate_image',
  ]) assert.equal(decide(tool, declared), 'allow', tool);
});

test('unattended#AC-10: on a declared service, deleting, sharing, publishing, sending, and buying are still refused', () => {
  for (const tool of [
    'mcp__Higgsfield__delete_folder', 'mcp__Higgsfield__share_project', 'mcp__Higgsfield__publish_website', 'mcp__Higgsfield__deploy_website',
    'mcp__Higgsfield__gpu_rent', 'mcp__Higgsfield__tiktok_prepare_publish', 'mcp__Higgsfield__remove_project_asset',
    'mcp__Adobe_for_creativity__asset_share_link', 'mcp__Adobe_for_creativity__asset_invite_collaborators',
    'mcp__Adobe_for_creativity__asset_license_and_download_stock', 'mcp__Adobe_for_creativity__pdf_delete_pages',
  ]) assert.equal(decide(tool, declared), 'refuse', tool);
});

test('unattended#AC-10: a service that is not declared is refused as before, and the reason says how to propose it', () => {
  assert.equal(decide('mcp__Higgsfield__generate_image', []), 'refuse');
  assert.equal(decide('mcp__claude_ai_Gmail__create_draft', declared), 'refuse');
  assert.equal(decide('mcp__Spotify__generate_playlist', declared), 'refuse');
  const reason = mcpNever({ tool_name: 'mcp__Higgsfield__generate_image' }, []);
  assert.match(reason, /^rfr-core \(never list\)/);
  assert.match(reason, /add "Higgsfield" to "services" in \.claude\/rfr\.json in a pull request/);
  // A held action on a declared service is not something to propose.
  assert.doesNotMatch(mcpNever({ tool_name: 'mcp__Higgsfield__delete_folder' }, declared), /pull request/);
});

test('unattended#AC-10: the declaration counts only as merged to the default branch', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-services-'));
  const git = (...args) => {
    const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  };
  const declare = services => {
    fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.claude', 'rfr.json'), JSON.stringify({ services }));
  };
  // The hook as Claude Code runs it: a new process for each call, in the project's directory.
  const hook = tool => {
    const r = spawnSync(process.execPath, [path.resolve('plugins/core/scripts/guard-mcp-tools.mjs')], { input: JSON.stringify({ tool_name: tool, cwd: dir }), cwd: dir, encoding: 'utf8', env: { ...process.env, RFR_GUARD_LOG: '0' } });
    return r.stdout.includes('"deny"') ? 'refuse' : 'allow';
  };
  try {
    git('init', '-q', '-b', 'main');
    fs.writeFileSync(path.join(dir, 'README.md'), 'x\n');
    git('add', '-A'); git('commit', '-q', '-m', 'start');
    assert.deepEqual(declaredServices(dir), [], 'no declaration');
    assert.equal(hook('mcp__Higgsfield__generate_image'), 'refuse', 'no declaration');

    git('checkout', '-q', '-b', 'propose');
    // An entry may be a name, or an object that also records what the service is for and its limits.
    declare([{ name: 'Higgsfield', for: 'pictures for the intro video', limits: 'a credit limit for each run' }]);
    git('add', '-A'); git('commit', '-q', '-m', 'propose a service');
    assert.equal(hook('mcp__Higgsfield__generate_image'), 'refuse', 'a service proposed on a branch does not count yet');

    git('checkout', '-q', 'main'); git('merge', '-q', '--ff-only', 'propose');
    git('checkout', '-q', '-b', 'work');
    assert.equal(hook('mcp__Higgsfield__generate_image'), 'allow', 'it counts once merged');
    assert.equal(hook('mcp__Higgsfield__delete_folder'), 'refuse', 'a held action is still refused');

    declare(['Higgsfield', { name: 'Gmail' }]);
    assert.equal(hook('mcp__Gmail__create_draft'), 'refuse', 'a service the session added for itself is refused');
    assert.equal(hook('mcp__Higgsfield__generate_image'), 'allow', 'the merged service still counts');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
