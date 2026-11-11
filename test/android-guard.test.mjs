// rfr-android's device guard (docs/specs/android-plugin.md, AC-1 to AC-3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { androidSettings, decideAdb, shellVerdict } from '../plugins/android/scripts/guard-adb.mjs';

const TV = '10.0.0.202:34447';
const settings = { disposable: ['TESTDEV'], deviceScripts: ['scripts/device-setup.ps1'] };
const decide = (command, { devices = [TV], env = {} } = {}) => decideAdb(command, { env, settings, listDevices: () => devices })?.decision ?? 'allow';
const bs = String.fromCharCode(92);

test('android-plugin#AC-1: rfr-android is a plugin in the marketplace, registering guard-adb and its own guard-outcome', () => {
  const manifest = JSON.parse(fs.readFileSync('plugins/android/.claude-plugin/plugin.json', 'utf8'));
  assert.equal(manifest.name, 'rfr-android');
  const market = JSON.parse(fs.readFileSync('.claude-plugin/marketplace.json', 'utf8'));
  assert.ok(market.plugins.some(p => p.name === 'rfr-android' && p.source === './plugins/android'));
  const hooks = JSON.parse(fs.readFileSync('plugins/android/hooks/hooks.json', 'utf8')).hooks;
  const commands = event => hooks[event].flatMap(h => h.hooks.map(x => `${h.matcher} ${x.command}`));
  assert.ok(commands('PreToolUse').some(c => /^Bash\|PowerShell .*guard-adb\.mjs/.test(c)));
  assert.ok(commands('PostToolUse').some(c => /guard-outcome\.mjs/.test(c)));
  assert.ok(commands('PostToolUseFailure').some(c => /guard-outcome\.mjs/.test(c)));
  for (const f of ['lib.mjs', 'guard-outcome.mjs', 'shell-writes.mjs']) assert.ok(fs.existsSync(path.join('plugins/android/scripts', f)), `build copy ${f}`);
  assert.match(fs.readFileSync('package.json', 'utf8'), /claude plugin validate --strict plugins\/android/);
});

test('android-plugin#AC-2: reads, connections, and remote-control input never ask', () => {
  for (const c of [
    'adb devices', 'adb connect 10.0.0.202:5555', 'adb disconnect', 'adb mdns services', 'adb wait-for-device', 'adb get-state',
    'adb logcat -b events', 'adb pull /sdcard/x.png .', `adb -s ${TV} shell getprop ro.build.version.release`,
    'adb shell "dumpsys power | grep mWakefulness"', 'adb exec-out uiautomator dump /dev/tty', 'adb exec-out screencap -p',
    'adb shell pm list packages', 'adb shell pm path quiet.launcher', 'adb shell settings get secure x', 'adb shell wm size',
    'adb shell cmd package resolve-activity -a android.intent.action.MAIN',
    'adb shell input keyevent KEYCODE_WAKEUP', 'adb shell input text hello', 'adb shell am start -n a.b/.Main',
    'adb shell am broadcast -n a.b/.R', 'adb shell am force-stop a.b', 'adb shell monkey -p a.b 1',
    './gradlew test && adb shell getprop ro.product.model', 'echo "adb install later"',
  ]) assert.equal(decide(c), 'allow', c);
});

test('android-plugin#AC-2: each kind of change, an unknown device command, and an unreadable line ask on a shared device', () => {
  for (const c of [
    'adb install app-debug.apk', 'adb install-multiple a.apk b.apk', 'adb uninstall quiet.launcher', 'adb reboot', 'adb root', 'adb remount',
    'adb push x /sdcard/x', 'adb sideload ota.zip', 'adb tcpip 5555',
    'adb shell pm uninstall quiet.launcher', 'adb shell pm disable-user com.google.android.apps.tv.launcherx', 'adb shell pm clear a.b',
    'adb shell pm grant a.b android.permission.X', 'adb shell cmd package set-home-activity a.b/.Main',
    `adb -s ${TV} shell settings put secure enabled_accessibility_services a.b/.S`, 'adb shell settings delete secure x',
    'adb shell appops set a.b X allow', 'adb shell wm size 1280x720', 'adb shell svc wifi disable', 'adb shell setprop x y',
    'adb shell "settings get secure x; settings put secure x 1"', 'adb shell', 'adb shell rm -rf /sdcard/x', 'adb shell monkey -p a.b 500',
    'adb shell "unterminated', `$adb = "C:${bs}tools${bs}adb.exe"; & $adb shell pm uninstall a.b`,
  ]) assert.equal(decide(c), 'ask', c);
});

test('android-plugin#AC-2: a listed device script asks when it runs, not when a message names it', () => {
  assert.equal(decide('pwsh -File scripts/device-setup.ps1 -Tv 10.0.0.202:34447'), 'ask');
  assert.equal(decide(`& .${bs}scripts${bs}device-setup.ps1`), 'ask');
  assert.equal(decide('./scripts/device-setup.ps1'), 'ask');
  assert.equal(decide('git commit -m "run scripts/device-setup.ps1 later"'), 'allow');
  assert.equal(decide('ANDROID_SERIAL=TESTDEV pwsh -File scripts/device-setup.ps1'), 'allow');
});

test('android-plugin#AC-2: nothing asks on a disposable device, and the ask names the device, the change, and what to do instead', () => {
  for (const c of ['adb -s emulator-5554 install app.apk', 'adb -e uninstall a.b', 'adb -s TESTDEV shell settings put secure x 1', 'adb -s TESTDEV reboot']) assert.equal(decide(c), 'allow', c);
  const d = decideAdb(`adb -s ${TV} install app.apk`, { env: {}, settings, listDevices: () => [] });
  assert.equal(d.decision, 'ask');
  assert.match(d.reason, /^rfr-android: adb install app\.apk changes the device 10\.0\.0\.202:34447\./);
  assert.match(d.reason, /outside the project/);
  assert.match(d.reason, /If not approved: run it on an emulator, or report the command for the lead to run\.$/);
});

test('android-plugin#AC-3: the device comes from -s, then ANDROID_SERIAL in the line, then the environment, then the one connected device', () => {
  assert.equal(decide('ANDROID_SERIAL=TESTDEV adb install a.apk'), 'allow', 'prefix');
  assert.equal(decide('export ANDROID_SERIAL=TESTDEV && adb install a.apk'), 'allow', 'export earlier in the line');
  assert.equal(decide('$env:ANDROID_SERIAL = "TESTDEV"; adb install a.apk'), 'allow', 'PowerShell');
  assert.equal(decide('adb install a.apk', { env: { ANDROID_SERIAL: 'TESTDEV' } }), 'allow', 'environment');
  assert.equal(decide(`adb -s ${TV} install a.apk`, { env: { ANDROID_SERIAL: 'TESTDEV' } }), 'ask', '-s wins over the environment');
  assert.equal(decide('adb install a.apk', { devices: ['emulator-5554'] }), 'allow', 'the only device is an emulator');
  assert.equal(decide('adb install a.apk', { devices: [TV] }), 'ask', 'the only device is shared');
  const several = decideAdb('adb install a.apk', { env: {}, settings, listDevices: () => ['emulator-5554', TV] });
  assert.equal(several.decision, 'ask', 'several devices and none named');
  assert.match(several.reason, /one of several connected devices/);
  assert.equal(decide('adb install a.apk', { devices: [] }), 'ask', 'no device found');
});

test('android-plugin#AC-3: settings come from .claude/rfr.json at the repository root', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfr-android-'));
  spawnSync('git', ['init', '-q'], { cwd: dir });
  assert.deepEqual(androidSettings(dir), { disposable: [], deviceScripts: [] });
  fs.mkdirSync(path.join(dir, '.claude'));
  fs.writeFileSync(path.join(dir, '.claude', 'rfr.json'), JSON.stringify({ testWeakening: 'defer', android: { disposable: ['ABC123'], deviceScripts: ['scripts/setup.ps1'] } }));
  fs.mkdirSync(path.join(dir, 'sub'));
  assert.deepEqual(androidSettings(path.join(dir, 'sub')), { disposable: ['ABC123'], deviceScripts: ['scripts/setup.ps1'] });
  assert.equal(shellVerdict(['getprop']), 'safe');
  assert.equal(shellVerdict([]), 'change');
});
