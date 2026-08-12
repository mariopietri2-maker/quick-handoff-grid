import { AlertTriangle } from 'lucide-react';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';

export default function MaintenanceBanner() {
  const { settings } = usePlatformSettings();

  if (!settings.maintenance_mode) return null;

  return (
    <div className="bg-destructive text-destructive-foreground px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>{settings.maintenance_message || 'Η πλατφόρμα βρίσκεται σε συντήρηση. Επιστρέφουμε σύντομα.'}</span>
    </div>
  );
}
