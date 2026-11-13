// Tests for the rfr-unreal guard-unreal hook. Moved from test/hooks.test.mjs (rewrite plan 25e,
// verify inventory slice f).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findRisk } from '../../core/scripts/guard-commands.mjs';

test('guard-unreal asks when an editor -ExecCmds list does not quit (#56); guard-commands no longer does', async () => {
  const { decideUnreal } = await import('../scripts/guard-unreal.mjs');
  for (const command of [
    '"C:/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe" Host.uproject -ExecCmds="Automation RunTests RfrSample" -unattended',
    'UnrealEditor-Cmd Host.uproject -ExecCmds="py run.py" -nullrhi',
    "& UnrealEditor.exe Host.uproject '-ExecCmds=DumpConsoleCommands' -unattended",
  ]) {
    assert.ok(decideUnreal(command), command);
    assert.equal(findRisk(command), null, `guard-commands: ${command}`);
  }
  for (const command of [
    '"C:/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe" Host.uproject -ExecCmds="Automation RunTests RfrSample;Quit" -unattended',
    'UnrealEditor-Cmd Host.uproject -ExecCmds="py run.py; quit" -nullrhi',
    'UnrealEditor-Cmd Host.uproject -run=ResavePackages',
    'grep -n ExecCmds Scripts/Verify.ps1',
  ]) assert.equal(decideUnreal(command), null, command);
});
