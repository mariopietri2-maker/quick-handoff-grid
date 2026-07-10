import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { geocodeAddress } from '@/lib/geocode';
import type { Database } from '@/integrations/supabase/types';

type StoreRow = Database['public']['Tables']['stores']['Row'];

const SELECTED_STORE_KEY = 'selected_store_id_v1';

export function useStore() {
  const { user } = useAuth();
  const [store, setStore] = useState<StoreRow | null>(null);
  const [allStores, setAllStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStore = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('stores')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true });

    const stores = (data as StoreRow[]) ?? [];
    setAllStores(stores);

    if (stores.length === 0) {
      setStore(null);
    } else if (stores.length === 1) {
      setStore(stores[0]);
    } else {
      // Restore previously selected store, fallback to first
      const saved = localStorage.getItem(SELECTED_STORE_KEY);
      const found = stores.find(s => s.id === saved) ?? stores[0];
      setStore(found);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchStore();
  }, [fetchStore]);

  const selectStore = (storeId: string) => {
    const found = allStores.find(s => s.id === storeId);
    if (found) {
      setStore(found);
      localStorage.setItem(SELECTED_STORE_KEY, storeId);
    }
  };

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
      toast.error('Αποτυχία δημιουργίας καταστήματος');
      return null;
    }
    toast.success('Κατάστημα δημιουργήθηκε!');
    setAllStores(prev => [...prev, data]);
    setStore(data);
    localStorage.setItem(SELECTED_STORE_KEY, data.id);
    return data;
  };

  const updateStore = async (updates: Partial<Pick<StoreRow, 'is_active' | 'busy_mode' | 'prep_buffer_minutes' | 'name' | 'address' | 'phone' | 'image_url'>>) => {
    if (!store) return;

    let coordPatch: { latitude?: number; longitude?: number } = {};
    if (updates.address && updates.address !== store.address) {
      const res = await geocodeAddress(updates.address);
      if (res) coordPatch = { latitude: res.latitude, longitude: res.longitude };
    }

    const payload = { ...updates, ...coordPatch };
    const { error } = await supabase
      .from('stores')
      .update(payload)
      .eq('id', store.id);

    if (error) {
      toast.error('Αποτυχία ενημέρωσης');
    } else {
      setStore(prev => prev ? { ...prev, ...payload } : prev);
      setAllStores(prev => prev.map(s => s.id === store.id ? { ...s, ...payload } : s));
      toast.success('Κατάστημα ενημερώθηκε');
    }
  };

  return { store, allStores, loading, createStore, updateStore, selectStore, refetch: fetchStore };
}
