import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { StoreOwnerProfilePanel } from '@/components/store/StoreOwnerProfilePanel';

/**
 * Full-page store owner profile (same content as StoreApp Προφίλ tab).
 */
export default function StoreProfilePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-40 shadow-[var(--shadow-sm)]">
        <button
          type="button"
          onClick={() => navigate('/store')}
          className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
          aria-label="Πίσω"
        >
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="min-w-0">
          <h1 className="font-heading font-bold text-lg text-foreground leading-tight">Προφίλ καταστήματος</h1>
          <p className="text-[11px] text-muted-foreground">Λογαριασμός ιδιοκτήτη</p>
        </div>
      </header>

      <div className="p-4">
        <StoreOwnerProfilePanel
          onOpenSettings={(storeId) => {
            const q = storeId ? `?tab=settings&store=${storeId}` : '?tab=settings';
            navigate(`/store${q}`);
          }}
        />
      </div>
    </div>
  );
}
