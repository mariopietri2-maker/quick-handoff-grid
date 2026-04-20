import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SlaSettings {
  warn: number;
  urgent: number;
  breach: number;
}

const DEFAULTS: SlaSettings = { warn: 60, urgent: 180, breach: 600 };

export function useSlaSettings() {
  return useQuery({
    queryKey: ['sla-settings'],
    queryFn: async (): Promise<SlaSettings> => {
      const { data } = await supabase
        .from('platform_settings')
        .select('sla_warn_seconds, sla_urgent_seconds, sla_breach_seconds')
        .eq('id', 1)
        .maybeSingle();
      if (!data) return DEFAULTS;
      return {
        warn: (data as any).sla_warn_seconds ?? DEFAULTS.warn,
        urgent: (data as any).sla_urgent_seconds ?? DEFAULTS.urgent,
        breach: (data as any).sla_breach_seconds ?? DEFAULTS.breach,
      };
    },
    staleTime: 60_000,
  });
}
