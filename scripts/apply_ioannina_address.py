from pathlib import Path
import re

def main() -> None:
    vm = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
    t = vm.read_text()
    if "IOA_MIN_LAT" not in t:
        anchor = "class CustomerViewModel("
        idx = t.find(anchor)
        brace = t.find("{", idx)
        insert = """
    companion object {
        /** Soft delivery area around Ioannina (bias + filter, not a hard lock). */
        private const val IOA_MIN_LAT = 39.58
        private const val IOA_MAX_LAT = 39.75
        private const val IOA_MIN_LNG = 20.72
        private const val IOA_MAX_LNG = 20.98
    }

    private fun inIoanninaArea(lat: Double, lng: Double): Boolean =
        lat in IOA_MIN_LAT..IOA_MAX_LAT && lng in IOA_MIN_LNG..IOA_MAX_LNG

    private fun biasToIoannina(query: String): String {
        val q = query.trim()
        if (q.isEmpty()) return q
        val lower = q.lowercase()
        if ("ιωάννιν" in lower || "ιωαννιν" in lower || "ioannina" in lower || "giannina" in lower) {
            return q
        }
        return "$q, Ιωάννινα"
    }

"""
        t = t[: brace + 1] + insert + t[brace + 1 :]

    old_loc = """                val label = reverseGeocode(loc.latitude, loc.longitude)
                _state.value = _state.value.copy(
                    locating = false,
                    deliveryLat = loc.latitude,
                    deliveryLng = loc.longitude,
                    deliveryAddress = label ?: _state.value.deliveryAddress,
                    addressSuggestions = emptyList(),
                    info = "Η τοποθεσία ενημερώθηκε",
                )
                recomputeDeliveryFee()
                persistLastAddress()
                if (label != null) seedGeocodeCache(label, loc.latitude, loc.longitude)"""
    new_loc = """                if (!inIoanninaArea(loc.latitude, loc.longitude)) {
                    error("Η τοποθεσία σου είναι εκτός περιοχής Ιωαννίνων. Επίλεξε διεύθυνση μέσα στην πόλη.")
                }
                val label = reverseGeocode(loc.latitude, loc.longitude)
                _state.value = _state.value.copy(
                    locating = false,
                    deliveryLat = loc.latitude,
                    deliveryLng = loc.longitude,
                    deliveryAddress = label ?: _state.value.deliveryAddress,
                    addressSuggestions = emptyList(),
                    info = "Τοποθεσία στην περιοχή Ιωαννίνων",
                )
                recomputeDeliveryFee()
                persistLastAddress()
                if (label != null) seedGeocodeCache(label, loc.latitude, loc.longitude)"""
    if old_loc in t:
        t = t.replace(old_loc, new_loc, 1)
        print("loc ok")
    else:
        print("loc skip")

    old_geo = """    private suspend fun forwardGeocodeMany(address: String): List<AddressSuggestion> = withContext(Dispatchers.IO) {
        runCatching {
            @Suppress("DEPRECATION")
            Geocoder(getApplication(), Locale.getDefault())
                .getFromLocationName(address, 5)
                ?.mapNotNull { a ->
                    val line = a.getAddressLine(0) ?: return@mapNotNull null
                    AddressSuggestion(line, a.latitude, a.longitude)
                }
                ?.distinctBy { it.label }
                .orEmpty()
        }.getOrElse { emptyList() }
    }"""
    new_geo = """    private suspend fun forwardGeocodeMany(address: String): List<AddressSuggestion> = withContext(Dispatchers.IO) {
        runCatching {
            val biased = biasToIoannina(address)
            @Suppress("DEPRECATION")
            val geocoder = Geocoder(getApplication(), Locale("el", "GR"))
            val boxed = geocoder.getFromLocationName(
                biased, 8, IOA_MIN_LAT, IOA_MIN_LNG, IOA_MAX_LAT, IOA_MAX_LNG,
            ).orEmpty()
            val fallback = if (boxed.isEmpty()) geocoder.getFromLocationName(biased, 8).orEmpty() else boxed
            fallback.mapNotNull { a ->
                val line = a.getAddressLine(0) ?: return@mapNotNull null
                if (!inIoanninaArea(a.latitude, a.longitude)) return@mapNotNull null
                AddressSuggestion(line, a.latitude, a.longitude)
            }.distinctBy { it.label }
        }.getOrElse { emptyList() }
    }"""
    if old_geo in t:
        t = t.replace(old_geo, new_geo, 1)
        print("geo ok")
    else:
        print("geo skip")

    t = t.replace(
        'hits.isEmpty() -> {\n                    _state.value = _state.value.copy(locating = false, error = "Δεν βρέθηκε η διεύθυνση")\n                }',
        'hits.isEmpty() -> {\n                    _state.value = _state.value.copy(\n                        locating = false,\n                        error = "Δεν βρέθηκε στην περιοχή Ιωαννίνων. Δοκίμασε οδό + αριθμό (π.χ. Δωδώνης 15)",\n                    )\n                }',
        1,
    )
    vm.write_text(t)
    print("vm written")

    shell = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
    st = shell.read_text()
    if "Παράδοση στην περιοχή Ιωαννίνων" in st:
        print("shell already")
    else:
        old_field = """            OutlinedTextField(
                value = address,
                onValueChange = {
                    address = it
                    onAutocomplete(it)
                },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                label = { Text("Οδός, αριθμός, πόλη") },
                leadingIcon = { Icon(Icons.Outlined.LocationOn, contentDescription = null, tint = FreshMuted) },
                shape = RoundedCornerShape(16.dp),
                colors = fieldColors,
            )
            if (state.savedAddresses.isNotEmpty()) {"""
        new_field = """            Text(
                "Παράδοση στην περιοχή Ιωαννίνων",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                color = FreshInk,
            )
            Text(
                "Γράψε οδό και αριθμό — θα ψάξουμε αυτόματα στα Ιωάννινα. Δεν χρειάζεται να γράψεις την πόλη.",
                style = MaterialTheme.typography.bodySmall,
                color = FreshMuted,
                modifier = Modifier.padding(top = 4.dp, bottom = 12.dp),
            )
            OutlinedTextField(
                value = address,
                onValueChange = {
                    address = it
                    onAutocomplete(it)
                },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                label = { Text("Οδός και αριθμός") },
                placeholder = { Text("π.χ. Δωδώνης 15") },
                leadingIcon = { Icon(Icons.Outlined.LocationOn, contentDescription = null, tint = FreshGreen) },
                shape = RoundedCornerShape(16.dp),
                colors = fieldColors,
            )
            Spacer(Modifier.height(10.dp))
            Text("Γρήγορες περιοχές", fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.labelLarge, color = FreshMuted)
            Spacer(Modifier.height(6.dp))
            val quickAreas = listOf(
                "Κέντρο Ιωαννίνων",
                "Ανατολή",
                "Κατσικάς",
                "Εξοχή",
                "Περίβλεπτος",
                "Νεοχωρόπουλο",
            )
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                quickAreas.chunked(3).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                        row.forEach { area ->
                            FilterChip(
                                selected = false,
                                onClick = {
                                    address = area
                                    onAutocomplete(area)
                                    onGeocode(area)
                                },
                                label = { Text(area, maxLines = 1, style = MaterialTheme.typography.labelMedium) },
                                colors = FilterChipDefaults.filterChipColors(
                                    containerColor = FreshChip,
                                    labelColor = FreshInk,
                                ),
                                modifier = Modifier.weight(1f),
                            )
                        }
                        repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
            Spacer(Modifier.height(8.dp))
            if (state.savedAddresses.isNotEmpty()) {"""
        if old_field not in st:
            raise SystemExit("shell field missing")
        st = st.replace(old_field, new_field, 1)
        shell.write_text(st)
        print("shell written")

    g = Path("native-customer/app/build.gradle.kts")
    gt = g.read_text()
    gt = re.sub(r"versionCode = \d+", "versionCode = 253", gt, count=1)
    gt = re.sub(r'versionName = "[^"]+"', 'versionName = "2.7.1-native"', gt, count=1)
    g.write_text(gt)
    print("gradle ok")

if __name__ == "__main__":
    main()
