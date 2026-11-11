#!/usr/bin/env node
// PreToolUse (Bash, PowerShell): ask before an adb command changes a shared Android device
// (docs/specs/android-plugin.md, AC-2 and AC-3). A device is outside the project, so a change to it
// is tier 4 under the guard tiers (practices/guards.md): a person decides. Reads, connections, and
// remote-control input are tier 1 and run without asking, and nothing asks on a disposable device
// (an emulator, or a serial listed under android.disposable in .claude/rfr.json).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ask, askReason, readInput } from './lib.mjs';
import { parseCommand } from './shell-writes.mjs';

const ADB = /(^|[\\/])adb(\.exe)?$/i;
// adb's own options before the command, and whether each takes a value.
const GLOBAL_WITH_VALUE = new Set(['-s', '-t', '-H', '-P', '-L']);
const GLOBAL_FLAGS = new Set(['-a', '-d', '-e']);

// adb commands that never change a device, and those that do.
const ADB_SAFE = new Set(['devices', 'connect', 'disconnect', 'mdns', 'get-state', 'get-serialno', 'get-devpath', 'version', 'help', 'start-server', 'kill-server', 'reconnect', 'logcat', 'pull', 'forward', 'reverse', 'bugreport', 'attach', 'detach']);
const ADB_CHANGE = new Set(['install', 'install-multiple', 'install-multi-package', 'uninstall', 'reboot', 'root', 'unroot', 'remount', 'disable-verity', 'enable-verity', 'sideload', 'push', 'sync', 'tcpip', 'usb', 'emu']);

// Commands inside `adb shell` or `adb exec-out`: reads, remote-control input, and changes.
const SHELL_READS = new Set(['getprop', 'dumpsys', 'ls', 'cat', 'ps', 'id', 'whoami', 'date', 'df', 'uptime', 'screencap', 'screenrecord', 'echo', 'logcat', 'getevent', 'uname', 'pwd', 'which', 'grep', 'head', 'tail', 'wc', 'top', 'true']);
const PM_READS = new Set(['list', 'path', 'dump', 'resolve-activity', 'query-activities', 'query-services', 'query-receivers', 'get-install-location', 'has-feature', 'get-max-users', 'get-app-links']);
const PM_CHANGES = new Set(['install', 'install-create', 'install-write', 'install-commit', 'uninstall', 'disable', 'disable-user', 'disable-until-used', 'enable', 'hide', 'unhide', 'clear', 'grant', 'revoke', 'reset-permissions', 'set-home-activity', 'set-installer', 'set-install-location', 'suspend', 'unsuspend', 'default-state', 'trim-caches']);

// The verdict for one command run inside the device shell: 'safe' or 'change' (unknown counts as a
// change, so it asks on a shared device).
export function shellVerdict(words) {
  const [cmd, sub, third] = words;
  if (!cmd) return 'change'; // an interactive shell: anything can follow
  if (SHELL_READS.has(cmd)) return 'safe';
  if (cmd === 'input') return 'safe';
  if (cmd === 'am') return ['start', 'start-activity', 'broadcast', 'force-stop', 'stack', 'get-current-user'].includes(sub) ? 'safe' : 'change';
  if (cmd === 'monkey') return words.includes('-p') && /^\d+$/.test(words.at(-1)) && Number(words.at(-1)) <= 1 ? 'safe' : 'change';
  if (cmd === 'uiautomator') return sub === 'dump' ? 'safe' : 'change';
  if (cmd === 'settings') return ['get', 'list'].includes(sub) ? 'safe' : 'change';
  if (cmd === 'wm') return ['size', 'density'].includes(sub) && third === undefined ? 'safe' : 'change';
  if (cmd === 'pm' || (cmd === 'cmd' && sub === 'package')) {
    const verb = cmd === 'pm' ? sub : third;
    if (PM_READS.has(verb)) return 'safe';
    return 'change'; // PM_CHANGES and anything unknown
  }
  return 'change';
}

// Splits the device-side part of `adb shell ...` into its commands. A single quoted argument
// (adb shell "settings get secure x; dumpsys power") holds a whole command line.
function deviceCommands(args) {
  const text = args.join(' ');
  return text.split(/;|&&|\|\||\|/).map(part => part.trim().split(/\s+/).filter(Boolean));
}

// Reads one adb invocation: { serial, emulator, sub, verdict, summary }.
export function readAdb(words) {
  let k = 1;
  let serial = null;
  let emulator = false;
  while (k < words.length && words[k].startsWith('-')) {
    if (GLOBAL_WITH_VALUE.has(words[k])) {
      if (words[k] === '-s') serial = words[k + 1] ?? null;
      k += 2;
    } else {
      if (words[k] === '-e') emulator = true;
      if (!GLOBAL_FLAGS.has(words[k])) break;
      k += 1;
    }
  }
  const sub = words[k] ?? '';
  const rest = words.slice(k + 1);
  let verdict;
  if (sub.startsWith('wait-for')) verdict = 'safe';
  else if (sub === 'shell' || sub === 'exec-out') {
    const inner = rest.filter((w, i) => !(i === 0 && /^-[ntTx]+$/.test(w)));
    verdict = inner.length === 0 ? 'change' : deviceCommands(inner).every(c => shellVerdict(c) === 'safe') ? 'safe' : 'change';
  } else if (ADB_SAFE.has(sub)) verdict = 'safe';
  else verdict = 'change'; // ADB_CHANGE, and anything unknown
  return { serial, emulator, sub, verdict, summary: ['adb', ...words.slice(k)].join(' ').slice(0, 120) };
}

const isEmulator = serial => /^emulator-\d+$/.test(serial ?? '');

// The project's Android settings, from .claude/rfr.json: { disposable: [serial], deviceScripts: [path] }.
export function androidSettings(cwd = process.cwd()) {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', timeout: 5000 });
  const root = r.status === 0 ? r.stdout.trim() : (process.env.CLAUDE_PROJECT_DIR ?? cwd);
  try {
    const android = JSON.parse(fs.readFileSync(path.join(root, '.claude', 'rfr.json'), 'utf8'))?.android ?? {};
    return {
      disposable: Array.isArray(android.disposable) ? android.disposable.map(String) : [],
      deviceScripts: Array.isArray(android.deviceScripts) ? android.deviceScripts.map(String) : [],
    };
  } catch {
    return { disposable: [], deviceScripts: [] };
  }
}

// The devices adb sees, for a command that names none. Empty when adb cannot be run.
export function connectedDevices() {
  const r = spawnSync('adb', ['devices'], { encoding: 'utf8', timeout: 3000 });
  if (r.status !== 0) return [];
  return (r.stdout ?? '').split('\n').slice(1).map(l => l.trim().split(/\s+/)).filter(([s, state]) => s && state === 'device').map(([s]) => s);
}

// The device a command targets: -s, else ANDROID_SERIAL set earlier in the same command line, else
// the environment's; with none named, the one device adb sees, if there is exactly one.
function resolveDevice({ serial, emulator }, lineSerial, env, listDevices) {
  if (serial) return { serial, named: true };
  if (emulator) return { serial: 'emulator', emulatorFlag: true, named: true };
  if (lineSerial) return { serial: lineSerial, named: true };
  if (env.ANDROID_SERIAL) return { serial: env.ANDROID_SERIAL, named: true };
  const devices = listDevices();
  return devices.length === 1 ? { serial: devices[0], named: false } : { serial: null, named: false, count: devices.length };
}

const disposable = (device, settings) => device.emulatorFlag || isEmulator(device.serial) || (device.serial !== null && settings.disposable.includes(device.serial));

const norm = p => p.replace(/\\/g, '/').replace(/^\.\//, '');

// The words of a command line as written, outside quoted strings: PowerShell paths keep their
// backslashes (.\scripts\x.ps1), which the shell parser reads as escapes, and a script only named
// in a quoted message (a commit message) is not run.
const unquotedWords = command => command
  .replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, ' ')
  .split(/[\s;|&()]+/)
  .filter(Boolean)
  .map(norm);

// null (no decision), or { decision: 'ask', reason }.
export function decideAdb(command, { cwd = process.cwd(), env = process.env, settings = null, listDevices = connectedDevices } = {}) {
  if (typeof command !== 'string') return null;
  const mentionsAdb = /\badb(\.exe)?\b/i.test(command);
  const s = settings ?? androidSettings(cwd);
  const scripts = s.deviceScripts.map(norm);
  const commands = parseCommand(command);
  const changes = [];
  let lineSerial = null;
  let adbVars = new Set();
  // A listed device script, wherever it runs in the line (pwsh -File x, & .\x, ./x).
  const rawScript = scripts.find(sp => unquotedWords(command).some(w => w.endsWith(sp)));
  // Its device is the one ANDROID_SERIAL names on the command that runs it, or earlier in the line.
  let scriptSerial = null;
  if (commands === null) {
    if (mentionsAdb) changes.push({ summary: 'a command line the guard cannot read, which runs adb', device: resolveDevice({}, null, env, listDevices) });
  } else {
    for (const { words } of commands) {
      // ANDROID_SERIAL set for the rest of the line: export ANDROID_SERIAL=x, $env:ANDROID_SERIAL = "x".
      const assign = words.join(' ').match(/^(?:export\s+)?ANDROID_SERIAL=(\S+)$|^\$env:ANDROID_SERIAL\s*=\s*(\S+)$/i);
      if (assign) { lineSerial = (assign[1] ?? assign[2]).replace(/^["']|["']$/g, ''); continue; }
      // A PowerShell variable that holds adb's path: $adb = "...\adb.exe".
      if (/^\$\w+$/.test(words[0] ?? '') && words[1] === '=' && words.length === 3 && ADB.test(words[2])) { adbVars.add(words[0].toLowerCase()); continue; }
      let k = 0;
      let prefixSerial = null;
      while (k < words.length && /^\w+=/.test(words[k])) {
        const m = /^ANDROID_SERIAL=(.*)$/.exec(words[k]);
        if (m) prefixSerial = m[1];
        k++;
      }
      if (words[k] === '&') k++;
      const head = words[k] ?? '';
      if (rawScript && words.some(w => norm(w).endsWith(rawScript))) { scriptSerial = prefixSerial ?? lineSerial; continue; }
      if (!(ADB.test(head) || adbVars.has(head.toLowerCase()))) continue;
      const adb = readAdb(words.slice(k));
      if (adb.verdict === 'safe') continue;
      changes.push({ summary: adb.summary, device: resolveDevice(adb, prefixSerial ?? lineSerial, env, listDevices) });
    }
  }
  if (rawScript) changes.push({ summary: `the device script ${rawScript}`, device: resolveDevice({}, scriptSerial ?? lineSerial, env, listDevices) });
  const asking = changes.filter(c => !disposable(c.device, s));
  if (!asking.length) return null;
  const c = asking[0];
  const where = c.device.serial ? `the device ${c.device.serial}` : c.device.count > 1 ? 'one of several connected devices (none named)' : 'the connected device';
  return {
    decision: 'ask',
    reason: askReason({
      source: 'rfr-android',
      action: `${c.summary} changes ${where}`,
      why: 'it changes a device outside the project, which no snapshot can undo, and the device is not listed as disposable',
      instead: 'run it on an emulator, or report the command for the lead to run',
    }),
  };
}

async function main() {
  const input = await readInput();
  const result = decideAdb(input?.tool_input?.command, { cwd: input?.cwd ?? process.cwd() });
  if (result) ask(result.reason);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main();
