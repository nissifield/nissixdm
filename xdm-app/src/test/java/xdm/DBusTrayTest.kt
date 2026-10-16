package xdm

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Assumptions.assumeTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import xdm.app.utils.linux.DBusTray
import xdm.app.utils.linux.dbus.DBusConnection
import xdm.app.utils.linux.dbus.DBusError
import xdm.app.utils.linux.dbus.ExportedObject
import xdm.app.utils.linux.dbus.Reply
import xdm.app.utils.linux.dbus.Variant
import java.awt.image.BufferedImage
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit

/** Uses a private bus, never the user's desktop watcher. See docs/fedora-tray.md. */
class DBusTrayTest {
    private val watcherName = "org.kde.StatusNotifierWatcher"
    private val watcherPath = "/StatusNotifierWatcher"

    @BeforeEach
    fun requirePrivateBus() {
        assumeTrue(System.getenv("XDM_TRAY_TEST_BUS") == "1", "Run under a private dbus-run-session")
    }

    private class Watcher(private val fail: Boolean = false) : ExportedObject {
        val registrations = LinkedBlockingQueue<String>()
        override val introspection = ""

        override fun invoke(interfaceName: String?, member: String, args: List<Any?>): Reply? {
            if (interfaceName != "org.kde.StatusNotifierWatcher" || member != "RegisterStatusNotifierItem") return null
            registrations.add(args.single() as String)
            if (fail) throw DBusError("org.freedesktop.DBus.Error.Failed", "Simulated watcher failure")
            return Reply()
        }

        fun awaitRegistration(): String {
            val name = registrations.poll(5, TimeUnit.SECONDS)
            assertNotNull(name, "XDM did not register with the watcher")
            return name!!
        }
    }

    private fun DBusConnection.startWatcher(watcher: Watcher) {
        export(watcherPath, watcher)
        assertTrue(requestName(watcherName))
    }

    private fun DBusConnection.stopWatcher() {
        assertEquals(1, call(
            DBusConnection.BUS, DBusConnection.BUS_PATH, DBusConnection.BUS,
            "ReleaseName", "s", listOf(watcherName)
        ).single())
    }

    @Test
    fun waitsForLateWatcherAndRegistersAgainAfterPanelRestart() {
        DBusConnection.openSession().use { appBus ->
            assertFalse(appBus.nameHasOwner(watcherName), "This test requires a private bus")
            assertTrue(DBusTray.install(appBus) { size -> BufferedImage(size, size, BufferedImage.TYPE_INT_ARGB) })

            DBusConnection.openSession().use { panel ->
                val watcher = Watcher()
                panel.startWatcher(watcher)
                val name = watcher.awaitRegistration()
                assertTrue(appBus.nameHasOwner(name))
                val status = panel.call(
                    name, "/StatusNotifierItem", "org.freedesktop.DBus.Properties", "Get",
                    "ss", listOf("org.kde.StatusNotifierItem", "Status")
                ).single() as Variant
                assertEquals("Active", status.value)
                panel.stopWatcher()
            }

            DBusConnection.openSession().use { replacement ->
                val watcher = Watcher()
                replacement.startWatcher(watcher)
                assertTrue(appBus.nameHasOwner(watcher.awaitRegistration()))
            }
        }
    }

    @Test
    fun registersWithAnAlreadyRunningWatcher() {
        DBusConnection.openSession().use { panel ->
            val watcher = Watcher()
            panel.startWatcher(watcher)
            DBusConnection.openSession().use { appBus ->
                assertTrue(DBusTray.install(appBus) { size -> BufferedImage(size, size, BufferedImage.TYPE_INT_ARGB) })
                assertTrue(appBus.nameHasOwner(watcher.awaitRegistration()))
            }
        }
    }

    @Test
    fun failedRegistrationDoesNotDisableWatcherRecovery() {
        DBusConnection.openSession().use { appBus ->
            DBusConnection.openSession().use { panel ->
                val watcher = Watcher(fail = true)
                panel.startWatcher(watcher)
                assertTrue(DBusTray.install(appBus) { size -> BufferedImage(size, size, BufferedImage.TYPE_INT_ARGB) })
                watcher.awaitRegistration()
                panel.stopWatcher()
            }
            DBusConnection.openSession().use { replacement ->
                val watcher = Watcher()
                replacement.startWatcher(watcher)
                assertTrue(appBus.nameHasOwner(watcher.awaitRegistration()))
            }
        }
    }
}
