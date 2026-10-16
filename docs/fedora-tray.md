# Fedora tray and window recovery

This fork contains the newer Kotlin/Swing application. The upstream reports
[#1130](https://github.com/subhra74/xdm/issues/1130) and
[#1344](https://github.com/subhra74/xdm/issues/1344) describe the older GTK 8.0.29
application becoming inaccessible after its main window closes. Building this
fork does not patch an already installed GTK RPM.

## Behavior

Linux exports a D-Bus StatusNotifierItem even if the desktop tray watcher has not
started yet. It registers when that watcher appears and re-registers after a panel
restart or a failed registration followed by watcher replacement. While waiting,
it avoids creating a second AWT tray icon.

GNOME needs a compatible AppIndicator/StatusNotifier extension to display these
icons. If the desktop supplies no tray host, XDM cannot create a panel icon by
itself. Launching this version again asks the running instance to show the queue
window. Restoring the window clears its minimized state and preserves maximization.
Closing the window still allows downloads to continue in the background. If a running
instance answers the probe but rejects window activation, the new launch reports
a startup error instead of silently claiming the window was shown.

## Automated regression checks

Use the JDK 25/Maven setup in README.md. On a Linux machine with dbus-run-session:

```sh
XDM_TRAY_TEST_BUS=1 dbus-run-session -- mvn -B -pl xdm-app -am \
  -DskipTests=false -Dtest=DBusTrayTest,SingleInstanceTest \
  -Dsurefire.failIfNoSpecifiedTests=false test
```

The tray tests use an isolated session bus and a simulated panel. They cover a
late-starting watcher, a panel restart, an existing watcher, and recovery after
registration failure. Without XDM_TRAY_TEST_BUS=1 the tray tests are skipped to
avoid taking over a real desktop watcher. CI runs the command above.

## Fedora desktop checks

Record Fedora release, desktop/session type, Java runtime, and source commit.

1. Launch the built app and confirm its download list is visible.
2. Minimize it, then launch the same built app again. Confirm the existing queue
   window is restored and no second instance remains.
3. Maximize, then minimize and relaunch; confirm maximization is preserved.
4. Close the window while downloading, then relaunch. Confirm the queue returns
   and the download continues.
5. With a compatible tray extension, launch before enabling the extension.
   Enable it and confirm the tray icon appears without restarting XDM.
6. Restart/re-enable the tray extension and check that one icon returns and its
   Restore action opens the queue.
7. Without a tray extension, confirm relaunch still restores the queue.

The private-bus tests do not verify a visible icon or window-manager behavior.
Those checks require a Fedora graphical session.
