#!/usr/bin/env python3
"""Apply store cache + Coil sizing if missing."""
from pathlib import Path

vm = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt')
t = vm.read_text()
if 'storesCacheAtMs' not in t:
    if 'private var allStoresCache' in t:
        t = t.replace(
            'private var allStoresCache',
            'private var storesCacheAtMs: Long = 0L\n    private var allStoresCache',
            1,
        )
    else:
        raise SystemExit('allStoresCache missing')
old = '''    fun refreshStores() {
        viewModelScope.launch {
            runCatching {
                val list = repo.fetchStores()
                allStoresCache = list
                // Don't clobber an active search with the full catalogue.
                val q = _state.value.searchQuery.trim()
                val shown = if (q.isBlank()) list else filterStoresLocal(list, q)
                _state.value = _state.value.copy(
                    stores = shown,
                    storeRatings = repo.fetchStoreRatings(),
                )
            }.onFailure { e ->
                _state.value = _state.value.copy(error = e.message)
            }
        }
    }'''
new = '''    fun refreshStores(force: Boolean = false) {
        viewModelScope.launch {
            runCatching {
                val now = System.currentTimeMillis()
                val cached = allStoresCache
                val list = if (!force && cached.isNotEmpty() && now - storesCacheAtMs < 5 * 60 * 1000L) {
                    cached
                } else {
                    val fetched = repo.fetchStores()
                    allStoresCache = fetched
                    storesCacheAtMs = now
                    fetched
                }
                // Don't clobber an active search with the full catalogue.
                val q = _state.value.searchQuery.trim()
                val shown = if (q.isBlank()) list else filterStoresLocal(list, q)
                val ratings = runCatching { repo.fetchStoreRatings() }.getOrDefault(_state.value.storeRatings)
                _state.value = _state.value.copy(
                    stores = shown,
                    storeRatings = ratings,
                )
            }.onFailure { e ->
                _state.value = _state.value.copy(error = e.message)
            }
        }
    }'''
if 'fun refreshStores(force: Boolean' not in t:
    if old not in t:
        raise SystemExit('refreshStores pattern missing')
    t = t.replace(old, new, 1)
vm.write_text(t)
print('viewmodel ok')

shell = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
s = shell.read_text()
old_i = '''            AsyncImage(
                model = ImageRequest.Builder(ctx)
                    .data(url)
                    .crossfade(180)
                    .build(),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )'''
new_i = '''            AsyncImage(
                model = ImageRequest.Builder(ctx)
                    .data(url)
                    .size(960, 540)
                    .crossfade(160)
                    .memoryCacheKey(url)
                    .build(),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )'''
if '.size(960, 540)' not in s:
    if old_i not in s:
        print('image pattern miss — skip')
    else:
        shell.write_text(s.replace(old_i, new_i))
        print('shell images ok')
else:
    print('shell images already')
print('done')
