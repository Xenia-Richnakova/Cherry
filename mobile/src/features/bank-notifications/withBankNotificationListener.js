const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withBankNotificationListener(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest.service = manifest.service || [];
    const serviceName = "expo.modules.cherrynotifications.CherryNotificationListenerService";
    if (!manifest.service.some((service) => service.$["android:name"] === serviceName)) {
      manifest.service.push({
        $: {
          "android:name": serviceName,
          "android:label": "Cherry bank notification import",
          "android:permission": "android.permission.BIND_NOTIFICATION_LISTENER_SERVICE",
          "android:exported": "true",
        },
        "intent-filter": [
          { action: [{ $: { "android:name": "android.service.notification.NotificationListenerService" } }] },
        ],
      });
    }
    return mod;
  });
};
