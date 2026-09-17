#!/usr/bin/env python3
"""Apply role-routing + Navigate fixes on checked-out main."""
from pathlib import Path

# --- CustomerApp ---
p = Path('src/pages/CustomerApp.tsx')
t = p.read_text()
if "from 'react-router-dom'" in t and 'Navigate' not in [x.strip() for x in t[t.find("from 'react-router-dom")-80:t.find("from 'react-router-dom")].split(',')]:
    t = t.replace(
        "import { useNavigate, Link, useSearchParams } from 'react-router-dom';",
        "import { useNavigate, Link, useSearchParams, Navigate } from 'react-router-dom';",
    )
if 'const { user, profile } = useAuth();' in t:
    t = t.replace(
        'const { user, profile } = useAuth();',
        'const { user, profile, isStore } = useAuth();',
    )
if 'Store owners must not see customer shell' not in t:
    marker = '\n  return (\n    <div'
    idx = t.find(marker)
    if idx < 0:
        marker = '\n  return (\n    <>'
        idx = t.find(marker)
    if idx < 0:
        raise SystemExit('CustomerApp return marker not found')
    inject = '''
  // Store owners must not see customer shell
  if (isStore || profile?.role === 'store') {
    return <Navigate to="/store" replace />;
  }
'''
    t = t[:idx] + inject + t[idx:]
p.write_text(t)
print('CustomerApp patched')

# --- AuthPage roleHome ---
p = Path('src/pages/AuthPage.tsx')
t = p.read_text()
if 'isStore?: boolean' not in t:
    t = t.replace(
        """function roleHome(opts: {
  isAdmin: boolean;
  isSupport: boolean;
  role: string;
  nextPath: string;
  flavor: MobileAppFlavor;
}): string {
  if (opts.isAdmin && opts.flavor === 'shared') return '/admin';
  if (opts.isSupport && opts.flavor === 'shared') return '/support';
  if (opts.role === 'm') return '/driver';
  if (opts.role === 'driver') return '/driver';
  if (opts.role === 'store' || opts.flavor === 'store') return '/store';""",
        """function roleHome(opts: {
  isAdmin: boolean;
  isSupport: boolean;
  role: string;
  isStore?: boolean;
  nextPath: string;
  flavor: MobileAppFlavor;
}): string {
  if (opts.isAdmin && opts.flavor === 'shared') return '/admin';
  if (opts.isSupport && opts.flavor === 'shared') return '/support';
  if (opts.role === 'm') return '/driver';
  if (opts.role === 'driver') return '/driver';
  if (opts.role === 'store' || opts.isStore || opts.flavor === 'store') return '/store';""",
    )
if 'roleHome({ isAdmin, isSupport, role: profile.role, nextPath, flavor })' in t:
    t = t.replace(
        'roleHome({ isAdmin, isSupport, role: profile.role, nextPath, flavor })',
        'roleHome({ isAdmin, isSupport, role: profile.role, isStore, nextPath, flavor })',
    )
if 'const { signIn, signUp, user, profile, isAdmin, isSupport, loading, refreshProfile } = useAuth();' in t:
    t = t.replace(
        'const { signIn, signUp, user, profile, isAdmin, isSupport, loading, refreshProfile } = useAuth();',
        'const { signIn, signUp, user, profile, isAdmin, isSupport, isStore, loading, refreshProfile } = useAuth();',
    )
p.write_text(t)
print('AuthPage patched')

# --- ViewModel from git history ---
import subprocess
vm = Path('native-driver/app/src/main/java/com/freshdelivery/nativedriver/ui/DriverViewModel.kt')
cur = vm.read_text() if vm.exists() else ''
if cur.strip() == 'PLACEHOLDER' or 'class DriverViewModel' not in cur:
    subprocess.check_call([
        'git', 'show',
        '44a5ebcce5c6dbd1772ab10e9e790ecf91206bb7:native-driver/app/src/main/java/com/freshdelivery/nativedriver/ui/DriverViewModel.kt',
    ], stdout=open(vm, 'w'))
    t = vm.read_text()
    old = '''            }.onFailure { e ->
                _state.value = _state.value.copy(
                    busy = false,
                    error = handleError("acceptStoreCall", e),
                    storeCalls = if (removed != null && _state.value.storeCalls.none { it.id == removed.id }) {
                        (_state.value.storeCalls + removed)
                    } else _state.value.storeCalls,
                )
                refreshWork()
            }'''
    new = '''            }.onFailure { e ->
                val msg = friendlyError(e)
                viewModelScope.launch { runCatching { repo.logAppError("acceptStoreCall", e.message ?: msg) } }
                _state.value = _state.value.copy(
                    busy = false,
                    error = msg,
                    storeCalls = if (removed != null && _state.value.storeCalls.none { it.id == removed.id }) {
                        (_state.value.storeCalls + removed)
                    } else _state.value.storeCalls,
                )
                refreshWork()
            }'''
    if old in t:
        vm.write_text(t.replace(old, new, 1))
        print('ViewModel restored+patched')
    else:
        print('ViewModel restored (pattern may already differ)')
else:
    print('ViewModel already good')
print('ALL DONE')
