import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAppUpdate } from '@/hooks/useAppUpdate';

const TOAST_ID = 'app-update-available';

/**
 * Global auto-update prompt. Mounted once in App — shows a sticky toast when
 * useAppUpdate detects a newer deploy (version.json changed or SW updated).
 */
export function AppUpdatePrompt() {
  const { updateAvailable, bundled, dismissed, applyUpdate, dismiss } = useAppUpdate();
  const shownRef = useRef(false);

  useEffect(() => {
    if (!updateAvailable || dismissed || shownRef.current) return;
    shownRef.current = true;
    toast(bundled ? 'Διαθέσιμη νέα έκδοση' : 'Η εφαρμογή ενημερώθηκε', {
      id: TOAST_ID,
      description: bundled
        ? 'Κατέβασε τη νέα έκδοση της εφαρμογής.'
        : 'Κάνε ανανέωση για να φορτώσεις τη νέα έκδοση.',
      duration: Infinity,
      action: {
        label: bundled ? 'Λήψη' : 'Ανανέωση',
        onClick: () => void applyUpdate(),
      },
      cancel: {
        label: 'Αργότερα',
        onClick: () => dismiss(),
      },
      onDismiss: () => dismiss(),
    });
    return () => {
      toast.dismiss(TOAST_ID);
    };
  }, [updateAvailable, bundled, dismissed, applyUpdate, dismiss]);

  return null;
}
