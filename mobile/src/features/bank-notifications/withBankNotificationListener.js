const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withBankNotificationListener(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const app = manifest.application && manifest.application[0];
    if (!app) throw new Error("Android application entry is missing from the manifest");
    app.$["android:usesCleartextTraffic"] = "true";
    app.service = app.service || [];
    const serviceName = "expo.modules.cherrynotifications.CherryNotificationListenerService";
    // Remove an entry created by the earlier plugin version at the wrong XML level.
    if (manifest.service) {
      manifest.service = manifest.service.filter((service) => service.$["android:name"] !== serviceName);
    }
    if (!app.service.some((service) => service.$["android:name"] === serviceName)) {
      app.service.push({
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
