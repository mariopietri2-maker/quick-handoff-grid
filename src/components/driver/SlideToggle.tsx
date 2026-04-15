import { useRef, useState, useCallback } from 'react';
import { Zap } from 'lucide-react';

interface SlideToggleProps {
  isOn: boolean;
  onToggle: (value: boolean) => void;
  onLabel?: string;
  offLabel?: string;
}

const THUMB_SIZE = 44; // px
const TRACK_PADDING = 4; // px

export function SlideToggle({ isOn, onToggle, onLabel = 'Online', offLabel = 'Slide to Go Online' }: SlideToggleProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState<number | null>(null);
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
    const threshold = maxX * 0.5;
    const shouldBeOn = (dragX ?? 0) > threshold;
    setDragX(null);
    if (shouldBeOn !== isOn) onToggle(shouldBeOn);
  };

  // Touch handlers
  const onTouchStart = (e: React.TouchEvent) => handleStart(e.touches[0].clientX);
  const onTouchMove = (e: React.TouchEvent) => { e.preventDefault(); handleMove(e.touches[0].clientX); };
  const onTouchEnd = () => handleEnd();

  // Mouse handlers
  const onMouseDown = (e: React.MouseEvent) => { e.preventDefault(); handleStart(e.clientX); };
  const onMouseMove = (e: React.MouseEvent) => handleMove(e.clientX);
  const onMouseUp = () => handleEnd();
  const onMouseLeave = () => { if (dragging.current) handleEnd(); };

  const currentX = dragX !== null ? dragX : getRestX();
  const maxX = getMaxX();
  const progress = maxX > 0 ? currentX / maxX : (isOn ? 1 : 0);

  return (
    <div
      ref={trackRef}
      className="relative h-14 rounded-full bg-[hsl(var(--driver-surface))] border border-[hsl(var(--driver-border))] overflow-hidden select-none touch-none"
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      {/* Fill */}
      <div
        className="absolute inset-0 rounded-full bg-[hsl(var(--driver-accent))]/20 origin-left"
        style={{ transform: `scaleX(${progress})`, transition: dragX === null ? 'transform 0.4s ease-out' : 'none' }}
      />

      {/* Label */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className={`font-heading font-bold text-xs transition-colors duration-300 ${
          progress > 0.5 ? 'text-[hsl(var(--driver-accent))]' : 'text-[hsl(var(--driver-text-muted))]'
        }`}>
          {progress > 0.5 ? onLabel : offLabel}
        </span>
      </div>

      {/* Thumb */}
      <div
        className={`absolute top-1 h-[44px] w-[44px] rounded-full flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing ${
          progress > 0.5 ? 'bg-[hsl(var(--driver-accent))]' : 'bg-[hsl(var(--driver-text-muted))]'
        }`}
        style={{
          left: `${TRACK_PADDING + currentX}px`,
          transition: dragX === null ? 'left 0.4s ease-out, background-color 0.3s' : 'background-color 0.3s',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
      >
        <Zap className="h-5 w-5 text-white" />
      </div>
    </div>
  );
}
