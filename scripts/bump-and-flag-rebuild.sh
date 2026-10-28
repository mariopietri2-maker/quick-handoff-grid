#!/usr/bin/env bash
set -euo pipefail
# Bump version codes so installs clearly update
sed -i 's/versionCode = 7233212/versionCode = 7233213/' native-customer/app/build.gradle.kts || true
sed -i 's/versionName = "1.0.10"/versionName = "1.0.11"/' native-customer/app/build.gradle.kts || true
sed -i 's/versionCode = 1003/versionCode = 1004/' native-driver/app/build.gradle.kts || true
sed -i 's/versionName = "1.0.2"/versionName = "1.0.3"/' native-driver/app/build.gradle.kts || true
grep -n "versionCode\|versionName" native-customer/app/build.gradle.kts | head -5
grep -n "versionCode\|versionName" native-driver/app/build.gradle.kts | head -5
