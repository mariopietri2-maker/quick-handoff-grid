#!/usr/bin/env python3
from pathlib import Path
p = Path('src/pages/DownloadAppPage.tsx')
t = p.read_text(encoding='utf-8')

# Button shows version
old_btn = '''      <Button
        type="button"
        className="mt-5 w-full max-w-xs font-heading font-bold rounded-xl h-11"
        onClick={() => startApkDownload(flavor)}
      >
        <Download className="h-4 w-4 mr-2" />
        Κατέβασε {apk.title} · {apk.sizeLabel}
      </Button>'''
new_btn = '''      <Button
        type="button"
        className="mt-5 w-full max-w-xs font-heading font-bold rounded-xl h-11"
        onClick={() => startApkDownload(flavor)}
      >
        <Download className="h-4 w-4 mr-2" />
        Κατέβασε · v{apk.versionLabel}
      </Button>
      <p className="mt-2 text-[11px] text-muted-foreground">{apk.sizeLabel}</p>'''
if 'Κατέβασε · v{apk.versionLabel}' not in t and old_btn in t:
    t = t.replace(old_btn, new_btn)
    print('btn')

old_grid = '''        <div className="grid sm:grid-cols-2 gap-5 sm:gap-6">
          <StorePwaCard highlighted={params.get('app') === 'store'} />
          <ApkCard flavor="driverNative" highlighted={focus === 'driverNative'} />
          <ApkCard flavor="customerNative" highlighted={focus === 'customerNative'} />
          <ApkCard flavor="driver" highlighted={focus === 'driver'} />
          <ApkCard flavor="customer" highlighted={focus === 'customer'} />
        </div>'''
new_grid = '''        <div className="grid sm:grid-cols-2 gap-5 sm:gap-6">
          <ApkCard
            flavor="customerNative"
            highlighted={focus === 'customerNative' || focus == null}
          />
          <ApkCard flavor="driverNative" highlighted={focus === 'driverNative'} />
          <StorePwaCard highlighted={params.get('app') === 'store'} />
          <ApkCard flavor="driver" highlighted={focus === 'driver'} />
          <ApkCard flavor="customer" highlighted={focus === 'customer'} />
        </div>'''
if 'focus === \'customerNative\' || focus == null' not in t and 'focus === "customerNative" || focus == null' not in t:
    if old_grid in t:
        t = t.replace(old_grid, new_grid)
        print('grid')
    else:
        print('WARN grid')

old_copy = '''          <p className="mt-3 text-muted-foreground text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
            Capacitor και Native για πελάτη και οδηγό, plus Store PWA χωρίς APK.
          </p>'''
new_copy = '''          <p className="mt-3 text-muted-foreground text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
            Κατέβασε το <strong className="text-foreground">Native Πελάτης</strong> (τελευταίο build) ή οδηγό.
            Store είναι PWA — χωρίς APK.
          </p>'''
if 'Native Πελάτης' not in t and old_copy in t:
    t = t.replace(old_copy, new_copy)
    print('copy')

p.write_text(t, encoding='utf-8')
print('done')
