#!/usr/bin/env python3
from pathlib import Path
import re

# useAdminData: try RPC first
h = Path('src/hooks/useAdminData.ts')
if h.exists():
    t = h.read_text()
    old = '''      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProfileRow[];'''
    new = '''      // Prefer RPC that joins auth.users.email (falls back to profiles only)
      const rpc = await (supabase as any).rpc('admin_profiles_with_email');
      if (!rpc.error && Array.isArray(rpc.data)) {
        return rpc.data as ProfileRow[];
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProfileRow[];'''
    if old in t:
        h.write_text(t.replace(old, new, 1))
        print('useAdminData RPC')
    else:
        print('useAdminData miss')

# AdminUsersSection component
for path in [
    Path('src/components/admin/AdminUsersSection.tsx'),
    Path('src/pages/AdminApp.tsx'),
]:
    if not path.exists():
        continue
    t = path.read_text()
    t2 = t
    t2 = t2.replace(
        '<thead><tr><th>Όνομα</th><th>Κωδικός</th><th>Ρόλος</th><th>Admin</th><th>Τηλέφωνο</th><th>Εγγραφή</th></tr></thead>',
        '<thead><tr><th>Όνομα</th><th>Email</th><th>Κωδικός</th><th>Ρόλος</th><th>Admin</th><th>Τηλέφωνο</th><th>Εγγραφή</th></tr></thead>',
    )
    t2 = t2.replace(
        '<td className="font-medium">{profile.full_name || \'—\'}</td>',
        '<td className="font-medium">{profile.full_name || \'—\'}</td>\n'
        '                  <td className="text-[12px] text-muted-foreground max-w-[180px] truncate" title={profile.email || \'\'}>\n'
        '                    {profile.email || \'—\'}\n'
        '                  </td>',
    )
    # colspan empty state
    t2 = t2.replace('colSpan={6}', 'colSpan={7}')
    if t2 != t:
        path.write_text(t2)
        print(f'updated {path}')
    else:
        print(f'pattern miss {path}')

print('done')
