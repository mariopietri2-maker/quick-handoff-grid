#!/usr/bin/env python3
from pathlib import Path

vm = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt')
vt = vm.read_text(encoding='utf-8')

helper = '''
    /** Strict Ioannina service area — suggestions outside are dropped. */
    private fun isIoanninaSuggestion(label: String, lat: Double, lng: Double): Boolean {
        val inBox = lat in 39.55..39.82 && lng in 20.70..21.05
        if (!inBox) return false
        val l = label.lowercase()
        val blocked = listOf(
            "αθήνα", "athens", "θεσσαλονίκη", "thessaloniki", "πάτρα", "patra",
            "λάρισα", "ηράκλειο", "βόλος", "καβάλα",
        )
        if (blocked.any { it in l }) return false
        return true
    }

'''

if 'isIoanninaSuggestion' not in vt:
    vt = vt.replace(
        '    private suspend fun forwardGeocodeMany(address: String):',
        helper + '    private suspend fun forwardGeocodeMany(address: String):',
    )
    print('helper')

old_ret = '''        val mapbox = queries.flatMap { mapboxQuery(it) }.distinctBy { it.label }
        if (mapbox.isNotEmpty()) return@withContext mapbox
        val geoQueries = if (hasCity) listOf(q) else listOf(q, "$q Ιωάννινα")
        geoQueries.flatMap { gq ->
            runCatching {
                @Suppress("DEPRECATION")
                Geocoder(getApplication(), Locale.getDefault())
                    .getFromLocationName(gq, 5)
                    ?.mapNotNull { a ->
                        val line = a.getAddressLine(0) ?: return@mapNotNull null
                        AddressSuggestion(line, a.latitude, a.longitude)
                    }
                    .orEmpty()
            }.getOrElse { emptyList() }
        }.distinctBy { it.label }
    }'''

new_ret = '''        val mapbox = queries.flatMap { mapboxQuery(it) }
            .filter { isIoanninaSuggestion(it.label, it.lat, it.lng) }
            .distinctBy { it.label }
        if (mapbox.isNotEmpty()) return@withContext mapbox
        val geoQueries = if (hasCity) listOf(q) else listOf(q, "$q Ιωάννινα")
        geoQueries.flatMap { gq ->
            runCatching {
                @Suppress("DEPRECATION")
                Geocoder(getApplication(), Locale.getDefault())
                    .getFromLocationName(gq, 5)
                    ?.mapNotNull { a ->
                        val line = a.getAddressLine(0) ?: return@mapNotNull null
                        if (!isIoanninaSuggestion(line, a.latitude, a.longitude)) return@mapNotNull null
                        AddressSuggestion(line, a.latitude, a.longitude)
                    }
                    .orEmpty()
            }.getOrElse { emptyList() }
        }.distinctBy { it.label }
    }'''

if 'isIoanninaSuggestion(it.label' not in vt and old_ret in vt:
    vt = vt.replace(old_ret, new_ret)
    print('filter')
elif 'isIoanninaSuggestion(it.label' in vt:
    print('filter already')
else:
    print('WARN filter')

vt = vt.replace(
    'val proximity = "proximity=20.8529,39.6675&bbox=20.65,39.55,21.15,39.90"',
    'val proximity = "proximity=20.8529,39.6675&bbox=20.70,39.55,21.05,39.82"',
)

vm.write_text(vt, encoding='utf-8')
print('done')
