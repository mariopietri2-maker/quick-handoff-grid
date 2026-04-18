import { useRef, useState, useCallback } from 'react';
import { Zap, AlertTriangle } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface SlideToggleProps {
  isOn: boolean;
  onToggle: (value: boolean) => void;
  onLabel?: string;
  offLabel?: string;
}

const THUMB_SIZE = 44;
const TRACK_PADDING = 4;
// Easy ON: 50% of track. Hard OFF: must drag 95% AND confirm.
const ON_THRESHOLD = 0.5;
const OFF_THRESHOLD = 0.95;

export function SlideToggle({
  isOn,
  onToggle,
  onLabel = 'Online',
  offLabel = 'Slide to Go Online',
}: SlideToggleProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState<number | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);
  const startX = useRef(0);
  const dragging = useRef(false);

  const getMaxX = useCallback(() => {
    if (!trackRef.current) return 200;
    return trackRef.current.offsetWidth - THUMB_SIZE - TRACK_PADDING * 2;
  }, []);

  const getRestX = useCallback(() => (isOn ? getMaxX() : 0), [isOn, getMaxX]);

  const handleStart = (clientX: number) => {
    dragging.current = true;
    startX.current = clientX - getRestX();
    setDragX(getRestX());
  };

  const handleMove = (clientX: number) => {
    if (!dragging.current) return;
    const maxX = getMaxX();
    const x = Math.max(0, Math.min(maxX, clientX - startX.current));
    setDragX(x);
  };

  const handleEnd = () => {
    if (!dragging.current) return;
    dragging.current = false;
    const maxX = getMaxX();
    const finalX = dragX ?? 0;

    if (!isOn) {
      // Easy go online
      if (finalX > maxX * ON_THRESHOLD) {
        setDragX(null);
        onToggle(true);
        return;
      }
    } else {
      // Hard go offline: must reach 95% then confirm
      const offProgress = 1 - finalX / maxX;
      if (offProgress > OFF_THRESHOLD) {
        setDragX(null);
        setConfirmOff(true);
        return;
      }
    }
    setDragX(null);
  };

  const onTouchStart = (e: React.TouchEvent) => handleStart(e.touches[0].clientX);
  const onTouchMove = (e: React.TouchEvent) => { e.preventDefault(); handleMove(e.touches[0].clientX); };
  const onTouchEnd = () => handleEnd();
  const onMouseDown = (e: React.MouseEvent) => { e.preventDefault(); handleStart(e.clientX); };
  const onMouseMove = (e: React.MouseEvent) => handleMove(e.clientX);
  const onMouseUp = () => handleEnd();
  const onMouseLeave = () => { if (dragging.current) handleEnd(); };

  const currentX = dragX !== null ? dragX : getRestX();
  const maxX = getMaxX();
  const progress = maxX > 0 ? currentX / maxX : (isOn ? 1 : 0);

  // Spring-like easing when dragging on
  const fillTransition = dragX === null
    ? 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)'
    : 'none';
  const thumbTransition = dragX === null
    ? 'left 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.3s, transform 0.2s'
    : 'background-color 0.3s, transform 0.2s';

  return (
    <>
      <div
        ref={trackRef}
        className="relative h-14 rounded-full bg-[hsl(var(--driver-surface))] border border-[hsl(var(--driver-border))] overflow-hidden select-none touch-none"
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      >
        <div
          className="absolute inset-0 rounded-full bg-[hsl(var(--driver-accent))]/20 origin-left"
          style={{ transform: `scaleX(${progress})`, transition: fillTransition }}
        />

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className={`font-heading font-bold text-xs transition-colors duration-300 ${
            progress > 0.5 ? 'text-[hsl(var(--driver-accent))]' : 'text-[hsl(var(--driver-text-muted))]'
          }`}>
            {isOn
              ? (dragging.current && progress < 0.5 ? `Σύρε δεξιά για να μείνεις ON` : onLabel)
              : (progress > 0.5 ? onLabel : offLabel)}
          </span>
        </div>

        <div
          className={`absolute top-1 h-[44px] w-[44px] rounded-full flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing active:scale-110 ${
            progress > 0.5 ? 'bg-[hsl(var(--driver-accent))]' : 'bg-[hsl(var(--driver-text-muted))]'
          }`}
          style={{
            left: `${TRACK_PADDING + currentX}px`,
            transition: thumbTransition,
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}
        >
          <Zap className="h-5 w-5 text-white" />
        </div>
      </div>

      <AlertDialog open={confirmOff} onOpenChange={setConfirmOff}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Να μπεις offline;
            </AlertDialogTitle>
            <AlertDialogDescription>
              Δεν θα λαμβάνεις άλλες παραγγελίες μέχρι να επιστρέψεις online.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Άκυρο, μένω online</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onToggle(false)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Ναι, βγες offline
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
