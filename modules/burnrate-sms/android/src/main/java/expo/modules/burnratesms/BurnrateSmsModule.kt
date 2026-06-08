package expo.modules.burnratesms

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Telephony
import android.telephony.SmsMessage
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.os.bundleOf
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BurnrateSmsModule : Module() {
  private var receiver: BroadcastReceiver? = null

  override fun definition() = ModuleDefinition {
    Name("BurnrateSms")

    Events("onSmsReceived")

    AsyncFunction("isAvailableAsync") {
      true
    }

    AsyncFunction("getPermissionStatusAsync") {
      permissionStatus()
    }

    AsyncFunction("requestPermissionsAsync") {
      val activity = appContext.currentActivity
      if (activity != null && permissionStatus() != "granted") {
        ActivityCompat.requestPermissions(
          activity,
          arrayOf(Manifest.permission.READ_SMS, Manifest.permission.RECEIVE_SMS),
          5771
        )
      }
      permissionStatus()
    }

    AsyncFunction("startListeningAsync") {
      startListening()
      true
    }

    AsyncFunction("stopListeningAsync") {
      stopListening()
      true
    }

    OnDestroy {
      stopListening()
    }
  }

  private fun startListening() {
    if (receiver != null || permissionStatus() != "granted") {
      return
    }

    val context = appContext.reactContext ?: return
    receiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
          return
        }
        readMessages(intent).forEach { message ->
          if (looksFinancial(message.body)) {
            sendEvent(
              "onSmsReceived",
              bundleOf(
                "sender" to message.sender,
                "message" to message.body,
                "receivedAt" to message.receivedAt
              )
            )
          }
        }
      }
    }

    val filter = IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION).apply {
      priority = Int.MAX_VALUE
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
    } else {
      @Suppress("DEPRECATION")
      context.registerReceiver(receiver, filter)
    }
  }

  private fun stopListening() {
    val context = appContext.reactContext ?: return
    receiver?.let {
      runCatching { context.unregisterReceiver(it) }
    }
    receiver = null
  }

  private fun permissionStatus(): String {
    val context = appContext.reactContext ?: return "unavailable"
    val readGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
    val receiveGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED
    return if (readGranted && receiveGranted) "granted" else "denied"
  }

  private fun readMessages(intent: Intent): List<IncomingSms> {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
      Telephony.Sms.Intents.getMessagesFromIntent(intent).map {
        IncomingSms(it.originatingAddress.orEmpty(), it.messageBody.orEmpty(), System.currentTimeMillis())
      }
    } else {
      @Suppress("DEPRECATION")
      val pdus = intent.extras?.get("pdus") as? Array<*> ?: return emptyList()
      val format = intent.extras?.getString("format")
      pdus.mapNotNull { pdu ->
        val bytes = pdu as? ByteArray ?: return@mapNotNull null
        val sms = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          SmsMessage.createFromPdu(bytes, format)
        } else {
          @Suppress("DEPRECATION")
          SmsMessage.createFromPdu(bytes)
        }
        IncomingSms(sms.originatingAddress.orEmpty(), sms.messageBody.orEmpty(), System.currentTimeMillis())
      }
    }
  }

  private fun looksFinancial(body: String): Boolean {
    val text = body.lowercase()
    val hasMoney = Regex("""(inr|rs\.?|₹)\s*[0-9]|[0-9]\s*(inr|rs\.?|₹)""").containsMatchIn(text)
    val hasFinanceHint = Regex("""\b(upi|debited|credited|spent|paid|received|a/c|acct|account|transaction|txn|bank|card|wallet|phonepe|gpay|paytm|sbi|hdfc|icici)\b""")
      .containsMatchIn(text)
    return hasMoney && hasFinanceHint
  }
}

data class IncomingSms(
  val sender: String,
  val body: String,
  val receivedAt: Long
)
