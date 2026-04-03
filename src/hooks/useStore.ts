import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type StoreRow = Database['public']['Tables']['stores']['Row'];

export function useStore() {
  const { user } = useAuth();
  const [store, setStore] = useState<StoreRow | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStore = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('stores')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle();

    setStore(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchStore();
  }, [fetchStore]);

  const createStore = async (storeData: { name: string; address: string; phone?: string }) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('stores')
      .insert({ ...storeData, owner_id: user.id })
      .select()
      .single();

    if (error) {
      toast.error('Failed to create store');
      return null;
    }
    toast.success('Store created!');
    setStore(data);
    return data;
  };

  const updateStore = async (updates: Partial<Pick<StoreRow, 'is_active' | 'busy_mode' | 'prep_buffer_minutes' | 'name' | 'address' | 'phone'>>) => {
    if (!store) return;
    const { error } = await supabase
      .from('stores')
      .update(updates)
      .eq('id', store.id);

    if (error) {
      toast.error('Failed to update store');
    } else {
      setStore(prev => prev ? { ...prev, ...updates } : prev);
      toast.success('Store updated');
    }
  };

  return { store, loading, createStore, updateStore, refetch: fetchStore };
}
