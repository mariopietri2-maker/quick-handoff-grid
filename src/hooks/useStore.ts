import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { geocodeAddress } from '@/lib/geocode';
import type { Database } from '@/integrations/supabase/types';

type StoreRow = Database['public']['Tables']['stores']['Row'];

const LS_SELECTED_STORE = 'owner_selected_store_v1';

function readStoredSelection(): string | null {
  try {
    return localStorage.getItem(LS_SELECTED_STORE);
  } catch {
    return null;
  }
}

function writeStoredSelection(id: string | null) {
  try {
    if (id) localStorage.setItem(LS_SELECTED_STORE, id);
    else localStorage.removeItem(LS_SELECTED_STORE);
  } catch {
    /* ignore */
  }
}

function storeIdFromUrl(): string | null {
  try {
    return new URLSearchParams(window.location.search).get('store');
  } catch {
    return null;
  }
}

export function useStore() {
  const { user } = useAuth();
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStores = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      setStores([]);
      setLoading(false);
      return;
    }

    const list = (data ?? []) as StoreRow[];
    setStores(list);

    const fromUrl = storeIdFromUrl();
    const fromLs = readStoredSelection();
    const preferred =
      (fromUrl && list.some((s) => s.id === fromUrl) && fromUrl) ||
      (fromLs && list.some((s) => s.id === fromLs) && fromLs) ||
      (list.length === 1 ? list[0].id : null);

    setSelectedStoreId(preferred);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  const selectStore = useCallback((id: string | null) => {
    setSelectedStoreId(id);
    writeStoredSelection(id);
    try {
      const url = new URL(window.location.href);
      if (id) url.searchParams.set('store', id);
      else url.searchParams.delete('store');
      window.history.replaceState({}, '', url.toString());
    } catch {
      /* ignore */
    }
  }, []);

  const store = useMemo(
    () => stores.find((s) => s.id === selectedStoreId) ?? null,
    [stores, selectedStoreId],
  );

  const createStore = async (storeData: { name: string; address: string; phone?: string }) => {
    if (!user) return null;

    let geo: { latitude: number; longitude: number } | null = null;
    if (storeData.address) {
      const res = await geocodeAddress(storeData.address);
      if (res) geo = { latitude: res.latitude, longitude: res.longitude };
    }

    const { data, error } = await supabase
      .from('stores')
      .insert({ ...storeData, ...(geo ?? {}), owner_id: user.id })
      .select()
      .single();

    if (error) {
      toast.error(error.message || 'Αποτυχία δημιουργίας καταστήματος');
      return null;
    }
    toast.success('Το κατάστημα δημιουργήθηκε');
    await fetchStores();
    if (data?.id) selectStore(data.id);
    return data;
  };

  const updateStore = async (
    updates: Partial<
      Pick<
        StoreRow,
        'is_active' | 'busy_mode' | 'prep_buffer_minutes' | 'name' | 'address' | 'phone' | 'image_url'
      >
    >,
    targetId?: string,
  ) => {
    const id = targetId ?? store?.id;
    if (!id) return;

    const current = stores.find((s) => s.id === id) ?? store;
    let coordPatch: { latitude?: number; longitude?: number } = {};
    if (updates.address && current && updates.address !== current.address) {
      const res = await geocodeAddress(updates.address);
      if (res) coordPatch = { latitude: res.latitude, longitude: res.longitude };
    }

    const payload = { ...updates, ...coordPatch };
    const { error } = await supabase.from('stores').update(payload).eq('id', id);

    if (error) {
      toast.error('Αποτυχία ενημέρωσης');
    } else {
      setStores((prev) => prev.map((s) => (s.id === id ? { ...s, ...payload } : s)));
      toast.success('Ενημερώθηκε');
    }
  };

  return {
    store,
    stores,
    selectedStoreId,
    selectStore,
    loading,
    createStore,
    updateStore,
    refetch: fetchStores,
  };
}
