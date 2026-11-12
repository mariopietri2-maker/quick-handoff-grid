#!/usr/bin/env python3
from pathlib import Path

p = Path('src/pages/AuthPage.tsx')
t = p.read_text()

old = '''        } else if (session) {
          if (driverIntent) {
            await applyDriverRole();
            toast.success('Η αίτηση οδηγού καταχωρήθηκε. Αναμονή έγκρισης.');
          } else {
            toast.success('Συνδεθήκατε! Καλώς ήρθατε.');
          }
        } else {'''

new = '''        } else if (session) {
          if (driverIntent) {
            await applyDriverRole();
            toast.success('Η αίτηση οδηγού καταχωρήθηκε. Αναμονή έγκρισης.');
          } else {
            toast.success('Συνδεθήκατε! Επιβεβαίωσε το κινητό με SMS.');
          }
          if (phone.trim()) {
            setMode('phone_sms');
            setSubmitting(false);
            return;
          }
        } else {'''

if old in t:
    t = t.replace(old, new, 1)
    print('signup -> phone_sms OK')
else:
    print('signup block miss')

# also when no session but no error (email confirm off usually has session)
old2 = '''        } else {
          toast.error('''
# skip fragile

p.write_text(t)
print('done')
