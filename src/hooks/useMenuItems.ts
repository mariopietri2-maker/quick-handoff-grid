import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
    const item = items.find(i => i.id === id);
    if (!item) return;
    const { error } = await supabase
      .from('menu_items')
      .update({ is_available: !item.is_available, is_snoozed: false })
      .eq('id', id);
    if (error) {
      toast.error('Failed to update item');
    } else {
      setItems(prev => prev.map(i => i.id === id ? { ...i, is_available: !i.is_available, is_snoozed: false } : i));
    }
  };

  const toggleSnooze = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const { error } = await supabase
      .from('menu_items')
      .update({ is_snoozed: !item.is_snoozed })
      .eq('id', id);
    if (error) {
      toast.error('Failed to update item');
    } else {
      setItems(prev => prev.map(i => i.id === id ? { ...i, is_snoozed: !i.is_snoozed } : i));
    }
  };

  const addItem = async (item: { name: string; price: number; category: string; description?: string }) => {
    if (!storeId) return;
    const { error } = await supabase
      .from('menu_items')
      .insert({ ...item, store_id: storeId });
    if (error) {
      toast.error('Failed to add item');
    } else {
      toast.success('Item added!');
      fetchItems();
    }
  };

  return { items, loading, toggleAvailable, toggleSnooze, addItem, refetch: fetchItems };
}
