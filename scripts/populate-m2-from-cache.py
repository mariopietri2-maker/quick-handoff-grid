#!/usr/bin/env python3
"""Seed ~/.m2/repository from the Gradle dependency cache.

Use case: token-less local debug builds. The Mapbox Maps SDK lives behind an
authenticated Maven repo (api.mapbox.com, DOWNLOADS:READ token). If this
machine built the app once with the token, the artifacts sit in the Gradle
cache — this script republishes the com.mapbox.* family into ~/.m2 so
`mavenLocal()` (declared in native-driver/settings.gradle.kts and the
capacitor-mapbox-maps plugin) resolves them without credentials.

Safe to re-run: only copies missing files.
"""
import os
import shutil
import sys

GROUPS = ("com.mapbox.maps", "com.mapbox.common", "com.mapbox.base",
          "com.mapbox.annotation", "com.mapbox.extension", "com.mapbox.module",
          "com.mapbox.plugin", "com.mapbox.mapboxsdk")

home = os.path.expanduser("~")
cache = os.path.join(home, ".gradle", "caches", "modules-2", "files-2.1")
m2 = os.path.join(home, ".m2", "repository")

copied = 0
for group in GROUPS:
    gdir = os.path.join(cache, group)
    if not os.path.isdir(gdir):
        print(f"skip (not cached): {group}")
        continue
    for artifact in os.listdir(gdir):
        adir = os.path.join(gdir, artifact)
        if not os.path.isdir(adir):
            continue
        for version in os.listdir(adir):
            vdir = os.path.join(adir, version)
            if not os.path.isdir(vdir):
                continue
            for sha in os.listdir(vdir):
                sdir = os.path.join(vdir, sha)
                if not os.path.isdir(sdir):
                    continue
                for fn in os.listdir(sdir):
                    dest = os.path.join(m2, *group.split("."), artifact, version, fn)
                    if os.path.exists(dest):
                        continue
                    os.makedirs(os.path.dirname(dest), exist_ok=True)
                    shutil.copy2(os.path.join(sdir, fn), dest)
                    copied += 1
print(f"copied {copied} files into {m2}")
sys.exit(0)
