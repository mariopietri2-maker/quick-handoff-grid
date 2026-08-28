#!/usr/bin/env python3
from pathlib import Path
import re

def main() -> None:
    p = Path("supabase/functions/send-push/index.ts")
    t = p.read_text(encoding="utf-8")
    old = '''            // Store calls MUST use a system notification + channel sound.
            // Data-only messages often never wake the process when the app is
            // backgrounded/killed (OEM restrictions) — driver only hears sound
            // after opening the app (poll). Notification+data plays the channel
            // sound from the system tray even when the process is dead.
            const isStoreCall = (opts.data?.type === "store_call") ||
              opts.channelId === "driver-store-calls-v1";
            if (isStoreCall) {
              return {
                token: opts.token,
                notification: { title: opts.title, body: opts.body },
                data,
                android: {
                  priority: "HIGH",
                  collapse_key: collapse,
                  ttl: "300s",
                  notification: {
                    channel_id: opts.channelId,
                    sound: offerSound,
                    default_vibrate_timings: true,
                    default_light_settings: true,
                    notification_priority: "PRIORITY_MAX",
                    visibility: "PUBLIC",
                    tag: collapse || "store_call",
                  },
                },
              };
            }
            return {
              token: opts.token,
              data,
              android: {
                priority: "HIGH",
                collapse_key: collapse,
                ttl: "120s",
              },
            };'''
    new = '''            // Offers + store calls MUST use system notification + channel sound.
            // Data-only messages often never wake the process when the app is
            // backgrounded/killed (OEM restrictions). Notification+data plays
            // the channel sound from the system tray even when the process is dead.
            const msgType = opts.data?.type || "";
            const isCritical =
              msgType === "store_call" ||
              msgType === "offer" ||
              opts.channelId === "driver-store-calls-v1" ||
              opts.channelId === "driver-offers-v5" ||
              opts.channelId === "driver-offers-v4" ||
              opts.channelId === "driver-offers-v3";
            if (isCritical) {
              return {
                token: opts.token,
                notification: { title: opts.title, body: opts.body },
                data,
                android: {
                  priority: "HIGH",
                  collapse_key: collapse,
                  ttl: "300s",
                  notification: {
                    channel_id: opts.channelId,
                    sound: offerSound,
                    default_vibrate_timings: true,
                    default_light_settings: true,
                    notification_priority: "PRIORITY_MAX",
                    visibility: "PUBLIC",
                    tag: collapse || (msgType === "store_call" ? "store_call" : "driver_offer"),
                  },
                },
              };
            }
            return {
              token: opts.token,
              data,
              android: {
                priority: "HIGH",
                collapse_key: collapse,
                ttl: "120s",
              },
            };'''
    if old not in t:
        if "msgType === \"offer\"" in t or "msgType === 'offer'" in t:
            print("send-push already fixed")
        else:
            raise SystemExit("send-push block missing")
    else:
        t = t.replace(old, new)
        print("send-push v1")

    old_leg = '''          : ((opts.data?.type === "store_call") || opts.channelId === "driver-store-calls-v1")
          ? {
            to: opts.token,
            priority: "high",
            content_available: true,
            collapse_key: collapse,
            notification: {
              title: opts.title,
              body: opts.body,
              sound: offerSound,
              android_channel_id: opts.channelId,
              tag: collapse || "store_call",
            },
            data: {
              ...opts.data,
              title: opts.title,
              body: opts.body,
              channel_id: opts.channelId,
            },
          }
          : {
            to: opts.token,
            priority: "high",
            content_available: true,
            collapse_key: collapse,
            data: {
              ...opts.data,
              title: opts.title,
              body: opts.body,
              channel_id: opts.channelId,
            },
          },'''
    new_leg = '''          : (
            opts.data?.type === "store_call" ||
            opts.data?.type === "offer" ||
            opts.channelId === "driver-store-calls-v1" ||
            opts.channelId === "driver-offers-v5" ||
            opts.channelId === "driver-offers-v4" ||
            opts.channelId === "driver-offers-v3"
          )
          ? {
            to: opts.token,
            priority: "high",
            content_available: true,
            collapse_key: collapse,
            notification: {
              title: opts.title,
              body: opts.body,
              sound: offerSound,
              android_channel_id: opts.channelId,
              tag: collapse || (opts.data?.type === "store_call" ? "store_call" : "driver_offer"),
            },
            data: {
              ...opts.data,
              title: opts.title,
              body: opts.body,
              channel_id: opts.channelId,
            },
          }
          : {
            to: opts.token,
            priority: "high",
            content_available: true,
            collapse_key: collapse,
            data: {
              ...opts.data,
              title: opts.title,
              body: opts.body,
              channel_id: opts.channelId,
            },
          },'''
    if old_leg in t:
        t = t.replace(old_leg, new_leg)
        print("send-push legacy")
    p.write_text(t, encoding="utf-8")

    svc = Path("native-driver/app/src/main/java/com/freshdelivery/nativedriver/push/DriverFirebaseMessagingService.kt")
    st = svc.read_text(encoding="utf-8")
    old_fs = '''        if (isStoreCall) {
            builder.setFullScreenIntent(pi, true)
            builder.setTimeoutAfter(60_000L)
        }'''
    new_fs = '''        // Heads-up / lock-screen for offers and store calls when backgrounded
        builder.setFullScreenIntent(pi, true)
        builder.setTimeoutAfter(90_000L)
'''
    if old_fs in st:
        st = st.replace(old_fs, new_fs)
        svc.write_text(st, encoding="utf-8")
        print("fullscreen")
    else:
        print("fullscreen skip")

    g = Path("native-driver/app/build.gradle.kts")
    gt = g.read_text(encoding="utf-8")
    gt = re.sub(r"versionCode = \d+", "versionCode = 268", gt, count=1)
    gt = re.sub(r'versionName = "[^"]+"', 'versionName = "2.6.17-native"', gt, count=1)
    g.write_text(gt, encoding="utf-8")
    apk = Path("src/lib/apk-downloads.ts")
    if apk.exists():
        at = apk.read_text(encoding="utf-8")
        at = re.sub(
            r"APK_NATIVE_DRIVER_VERSION = '[^']+'",
            "APK_NATIVE_DRIVER_VERSION = '2.6.17-native'",
            at,
        )
        apk.write_text(at, encoding="utf-8")
    print("version 2.6.17")

if __name__ == "__main__":
    main()
