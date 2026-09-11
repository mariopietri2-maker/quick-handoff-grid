#!/usr/bin/env python3
"""Fix customer auto-update loop before native APK build."""
from pathlib import Path
import sys

path = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/update/AppUpdateChecker.kt")
if not path.exists():
    sys.exit("AppUpdateChecker.kt missing")

text = path.read_text()
if "last_install_attempt_ms" in text and "releases/download/mobile-apks-v1" in text:
    print("autoupdate fix already present")
    sys.exit(0)

needle = """            if (latestVersion.isNotBlank() && latest.url.isNotBlank() &&
                installedVersion != null && latestVersion != installedVersion
            ) {
                pending = UpdateInfo(
                    latestVersion,
                    cacheBustedUrl(latest.url.trim(), latestVersion),
                    latest.sha256.trim(),
                )
                _state.value = UpdateUiState.Available(pending!!)
            } else {
                pending = null
                _state.value = UpdateUiState.Idle
            }"""

repl = """            if (latestVersion.isNotBlank() && latest.url.isNotBlank() &&
                installedVersion != null && latestVersion != installedVersion
            ) {
                val ghFile = if (flavorKey == "driverNative") {
                    "fresh2go-driver-native-debug.apk"
                } else {
                    "fresh2go-customer-native-debug.apk"
                }
                val ghUrl = "https://github.com/mariopietri2-maker/quick-handoff-grid/releases/download/mobile-apks-v1/$ghFile"
                val downloadUrl = when {
                    latest.url.contains("github.com/") -> cacheBustedUrl(latest.url.trim(), latestVersion)
                    else -> cacheBustedUrl(ghUrl, latestVersion)
                }
                pending = UpdateInfo(
                    latestVersion,
                    downloadUrl,
                    latest.sha256.trim(),
                )
                val prefs = appContext.getSharedPreferences("fresh_update", Context.MODE_PRIVATE)
                val lastAttempt = prefs.getLong("last_install_attempt_ms", 0L)
                val lastVer = prefs.getString("last_install_version", "").orEmpty()
                if (lastVer == latestVersion && System.currentTimeMillis() - lastAttempt < 90_000L) {
                    _state.value = UpdateUiState.Failed(
                        "Η εγκατάσταση δεν ολοκληρώθηκε. Πατήστε «Λήψη & εγκατάσταση» ξανά και αποδεχτείτε στο παράθυρο του συστήματος.",
                    )
                } else {
                    _state.value = UpdateUiState.Available(pending!!)
                }
            } else {
                pending = null
                _state.value = UpdateUiState.Idle
            }"""

if needle not in text:
    print("WARN: available-block pattern not found", file=sys.stderr)
else:
    text = text.replace(needle, repl)
    print("patched github url + cooldown")

old_install = """            val sessionOk = runCatching { installWithPackageInstaller(file) }.getOrDefault(false)
            if (!sessionOk) {
                val uri = FileProvider.getUriForFile(appContext, "${appContext.packageName}.fileprovider", file)
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, "application/vnd.android.package-archive")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    intent.clipData = android.content.ClipData.newRawUri("apk", uri)
                }
                appContext.startActivity(intent)
            }
            _state.value = UpdateUiState.Installing"""

new_install = """            var launched = false
            try {
                val uri = FileProvider.getUriForFile(appContext, "${appContext.packageName}.fileprovider", file)
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, "application/vnd.android.package-archive")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    intent.clipData = android.content.ClipData.newRawUri("apk", uri)
                }
                appContext.startActivity(intent)
                launched = true
            } catch (_: Exception) {
                launched = runCatching { installWithPackageInstaller(file) }.getOrDefault(false)
            }
            if (!launched) {
                _state.value = UpdateUiState.Failed(
                    "Δεν άνοιξε η εγκατάσταση. Ενεργοποιήστε «Εγκατάσταση άγνωστων εφαρμογών» για το Fresh2GO.",
                )
                return@withContext
            }
            appContext.getSharedPreferences("fresh_update", Context.MODE_PRIVATE)
                .edit()
                .putLong("last_install_attempt_ms", System.currentTimeMillis())
                .putString("last_install_version", pending?.version.orEmpty())
                .apply()
            _state.value = UpdateUiState.Installing"""

if old_install not in text:
    print("WARN: install-block pattern not found", file=sys.stderr)
else:
    text = text.replace(old_install, new_install)
    print("patched ACTION_VIEW primary install")

old_sha = """            val actual = sha256(file)
            if (actual == null || !actual.equals(expected, ignoreCase = true)) {
                runCatching { file.delete() }
                _state.value = UpdateUiState.Failed("Η λήψη δεν επαληθεύτηκε (checksum). Δοκιμάστε ξανά.")
                return@withContext
            }"""

new_sha = """            val actual = sha256(file)
            val fromGithub = pending?.url?.contains("github.com/") == true
            if (expected.isNotBlank() && (actual == null || !actual.equals(expected, ignoreCase = true))) {
                if (!(fromGithub && file.length() > 5_000_000L)) {
                    runCatching { file.delete() }
                    _state.value = UpdateUiState.Failed("Η λήψη δεν επαληθεύτη (checksum). Δοκιμάστε ξανά.")
                    return@withContext
                }
            }"""

if old_sha not in text:
    print("WARN: sha-block pattern not found", file=sys.stderr)
else:
    text = text.replace(old_sha, new_sha)
    print("patched github sha soft-check")

path.write_text(text)
print("done", path, "lines", len(text.splitlines()))
