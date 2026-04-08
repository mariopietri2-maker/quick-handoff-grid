import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface WalletData {
  available_balance: number;
  pending_balance: number;
  total_withdrawn: number;
}

interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string | null;
  created_at: string;
}

export function useDriverWallet() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [cashingOut, setCashingOut] = useState(false);

  const fetchWallet = useCallback(async () => {
    if (!user) return;
    const [walletRes, txRes] = await Promise.all([
      supabase.from('driver_wallets').select('available_balance, pending_balance, total_withdrawn').eq('driver_id', user.id).maybeSingle(),
      supabase.from('wallet_transactions').select('*').eq('driver_id', user.id).order('created_at', { ascending: false }).limit(20),
    ]);
    if (walletRes.data) setWallet(walletRes.data);
    if (txRes.data) setTransactions(txRes.data as WalletTransaction[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  // Realtime subscription for wallet updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('driver-wallet')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_wallets', filter: `driver_id=eq.${user.id}` }, () => fetchWallet())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wallet_transactions', filter: `driver_id=eq.${user.id}` }, () => fetchWallet())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchWallet]);

  const cashOut = useCallback(async (amount: number) => {
    if (!user) return { error: 'Not authenticated' };
    setCashingOut(true);
    try {
      const { error } = await supabase.rpc('request_wallet_withdrawal', {
        p_driver_id: user.id,
        p_amount: amount,
      });
      if (error) throw error;
      await fetchWallet();
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Cash out failed' };
    } finally {
      setCashingOut(false);
    }
  }, [user, fetchWallet]);

  return { wallet, transactions, loading, cashOut, cashingOut, refetch: fetchWallet };
}
