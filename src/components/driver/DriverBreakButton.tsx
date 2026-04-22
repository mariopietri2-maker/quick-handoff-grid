import { useEffect, useState } from 'react';
import { Coffee, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDriverState } from '@/hooks/useDriverState';

export default function DriverBreakButton() {
  const { state, startBreak, endBreak } = useDriverState();
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!state?.on_break) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [state?.on_break]);

  // Auto-end break when timer expires
  useEffect(() => {
    if (state?.on_break && state.break_until && new Date(state.break_until) <= new Date()) {
      endBreak();
    }
  }, [tick, state, endBreak]);

  if (!state) return null;

  const remaining = state.break_until
    ? Math.max(0, Math.floor((new Date(state.break_until).getTime() - Date.now()) / 1000))
    : 0;
  const mm = Math.floor(remaining / 60).toString().padStart(2, '0');
  const ss = (remaining % 60).toString().padStart(2, '0');

  if (state.on_break) {
    return (
      <Button
        onClick={endBreak}
        variant="outline"
        className="h-10 px-3 rounded-full border-warning/40 bg-warning/10 text-warning"
      >
        <Pause className="h-4 w-4 mr-1.5" />
        <span className="font-heading text-xs font-bold tabular-nums">Διάλειμμα {mm}:{ss}</span>
      </Button>
    );
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline" className="h-10 px-3 rounded-full">
        <Coffee className="h-4 w-4 mr-1.5" />
        <span className="font-heading text-xs">Διάλειμμα</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Επιλέξτε διάρκεια</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {[15, 30, 45, 60].map(m => (
              <Button key={m} onClick={() => { startBreak(m); setOpen(false); }} variant="outline" className="h-12">
                {m} λεπτά
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Δεν θα λαμβάνετε νέες παραγγελίες κατά τη διάρκεια του διαλείμματος.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
