# rfr-android

For Android, Android TV, and Google TV apps. Requires `rfr-core`. Spec: [docs/specs/android-plugin.md](../../docs/specs/android-plugin.md).

Install it from this repository's marketplace:

```
/plugin install rfr-android@rules-for-robots
```

## The device guard

`guard-adb` asks before an `adb` command changes a shared device, and nowhere else. Reading from a device (`getprop`, `dumpsys`, `logcat`, `uiautomator dump`, screenshots), connecting to it, and pressing its keys (`input`, `am start`) never ask. Installing, uninstalling, rebooting, pushing files, changing settings (`settings put`), or changing packages (`pm disable-user`, `cmd package set-home-activity`) asks, with the device and the change named, because a device is outside the project and no snapshot can undo a change to it. An `adb shell` command it does not recognise asks too.

Nothing asks on a disposable device. Emulators are disposable. A physical device is disposable when the project says so in `.claude/rfr.json`:

```json
{
  "android": {
    "disposable": ["R5CT1234ABC"],
    "deviceScripts": ["scripts/device-setup.ps1"]
  }
}
```

`deviceScripts` lists scripts that change a device: the guard cannot see the `adb` commands inside a script, so running a listed script against a shared device asks.

The guard reads the device from `adb -s`, then `ANDROID_SERIAL` set in the same command line, then the environment, then the one device `adb devices` shows. With no device named and none or several connected, it treats the target as shared.

Every decision is logged with the other guards' (see [practices/guards.md](../../practices/guards.md#guard-adb-rfr-android-shell-commands)).

## Coming next

The on-device tutorial runner (`runner: adb`) and the `android-app` profile, slices 24c and 24d of the spec.
