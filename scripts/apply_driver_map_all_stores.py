#!/usr/bin/env python3
from pathlib import Path
import re

p = Path("src/hooks/useNearbyStoresForDriver.ts")
t = p.read_text(encoding="utf-8")

# Remove the 18km Ioannina hard filter — it hid valid stores with slightly off coords.
old = """    const IOANNINA_LAT = 39.6650;
    const IOANNINA_LNG = 20.8537;
    const MAX_KM = 18;
    const distKm = (lat: number, lng: number) => {
      const toRad = (d: number) => (d * Math.PI) / 180;
      const dLat = toRad(lat - IOANNINA_LAT);
      const dLng = toRad(lng - IOANNINA_LNG);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(IOANNINA_LAT)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
      return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const applyCounts"""

new = """    // Show every active store that has coordinates (stores_public already filters
    // is_active + not suspended). No city radius — missing pins were often just
    // outside the old 18km box or had slightly wrong coords.
    const applyCounts"""

if old in t:
    t = t.replace(old, new)
    print("removed radius")
elif "No city radius" in t:
    print("already")
else:
    print("WARN radius block")

old_filter = """        .filter(
          (s) =>
            s.latitude != null &&
            s.longitude != null &&
            distKm(Number(s.latitude), Number(s.longitude)) <= MAX_KM,
        )"""
new_filter = """        .filter(
          (s) =>
            s.latitude != null &&
            s.longitude != null &&
            Number.isFinite(Number(s.latitude)) &&
            Number.isFinite(Number(s.longitude)) &&
            // Drop obvious null-island / unset pins
            !(Number(s.latitude) === 0 && Number(s.longitude) === 0),
        )"""
if old_filter in t:
    t = t.replace(old_filter, new_filter)
    print("filter updated")
elif "null-island" in t:
    print("filter already")
else:
    print("WARN filter")

p.write_text(t, encoding="utf-8")

# Native: raise limit and document requirement
r = Path("native-driver/app/src/main/java/com/freshdelivery/nativedriver/data/DriverRepository.kt")
rt = r.read_text(encoding="utf-8")
old_n = """    suspend fun fetchMapStores(): List<StoreRow> {
        return client.from("stores_public")
            .select(Columns.list("id", "name", "latitude", "longitude", "image_url", "cover_image_url", "is_active")) {
                order("name", Order.ASCENDING)
                limit(150L)
            }.decodeList<StoreRow>()
            .filter { (it.is_active != false) && it.latitude != null && it.longitude != null }
    }"""
new_n = """    suspend fun fetchMapStores(): List<StoreRow> {
        // stores_public = is_active + not suspended. Require real lat/lng.
        return client.from("stores_public")
            .select(Columns.list("id", "name", "latitude", "longitude", "image_url", "cover_image_url", "is_active")) {
                order("name", Order.ASCENDING)
                limit(300L)
            }.decodeList<StoreRow>()
            .filter {
                (it.is_active != false) &&
                    it.latitude != null &&
                    it.longitude != null &&
                    !(it.latitude == 0.0 && it.longitude == 0.0)
            }
    }"""
if old_n in rt:
    rt = rt.replace(old_n, new_n)
    r.write_text(rt, encoding="utf-8")
    print("native ok")
elif "limit(300L)" in rt:
    print("native already")
else:
    print("WARN native")

print("done")
