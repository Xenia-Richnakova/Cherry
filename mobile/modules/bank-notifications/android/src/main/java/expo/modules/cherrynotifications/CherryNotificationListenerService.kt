package expo.modules.cherrynotifications

import android.content.ComponentName
import android.content.Context
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class CherryNotificationListenerService : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification) {
    val isTatraBanka = sbn.packageName == TATRA_BANKA_PACKAGE
    val isDebugShellTest = BuildConfig.DEBUG && sbn.packageName == "com.android.shell"
    if (!isTatraBanka && !isDebugShellTest) return
    val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val workspaceId = prefs.getString("active_workspace", null) ?: return
    val extras = sbn.notification.extras
    val title = extras.getCharSequence("android.title")?.toString().orEmpty()
    val body = listOf(
      extras.getCharSequence("android.text")?.toString(),
      extras.getCharSequence("android.bigText")?.toString(),
      extras.getCharSequence("android.subText")?.toString()
    ).filterNotNull().joinToString(" ").trim()
    val parsed = parseDebit("$title $body") ?: return
    val id = sha256("${sbn.key}:${sbn.postTime}:${parsed.first}")
    val queue = readQueue(prefs)
    if (queue.any { it["id"] == id }) return
    val date = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(sbn.postTime))
    queue.add(mapOf(
      "id" to id,
      "workspaceId" to workspaceId,
      "amountCents" to parsed.first,
      "date" to date,
      "note" to parsed.second
    ))
    writeQueue(prefs, queue.takeLast(MAX_QUEUED))
  }

  companion object {
    const val PREFS = "cherry_bank_notification_import"
    private const val TATRA_BANKA_PACKAGE = "sk.tb.ib.tatraandroid"
    private const val MAX_QUEUED = 100

    fun hasAccess(context: Context?): Boolean {
      if (context == null) return false
      val enabled = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: return false
      val component = ComponentName(context, CherryNotificationListenerService::class.java).flattenToString()
      return enabled.split(":").contains(component)
    }

    @Suppress("UNCHECKED_CAST")
    fun readQueue(prefs: android.content.SharedPreferences?): MutableList<Map<String, Any>> {
      val raw = prefs?.getString("pending_transactions", "[]") ?: "[]"
      return try {
        val array = JSONArray(raw)
        MutableList(array.length()) { index ->
          val item = array.getJSONObject(index)
          mapOf(
            "id" to item.getString("id"),
            "workspaceId" to item.getString("workspaceId"),
            "amountCents" to item.getInt("amountCents"),
            "date" to item.getString("date"),
            "note" to item.getString("note")
          )
        }
      } catch (_: Exception) { mutableListOf() }
    }

    fun writeQueue(prefs: android.content.SharedPreferences?, queue: List<Map<String, Any>>) {
      val array = JSONArray()
      queue.forEach { item -> array.put(JSONObject(item)) }
      prefs?.edit()?.putString("pending_transactions", array.toString())?.apply()
    }

    private fun parseDebit(message: String): Pair<Int, String>? {
      val text = message.replace('\u00a0', ' ').replace('−', '-')
      val lower = text.lowercase(Locale.ROOT)
      val exclusions = listOf("received", "credited", "incoming", "prichádz", "pripísaná", "pripisana", "prijatá platba", "prijata platba", "balance", "zostatok", "otp", "overovací", "authorization", "authorized", "failed", "declined", "zamietnut")
      if (exclusions.any { lower.contains(it) }) return null
      val money = Regex("([+-]?\\d[\\d .]*[,.]\\d{2})\\s*(EUR|€)|(EUR|€)\\s*([+-]?\\d[\\d .]*[,.]\\d{2})", RegexOption.IGNORE_CASE)
      val match = money.find(text) ?: return null
      val rawAmount = (match.groups[1]?.value ?: match.groups[4]?.value).orEmpty()
      val compact = rawAmount.replace(" ", "")
      val normalized = if (compact.contains(',')) {
        compact.replace(".", "").replace(',', '.')
      } else {
        compact
      }
      val amount = normalized.toBigDecimalOrNull() ?: return null
      if (amount <= java.math.BigDecimal.ZERO || amount > java.math.BigDecimal("99999999")) return null
      val cents = amount.movePointRight(2).toInt()
      val hasDebitSignal = rawAmount.startsWith("-") || listOf("payment", "platba", "withdrawal", "výber", "vyber", "card", "kartou", "debit").any { lower.contains(it) }
      if (!hasDebitSignal) return null
      val merchant = text.replace(match.value, " ")
        .replace(Regex("(?i)\\b(payment|platba kartou|platba|card payment|transaction|transakcia|tatra banka)\\b"), " ")
        .replace(Regex("\\s+"), " ").trim().take(100)
      val note = if (merchant.isBlank()) "Tatra banka card payment" else "Tatra banka · $merchant".take(160)
      return cents to note
    }

    private fun sha256(value: String): String = MessageDigest.getInstance("SHA-256")
      .digest(value.toByteArray()).joinToString("") { "%02x".format(it) }
  }
}
