#!/bin/zsh
set -e
ADB="$HOME/Library/Android/sdk/platform-tools/adb"
DEVICE="emulator-5554"

"$ADB" -s "$DEVICE" logcat -c
printf 'Enabled notification listeners:\n'
"$ADB" -s "$DEVICE" shell settings get secure enabled_notification_listeners
printf '\nPosting test bank debit notification...\n'
"$ADB" -s "$DEVICE" shell 'cmd notification post -t "Card payment" cherry-test "Payment 12,34 EUR Coffee Shop"'
sleep 2
printf '\nCherry listener diagnostics:\n'
"$ADB" -s "$DEVICE" logcat -d -s CherryBankNotifications:D AndroidRuntime:E
