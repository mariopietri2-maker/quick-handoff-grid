import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { StoreOwnerProfilePanel } from '@/components/store/StoreOwnerProfilePanel';

/**
 * Full-page store owner profile — same pattern as DriverProfilePage.
 */
export default function StoreProfilePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-dark text-primary-foreground px-4 py-3 flex items-center gap-3">
        <button type="button" onClick={() => navigate('/store')} aria-label="Πίσω">
          <ArrowLeft className="h-5 w-5 text-primary-foreground/70 hover:text-primary-foreground" />
        </button>
        <h1 className="font-heading font-bold text-lg">Προφίλ Καταστήματος</h1>
      </header>

      <div className="max-w-lg mx-auto p-4">
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
