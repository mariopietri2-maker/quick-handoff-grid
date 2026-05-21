import { useMemo } from 'react';
import { Clock, Car, TrendingUp, Coins, Award } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useEarnings } from '@/hooks/useEarnings';
import { useDriverState } from '@/hooks/useDriverState';
import { useDriverAppPrefs } from '@/hooks/useDriverAppPrefs';

export function EarningsDashboard() {
  const { today, week, weekBreakdown, loading } = useEarnings();
  const { state: driverState } = useDriverState();
  const { hideEarningsOnHome } = useDriverAppPrefs();
  const mask = (v: string) => hideEarningsOnHome ? '••••' : v;

  // Projection: extrapolate today's earnings to a 10h shift based on hourly pace since shift start (or midnight)
  const projection = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const shiftStart = driverState?.shift_started_at
      ? new Date(driverState.shift_started_at)
      : startOfDay;
    const elapsedHours = Math.max(0.25, (now.getTime() - shiftStart.getTime()) / 3_600_000);
    const hourlyRate = today.total / elapsedHours;
    // Assume a typical 10-hour shift; cap projection at 24h of pace
    const projectedDay = hourlyRate * 10;
    const goal = driverState?.daily_goal ? Number(driverState.daily_goal) : 0;
    const onTrackForGoal = goal > 0 && projectedDay >= goal;
    return {
      hourlyRate,
      projectedDay,
      goal,
      onTrackForGoal,
      elapsedHours,
    };
  }, [today.total, driverState?.shift_started_at, driverState?.daily_goal]);

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="h-8 w-8 border-4 border-[hsl(var(--driver-accent))] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-[hsl(var(--driver-text-muted))] font-heading text-sm">Φόρτωση κερδών...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="today">
        <TabsList className="w-full bg-[hsl(var(--driver-surface))] border border-[hsl(var(--driver-border))]">
          <TabsTrigger value="today" className="flex-1 font-heading text-[hsl(var(--driver-text))] data-[state=active]:bg-[hsl(var(--driver-accent))] data-[state=active]:text-white">Σήμερα</TabsTrigger>
          <TabsTrigger value="week" className="flex-1 font-heading text-[hsl(var(--driver-text))] data-[state=active]:bg-[hsl(var(--driver-accent))] data-[state=active]:text-white">Εβδομάδα</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-3 mt-4">
          <div className="rounded-2xl driver-gradient-earn p-6 text-center">
            <p className="text-white/70 text-xs font-heading uppercase tracking-widest">Σημερινά Κέρδη</p>
            <p className="font-heading font-extrabold text-4xl text-white mt-1 tabular-nums">{mask(`${today.total.toFixed(2)}€`)}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <StatCard icon={Car} label="Διαδρομές" value={today.trips.toString()} />
            <StatCard icon={Coins} label="Βασικά" value={mask(`${today.basePay.toFixed(2)}€`)} />
            <StatCard icon={Award} label="Tips" value={mask(`${today.tips.toFixed(2)}€`)} accent />
          </div>

          {today.trips > 0 && projection.hourlyRate > 0 && (
            <div className="rounded-2xl driver-glass p-4 space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className={`h-4 w-4 ${projection.onTrackForGoal ? 'text-[hsl(var(--driver-accent))]' : 'text-primary'}`} />
                <h3 className="font-heading font-bold text-sm text-[hsl(var(--driver-text))]">Πρόβλεψη Ημέρας</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-[hsl(var(--driver-text-muted))] uppercase tracking-wider">Ρυθμός / ώρα</p>
                  <p className="font-heading font-bold text-lg text-[hsl(var(--driver-text))] tabular-nums">{projection.hourlyRate.toFixed(2)}€</p>
                </div>
                <div>
                  <p className="text-[10px] text-[hsl(var(--driver-text-muted))] uppercase tracking-wider">Πρόβλεψη 10ω</p>
                  <p className={`font-heading font-bold text-lg tabular-nums ${projection.onTrackForGoal ? 'text-[hsl(var(--driver-accent))]' : 'text-[hsl(var(--driver-text))]'}`}>{projection.projectedDay.toFixed(2)}€</p>
                </div>
              </div>
              {projection.goal > 0 && (
                <p className={`text-xs font-heading ${projection.onTrackForGoal ? 'text-[hsl(var(--driver-accent))]' : 'text-[hsl(var(--driver-text-muted))]'}`}>
                  {projection.onTrackForGoal
                    ? `🎯 Με αυτόν τον ρυθμό θα πιάσετε τον στόχο των ${projection.goal}€!`
                    : `Στόχος ${projection.goal}€ — χρειάζεστε ${(projection.goal / 10).toFixed(2)}€/ώρα`}
                </p>
              )}
            </div>
          )}

          {today.trips === 0 && (
            <p className="text-center text-sm text-[hsl(var(--driver-text-muted))] py-4">Δεν ολοκληρώθηκαν παραδόσεις σήμερα</p>
          )}
        </TabsContent>

        <TabsContent value="week" className="space-y-3 mt-4">
          <div className="rounded-2xl driver-gradient-earn p-6 text-center">
            <p className="text-white/70 text-xs font-heading uppercase tracking-widest">Εβδομαδιαία Κέρδη</p>
            <p className="font-heading font-extrabold text-4xl text-white mt-1 tabular-nums">{week.total.toFixed(2)}€</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <StatCard icon={Car} label="Διαδρομές" value={week.trips.toString()} />
            <StatCard icon={Coins} label="Βασικά" value={`${week.basePay.toFixed(2)}€`} />
            <StatCard icon={Award} label="Tips" value={`${week.tips.toFixed(2)}€`} accent />
          </div>

          <div className="rounded-2xl driver-glass p-4">
            <h3 className="font-heading font-bold text-sm text-[hsl(var(--driver-text))] mb-3">Εβδομαδιαία Ανάλυση</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekBreakdown}>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(220 10% 55%)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(220 10% 55%)' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(225 20% 14%)',
                      border: '1px solid hsl(225 15% 25%)',
                      borderRadius: '12px',
                      color: 'hsl(220 14% 96%)',
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="base" name="Βασικά" stackId="a" fill="hsl(145 65% 42%)" radius={[0,0,0,0]} />
                  <Bar dataKey="tips" name="Tips" stackId="a" fill="hsl(38 92% 50%)" radius={[0,0,0,0]} />
                  <Bar dataKey="bonus" name="Μπόνους" stackId="a" fill="hsl(217 91% 60%)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl driver-glass p-3 text-center">
      <Icon className={`h-4 w-4 mx-auto mb-1 ${accent ? 'text-[hsl(var(--driver-accent))]' : 'text-[hsl(var(--driver-text-muted))]'}`} />
      <p className={`font-heading font-bold text-base tabular-nums ${accent ? 'text-[hsl(var(--driver-accent))]' : 'text-[hsl(var(--driver-text))]'}`}>{value}</p>
      <p className="text-[9px] text-[hsl(var(--driver-text-muted))] uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}
