import { Car, Coins } from 'lucide-react';

interface DriverHomeHeaderProps {
  today: {
    total: number;
    trips: number;
    tips: number;
  };
}

export function DriverHomeHeader({ today }: DriverHomeHeaderProps) {
  return (
    <div className="absolute bottom-4 left-3 right-3 z-10">
      <div className="driver-glass rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-[hsl(var(--driver-text-muted))] font-heading uppercase tracking-[0.15em]">Σημερινά Κέρδη</p>
            <p className="font-heading font-extrabold text-3xl text-[hsl(var(--driver-text))] tabular-nums">{today.total.toFixed(2)}€</p>
          </div>
          <div className="flex gap-5">
            <div className="text-center">
              <div className="flex items-center gap-1 justify-center mb-0.5">
                <Car className="h-3 w-3 text-[hsl(var(--driver-text-muted))]" />
              </div>
              <p className="font-heading font-bold text-lg text-[hsl(var(--driver-text))] tabular-nums">{today.trips}</p>
              <p className="text-[9px] text-[hsl(var(--driver-text-muted))] uppercase tracking-wider">Διαδρομές</p>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-1 justify-center mb-0.5">
                <Coins className="h-3 w-3 text-[hsl(var(--driver-accent))]" />
              </div>
              <p className="font-heading font-bold text-lg text-[hsl(var(--driver-accent))] tabular-nums">{today.tips.toFixed(2)}€</p>
              <p className="text-[9px] text-[hsl(var(--driver-text-muted))] uppercase tracking-wider">Tips</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
