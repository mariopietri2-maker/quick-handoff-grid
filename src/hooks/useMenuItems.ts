import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type MenuItemRow = Database['public']['Tables']['menu_items']['Row'];

export function useMenuItems(storeId: string | null) {
  const [items, setItems] = useState<MenuItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    if (!storeId) return;
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('store_id', storeId)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (!error && data) {
      setItems(data);
    }
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const toggleAvailable = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const { error } = await supabase
      .from('menu_items')
      .update({ is_available: !item.is_available, is_snoozed: false })
      .eq('id', id);
    if (error) {
      toast.error('\u0391\u03c0\u03bf\u03c4\u03c5\u03c7\u03af\u03b1 \u03b5\u03bd\u03b7\u03bc\u03ad\u03c1\u03c9\u03c3\u03b7\u03c2');
    } else {
      setItems((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, is_available: !i.is_available, is_snoozed: false } : i,
        ),
      );
    }
  };

  const toggleSnooze = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const { error } = await supabase
      .from('menu_items')
      .update({ is_snoozed: !item.is_snoozed })
      .eq('id', id);
    if (error) {
      toast.error('\u0391\u03c0\u03bf\u03c4\u03c5\u03c7\u03af\u03b1 \u03b5\u03bd\u03b7\u03bc\u03ad\u03c1\u03c9\u03c3\u03b7\u03c2');
    } else {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, is_snoozed: !i.is_snoozed } : i)),
      );
    }
  };

  const bulkSetSnooze = async (ids: string[], snoozed: boolean) => {
    if (ids.length === 0) return;
    const { error } = await supabase
      .from('menu_items')
      .update({ is_snoozed: snoozed })
      .in('id', ids);
    if (error) {
      toast.error('\u039c\u03b1\u03b6\u03b9\u03ba\u03ae \u03b5\u03bd\u03b7\u03bc\u03ad\u03c1\u03c9\u03c3\u03b7 \u03b1\u03c0\u03ad\u03c4\u03c5\u03c7\u03b5');
    } else {
      toast.success(`${ids.length} \u03c0\u03c1\u03bf\u03ca\u03cc\u03bd\u03c4\u03b1 \u03b5\u03bd\u03b7\u03bc\u03b5\u03c1\u03ce\u03b8\u03b7\u03ba\u03b1\u03bd`);
      setItems((prev) =>
        prev.map((i) => (ids.includes(i.id) ? { ...i, is_snoozed: snoozed } : i)),
      );
    }
  };

  const bulkSetAvailable = async (ids: string[], available: boolean) => {
    if (ids.length === 0) return;
    const { error } = await supabase
      .from('menu_items')
      .update({ is_available: available, is_snoozed: false })
      .in('id', ids);
    if (error) {
      toast.error('\u039c\u03b1\u03b6\u03b9\u03ba\u03ae \u03b5\u03bd\u03b7\u03bc\u03ad\u03c1\u03c9\u03c3\u03b7 \u03b1\u03c0\u03ad\u03c4\u03c5\u03c7\u03b5');
    } else {
      toast.success(`${ids.length} \u03c0\u03c1\u03bf\u03ca\u03cc\u03bd\u03c4\u03b1 \u03b5\u03bd\u03b7\u03bc\u03b5\u03c1\u03ce\u03b8\u03b7\u03ba\u03b1\u03bd`);
      setItems((prev) =>
        prev.map((i) =>
          ids.includes(i.id) ? { ...i, is_available: available, is_snoozed: false } : i,
        ),
      );
    }
  };

  const addItem = async (item: {
    name: string;
    price: number;
    category: string;
    description?: string;
  }) => {
    if (!storeId) return;
    const { error } = await supabase.from('menu_items').insert({ ...item, store_id: storeId });
    if (error) {
      toast.error('\u0391\u03c0\u03bf\u03c4\u03c5\u03c7\u03af\u03b1 \u03c0\u03c1\u03bf\u03c3\u03b8\u03ae\u03ba\u03b7\u03c2');
    } else {
      toast.success('\u03a0\u03c1\u03bf\u03c3\u03c4\u03ad\u03b8\u03b7\u03ba\u03b5!');
      fetchItems();
    }
  };

  const updateItem = async (
    id: string,
    patch: {
      name?: string;
      price?: number;
      category?: string;
      description?: string | null;
    },
  ) => {
    const { error } = await supabase.from('menu_items').update(patch).eq('id', id);
    if (error) {
      toast.error(error.message || '\u0391\u03c0\u03bf\u03c4\u03c5\u03c7\u03af\u03b1 \u03b1\u03c0\u03bf\u03b8\u03ae\u03ba\u03b5\u03c5\u03c3\u03b7\u03c2');
      return false;
    }
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    toast.success('\u0391\u03c0\u03bf\u03b8\u03b7\u03ba\u03b5\u03cd\u03c4\u03b7\u03ba\u03b5');
    return true;
  };

  const updateItemImage = async (id: string, imageUrl: string | null) => {
    const { error } = await supabase
      .from('menu_items')
      .update({ image_url: imageUrl })
      .eq('id', id);
    if (error) {
      toast.error(error.message || '\u0391\u03c0\u03bf\u03c4\u03c5\u03c7\u03af\u03b1 \u03c6\u03c9\u03c4\u03bf\u03b3\u03c1\u03b1\u03c6\u03af\u03b1\u03c2');
      return false;
    }
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, image_url: imageUrl } : i)));
    return true;
  };

  return {
    items,
    loading,
    toggleAvailable,
    toggleSnooze,
    bulkSetSnooze,
    bulkSetAvailable,
    addItem,
    updateItem,
    updateItemImage,
    refetch: fetchItems,
  };
}
