#!/usr/bin/env python3
from pathlib import Path

vm = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt')
vt = vm.read_text(encoding='utf-8')
old = '''    private suspend fun forwardGeocodeMany(address: String): List<AddressSuggestion> = withContext(Dispatchers.IO) {
        val q = address.trim()
        if (q.length < 3) return@withContext emptyList()
        // 1) Mapbox Geocoding (autocomplete-quality, Greece bias)
        val mapbox = runCatching {
            val token = com.freshdelivery.nativecustomer.BuildConfig.MAPBOX_TOKEN
            val url = java.net.URL(
                "https://api.mapbox.com/geocoding/v5/mapbox.places/" +
                    java.net.URLEncoder.encode(q, "UTF-8") +
                    ".json?access_token=$token&country=gr&language=el&limit=6&types=address,place,locality,neighborhood,poi",
            )
            val conn = (url.openConnection() as java.net.HttpURLConnection).apply {
                connectTimeout = 8000
                readTimeout = 8000
                requestMethod = "GET"
            }
            val body = conn.inputStream.bufferedReader().readText()
            val root = kotlinx.serialization.json.Json.parseToJsonElement(body).jsonObject
            val features = root["features"]?.jsonArray.orEmpty()
            features.mapNotNull { f ->
                val obj = f.jsonObject
                val place = obj["place_name"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
                val center = obj["center"]?.jsonArray ?: return@mapNotNull null
                val lng = center.getOrNull(0)?.jsonPrimitive?.content?.toDoubleOrNull() ?: return@mapNotNull null
                val lat = center.getOrNull(1)?.jsonPrimitive?.content?.toDoubleOrNull() ?: return@mapNotNull null
                AddressSuggestion(place, lat, lng)
            }
        }.getOrElse { emptyList() }
        if (mapbox.isNotEmpty()) return@withContext mapbox.distinctBy { it.label }
        // 2) Android Geocoder fallback
        runCatching {
            @Suppress("DEPRECATION")
            Geocoder(getApplication(), Locale.getDefault())
                .getFromLocationName(q, 5)
                ?.mapNotNull { a ->
                    val line = a.getAddressLine(0) ?: return@mapNotNull null
                    AddressSuggestion(line, a.latitude, a.longitude)
                }
                ?.distinctBy { it.label }
                .orEmpty()
        }.getOrElse { emptyList() }
    }'''

new = '''    private suspend fun forwardGeocodeMany(address: String): List<AddressSuggestion> = withContext(Dispatchers.IO) {
        val q = address.trim()
        if (q.length < 3) return@withContext emptyList()
        val cityBias = listOf("ιωανν", "ioannina", "γιάννεν")
        val hasCity = cityBias.any { q.lowercase().contains(it) }
        val queries = buildList {
            add(q)
            if (!hasCity) {
                add("$q Ιωάννινα")
                add("$q, Ιωάννινα")
            }
        }.distinct()
        val token = com.freshdelivery.nativecustomer.BuildConfig.MAPBOX_TOKEN
        val proximity = "proximity=20.8529,39.6675&bbox=20.65,39.55,21.15,39.90"
        fun mapboxQuery(query: String): List<AddressSuggestion> = runCatching {
            val url = java.net.URL(
                "https://api.mapbox.com/geocoding/v5/mapbox.places/" +
                    java.net.URLEncoder.encode(query, "UTF-8") +
                    ".json?access_token=$token&country=gr&language=el&limit=6" +
                    "&types=address,place,locality,neighborhood,poi&$proximity",
            )
            val conn = (url.openConnection() as java.net.HttpURLConnection).apply {
                connectTimeout = 8000
                readTimeout = 8000
                requestMethod = "GET"
            }
            if (conn.responseCode !in 200..299) {
                conn.errorStream?.bufferedReader()?.readText()
                return@runCatching emptyList()
            }
            val body = conn.inputStream.bufferedReader().readText()
            val root = kotlinx.serialization.json.Json.parseToJsonElement(body).jsonObject
            val features = root["features"]?.jsonArray.orEmpty()
            features.mapNotNull { f ->
                val obj = f.jsonObject
                val place = obj["place_name"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
                val center = obj["center"]?.jsonArray ?: return@mapNotNull null
                val lng = center.getOrNull(0)?.jsonPrimitive?.content?.toDoubleOrNull() ?: return@mapNotNull null
                val lat = center.getOrNull(1)?.jsonPrimitive?.content?.toDoubleOrNull() ?: return@mapNotNull null
                AddressSuggestion(place, lat, lng)
            }
        }.getOrElse { emptyList() }

        val mapbox = queries.flatMap { mapboxQuery(it) }.distinctBy { it.label }
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

if 'bbox=20.65' not in vt and old in vt:
    vt = vt.replace(old, new)
    vm.write_text(vt, encoding='utf-8')
    print('vm')
elif 'bbox=20.65' in vt:
    print('vm already')
else:
    print('WARN vm')

shell = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
st = shell.read_text(encoding='utf-8')

old_sig = '''private fun AddressPickerScreen(
    state: CustomerUiState,
    onBack: () -> Unit,
    onSetDelivery: (String, Double?, Double?) -> Unit,
    onUseLocation: () -> Unit,
    onGeocode: (String) -> Unit,
    onSaveAddress: () -> Unit,
    onSelectSaved: (SavedAddressRow) -> Unit = {},
    onDeleteSaved: (String) -> Unit = {},
    snackbar: SnackbarHostState? = null,
) {'''
new_sig = '''private fun AddressPickerScreen(
    state: CustomerUiState,
    onBack: () -> Unit,
    onSetDelivery: (String, Double?, Double?) -> Unit,
    onUseLocation: () -> Unit,
    onGeocode: (String) -> Unit,
    onAddressQuery: (String) -> Unit = {},
    onPickSuggestion: (AddressSuggestion) -> Unit = {},
    onSaveAddress: () -> Unit,
    onSelectSaved: (SavedAddressRow) -> Unit = {},
    onDeleteSaved: (String) -> Unit = {},
    snackbar: SnackbarHostState? = null,
) {'''
if 'onAddressQuery: (String) -> Unit = {}' not in st[st.find('private fun AddressPickerScreen'):st.find('private fun AddressPickerScreen')+500]:
    if old_sig in st:
        st = st.replace(old_sig, new_sig)
        print('sig')

old_tf = '''            OutlinedTextField(
                value = address,
                onValueChange = { address = it },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                label = { Text("Οδός, αριθμός, πόλη") },
                leadingIcon = { Icon(Icons.Outlined.LocationOn, contentDescription = null, tint = FreshMuted) },
                shape = RoundedCornerShape(16.dp),
                colors = fieldColors,
            )
            if (state.savedAddresses.isNotEmpty()) {'''
new_tf = '''            OutlinedTextField(
                value = address,
                onValueChange = {
                    address = it
                    onAddressQuery(it)
                },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                label = { Text("Οδός, αριθμός (Ιωάννινα)") },
                leadingIcon = { Icon(Icons.Outlined.LocationOn, contentDescription = null, tint = FreshMuted) },
                shape = RoundedCornerShape(16.dp),
                colors = fieldColors,
            )
            if (state.addressSuggestions.isNotEmpty()) {
                Spacer(Modifier.height(8.dp))
                Text("Προτάσεις", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall)
                state.addressSuggestions.forEach { s ->
                    Surface(
                        onClick = {
                            address = s.label
                            onPickSuggestion(s)
                        },
                        shape = RoundedCornerShape(12.dp),
                        color = Color.White,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                    ) {
                        Row(
                            Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(Icons.Outlined.LocationOn, contentDescription = null, tint = FreshGreen, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(8.dp))
                            Text(s.label, style = MaterialTheme.typography.bodyMedium, color = FreshInk)
                        }
                    }
                }
            }
            if (state.savedAddresses.isNotEmpty()) {'''
if 'Οδός, αριθμός (Ιωάννινα)' not in st and old_tf in st:
    st = st.replace(old_tf, new_tf)
    print('tf')

old_call = '''        AddressPickerScreen(
            state = state,
            onBack = { addressOpen = false },
            onSetDelivery = onSetDelivery,
            onUseLocation = onUseLocation,
            onGeocode = onGeocode,
            onSaveAddress = onSaveAddress,
            onSelectSaved = onSelectSaved,
            onDeleteSaved = onDeleteSaved,
            snackbar = snackbar,
        )'''
new_call = '''        AddressPickerScreen(
            state = state,
            onBack = { addressOpen = false },
            onSetDelivery = onSetDelivery,
            onUseLocation = onUseLocation,
            onGeocode = onGeocode,
            onAddressQuery = onAddressQuery,
            onPickSuggestion = onPickSuggestion,
            onSaveAddress = onSaveAddress,
            onSelectSaved = onSelectSaved,
            onDeleteSaved = onDeleteSaved,
            snackbar = snackbar,
        )'''
if 'onAddressQuery = onAddressQuery' not in st and old_call in st:
    st = st.replace(old_call, new_call)
    print('call')

shell.write_text(st, encoding='utf-8')

# version bump
g = Path('native-customer/app/build.gradle.kts')
gt = g.read_text(encoding='utf-8')
for a,b in [('versionCode = 269','versionCode = 270'),('versionCode = 268','versionCode = 270'),
            ('versionName = "2.8.6-fresh2go"','versionName = "2.8.7-fresh2go"'),
            ('versionName = "2.8.5-fresh2go"','versionName = "2.8.7-fresh2go"')]:
    gt = gt.replace(a,b)
g.write_text(gt, encoding='utf-8')
a = Path('src/lib/apk-downloads.ts')
at = a.read_text(encoding='utf-8')
for a0,b0 in [("APK_NATIVE_CUSTOMER_VERSION = '2.8.6-fresh2go'","APK_NATIVE_CUSTOMER_VERSION = '2.8.7-fresh2go'"),
              ("APK_NATIVE_CUSTOMER_VERSION = '2.8.5-fresh2go'","APK_NATIVE_CUSTOMER_VERSION = '2.8.7-fresh2go'")]:
    at = at.replace(a0,b0)
a.write_text(at, encoding='utf-8')
print('done')
