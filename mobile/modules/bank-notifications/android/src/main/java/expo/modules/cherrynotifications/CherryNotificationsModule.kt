package expo.modules.cherrynotifications

import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CherryNotificationsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CherryBankNotifications")

    Function("hasNotificationAccess") {
      CherryNotificationListenerService.hasAccess(appContext.reactContext)
    }

    Function("openNotificationAccessSettings") {
      appContext.currentActivity?.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
    }

    Function("getPendingTransactions") {
      val prefs = appContext.reactContext?.getSharedPreferences(CherryNotificationListenerService.PREFS, 0)
      CherryNotificationListenerService.readQueue(prefs)
    }

    Function("acknowledgeTransaction") { id: String ->
      val prefs = appContext.reactContext?.getSharedPreferences(CherryNotificationListenerService.PREFS, 0)
      val queue = CherryNotificationListenerService.readQueue(prefs).filterNot { it["id"] == id }
      CherryNotificationListenerService.writeQueue(prefs, queue)
    }
  }
}
