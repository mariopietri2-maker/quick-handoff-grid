#!/usr/bin/env python3
from pathlib import Path

# version
g = Path('native-customer/app/build.gradle.kts')
gt = g.read_text(encoding='utf-8')
gt = gt.replace('versionCode = 268', 'versionCode = 269')
gt = gt.replace('versionName = "2.8.5-fresh2go"', 'versionName = "2.8.6-fresh2go"')
# also if already 269 leave
g.write_text(gt, encoding='utf-8')
print('gradle', '269' in gt or 'versionCode' in gt)

apk = Path('src/lib/apk-downloads.ts')
at = apk.read_text(encoding='utf-8')
at = at.replace("APK_NATIVE_CUSTOMER_VERSION = '2.8.5-fresh2go'", "APK_NATIVE_CUSTOMER_VERSION = '2.8.6-fresh2go'")
apk.write_text(at, encoding='utf-8')

vm = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt')
vt = vm.read_text(encoding='utf-8')
if 'private var cachedStores' not in vt:
    vt = vt.replace(
        '    private var searchJob: Job? = null\n',
        '    private var searchJob: Job? = null\n    private var cachedStores: List<StoreRow> = emptyList()\n',
    )
old_rs = '''    fun refreshStores() {
        viewModelScope.launch {
            runCatching {
                _state.value = _state.value.copy(
                    stores = repo.fetchStores(),
                    storeRatings = repo.fetchStoreRatings(),
                )
            }.onFailure { e ->
                _state.value = _state.value.copy(error = userFacingError(e))
            }
        }
    }'''
new_rs = '''    fun refreshStores() {
        viewModelScope.launch {
            runCatching {
                val stores = repo.fetchStores()
                val ratings = repo.fetchStoreRatings()
                cachedStores = stores
                _state.value = _state.value.copy(
                    stores = stores,
                    storeRatings = ratings,
                )
            }.onFailure { e ->
                _state.value = _state.value.copy(error = userFacingError(e))
            }
        }
    }'''
if 'cachedStores = stores' not in vt and old_rs in vt:
    vt = vt.replace(old_rs, new_rs)

old_sq = '''    fun setSearchQuery(q: String) {
        _state.value = _state.value.copy(searchQuery = q)
        searchJob?.cancel()
        val trimmed = q.trim()
        if (trimmed.isBlank()) {
            refreshStores()
            return
        }
        searchJob = viewModelScope.launch {
            delay(280)
            val results = repo.searchStores(trimmed)
            _state.value = _state.value.copy(stores = results)
        }
    }'''
new_sq = '''    fun setSearchQuery(q: String) {
        _state.value = _state.value.copy(searchQuery = q)
        searchJob?.cancel()
        val trimmed = q.trim()
        if (trimmed.isBlank()) {
            if (cachedStores.isNotEmpty()) {
                _state.value = _state.value.copy(stores = cachedStores)
            } else {
                refreshStores()
            }
            return
        }
        searchJob = viewModelScope.launch {
            delay(220)
            val results = repo.searchStores(trimmed)
            if (_state.value.searchQuery.trim() == trimmed) {
                _state.value = _state.value.copy(stores = results)
            }
        }
    }'''
if 'cachedStores.isNotEmpty()' not in vt and old_sq in vt:
    vt = vt.replace(old_sq, new_sq)

vt2 = vt.replace(
    '''                _state.value = _state.value.copy(orders = orders, trackingOrder = tracked)
                refreshDriverLocation()
                ensureDeliveryCoordsOnTrack(tracked)
                refreshLoyalty()
            }.onFailure { e ->
                _state.value = _state.value.copy(error = userFacingError(e))
            }
        }
    }

    fun refreshLoyalty() {''',
    '''                _state.value = _state.value.copy(orders = orders, trackingOrder = tracked)
                refreshDriverLocation()
                ensureDeliveryCoordsOnTrack(tracked)
            }.onFailure { e ->
                _state.value = _state.value.copy(error = userFacingError(e))
            }
        }
    }

    fun refreshLoyalty() {''',
)
vm.write_text(vt2, encoding='utf-8')
print('vm')

shell = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
st = shell.read_text(encoding='utf-8')
if 'ImageRequest.Builder' not in st:
    if 'import coil.request.ImageRequest' not in st:
        st = st.replace('import coil.compose.AsyncImage', 'import coil.compose.AsyncImage\nimport coil.request.ImageRequest')
    if 'import androidx.compose.ui.platform.LocalContext' not in st:
        st = st.replace('import androidx.compose.ui.Alignment', 'import androidx.compose.ui.Alignment\nimport androidx.compose.ui.platform.LocalContext')
    old_img = '''        } else {
            AsyncImage(
                model = url,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        }
        Box(
            Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.18f)),
                    ),
                ),
        )
    }
}

@Composable
private fun HomeTab('''
    new_img = '''        } else {
            val ctx = LocalContext.current
            AsyncImage(
                model = ImageRequest.Builder(ctx)
                    .data(url)
                    .crossfade(180)
                    .build(),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        }
        Box(
            Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.18f)),
                    ),
                ),
        )
    }
}

@Composable
private fun HomeTab('''
    if old_img in st:
        st = st.replace(old_img, new_img)
        print('coil')
shell.write_text(st, encoding='utf-8')
print('done')
