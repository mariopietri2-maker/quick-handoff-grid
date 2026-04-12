import { Navigation, Clock, MapPin, ChevronUp, ChevronDown, CornerDownRight } from 'lucide-react';
import { useState } from 'react';
import type { RouteInfo } from './DriverMapbox';

interface NavigationPanelProps {
  route: RouteInfo;
  destination: string;
  destinationType: 'store' | 'customer';
}

function formatDuration(seconds: number) {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} λεπτά`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}ω ${m}λ`;
}

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)}μ`;
  return `${(meters / 1000).toFixed(1)}χλμ`;
}

export function NavigationPanel({ route, destination, destinationType }: NavigationPanelProps) {
  const [showSteps, setShowSteps] = useState(false);

  const nextStep = route.steps[0];

  return (
    <div className="space-y-2">
      {/* Main nav bar */}
      <div className="rounded-2xl bg-white/[0.08] backdrop-blur-xl border border-white/10 overflow-hidden">
        {/* Next turn instruction */}
        {nextStep && (
          <div className="px-4 py-3 bg-primary/20 border-b border-white/5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
              <CornerDownRight className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-heading font-bold text-white truncate">{nextStep.instruction}</p>
              <p className="text-[11px] text-white/50">{formatDistance(nextStep.distance)}</p>
            </div>
          </div>
        )}

        {/* ETA & Distance */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-emerald-400" />
              <span className="font-heading font-bold text-lg text-white">{formatDuration(route.duration)}</span>
            </div>
            <div className="w-px h-5 bg-white/10" />
            <div className="flex items-center gap-1.5">
              <Navigation className="h-4 w-4 text-blue-400" />
              <span className="font-heading font-semibold text-sm text-white/70">{formatDistance(route.distance)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${destinationType === 'store' ? 'bg-orange-400' : 'bg-emerald-400'}`} />
            <span className="text-xs text-white/50 font-heading truncate max-w-[100px]">
              {destinationType === 'store' ? 'Κατάστημα' : 'Πελάτης'}
            </span>
          </div>
        </div>
      </div>

      {/* Expand steps */}
      {route.steps.length > 1 && (
        <button
          onClick={() => setShowSteps(!showSteps)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/[0.05] border border-white/5 text-white/40 text-xs font-heading hover:bg-white/[0.08] transition-colors"
        >
          {showSteps ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          {showSteps ? 'Απόκρυψη οδηγιών' : `Εμφάνιση ${route.steps.length} βημάτων`}
        </button>
      )}

      {/* Steps list */}
      {showSteps && (
        <div className="rounded-2xl bg-white/[0.05] border border-white/5 overflow-hidden max-h-48 overflow-y-auto">
          {route.steps.map((step, i) => (
            <div key={i} className={`px-4 py-2.5 flex items-start gap-3 border-b border-white/5 last:border-0 ${i === 0 ? 'bg-primary/10' : ''}`}>
              <div className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-white/60">{i + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/80 leading-relaxed">{step.instruction}</p>
                <p className="text-[10px] text-white/30 mt-0.5">
                  {formatDistance(step.distance)} · {formatDuration(step.duration)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
