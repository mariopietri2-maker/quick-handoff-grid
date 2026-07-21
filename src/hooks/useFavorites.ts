import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface FavoriteRow {
  id: string;
  store_id: string | null;
  menu_item_id: string | null;
}

type Listener = (rows: FavoriteRow[]) => void;

let cacheUserId: string | null = null;
let cacheRows: FavoriteRow[] = [];
let cacheLoading = false;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((fn) => fn(cacheRows));
}

async function loadFavorites(userId: string) {
  cacheLoading = true;
  const { data } = await supabase
    .from('customer_favorites' as any)
    .select('id, store_id, menu_item_id')
    .eq('user_id', userId);
  cacheRows = (data ?? []) as any;
  cacheUserId = userId;
  cacheLoading = false;
  emit();
}

export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteRow[]>(
    () => (user && cacheUserId === user.id ? cacheRows : []),
  );
  const [loading, setLoading] = useState(() => !user || cacheLoading || cacheUserId !== user?.id);

  useEffect(() => {
    if (!user) {
      cacheUserId = null;
      cacheRows = [];
      setFavorites([]);
      setLoading(false);
      return;
    }
    const onUpdate: Listener = (rows) => {
      setFavorites(rows);
      setLoading(false);
    };
    listeners.add(onUpdate);
    if (cacheUserId === user.id && !cacheLoading) {
      setFavorites(cacheRows);
      setLoading(false);
    } else {
      setLoading(true);
      void loadFavorites(user.id);
    }
    return () => { listeners.delete(onUpdate); };
  }, [user?.id]);

  const fetchFavorites = useCallback(async () => {
    if (!user) {
      setFavorites([]);
      setLoading(false);
      return;
    }
    await loadFavorites(user.id);
  }, [user]);

  const isStoreFavorite = (storeId: string) =>
    favorites.some((f) => f.store_id === storeId);
  const isItemFavorite = (itemId: string) =>
    favorites.some((f) => f.menu_item_id === itemId);

  const toggleStore = async (storeId: string) => {
    if (!user) {
      toast.error('Συνδεθείτε για να αποθηκεύσετε αγαπημένα');
      return;
    }
    const existing = favorites.find((f) => f.store_id === storeId);
    if (existing) {
      const { error } = await supabase
        .from('customer_favorites' as any)
        .delete()
        .eq('id', existing.id);
      if (error) { toast.error('Αποτυχία'); return; }
      cacheRows = cacheRows.filter((f) => f.id !== existing.id);
      emit();
    } else {
      const { data, error } = await supabase
        .from('customer_favorites' as any)
        .insert({ user_id: user.id, store_id: storeId, menu_item_id: null } as any)
        .select('id, store_id, menu_item_id')
        .single();
      if (error) { toast.error('Αποτυχία'); return; }
      if (data) {
        cacheRows = [...cacheRows, data as any];
        emit();
        toast.success('Προστέθηκε στα αγαπημένα ❤️');
      }
    }
  };

  const toggleItem = async (itemId: string) => {
    if (!user) {
      toast.error('Συνδεθείτε για να αποθηκεύσετε αγαπημένα');
      return;
    }
    const existing = favorites.find((f) => f.menu_item_id === itemId);
    if (existing) {
      const { error } = await supabase
        .from('customer_favorites' as any)
        .delete()
        .eq('id', existing.id);
      if (error) { toast.error('Αποτυχία'); return; }
      cacheRows = cacheRows.filter((f) => f.id !== existing.id);
      emit();
    } else {
      const { data, error } = await supabase
        .from('customer_favorites' as any)
        .insert({ user_id: user.id, store_id: null, menu_item_id: itemId } as any)
        .select('id, store_id, menu_item_id')
        .single();
      if (error) { toast.error('Αποτυχία'); return; }
      if (data) {
        cacheRows = [...cacheRows, data as any];
        emit();
        toast.success('Προστέθηκε στα αγαπημένα ❤️');
      }
    }
  };

  return {
    favorites,
    loading,
    isStoreFavorite,
    isItemFavorite,
    toggleStore,
    toggleItem,
    refetch: fetchFavorites,
  };
}
