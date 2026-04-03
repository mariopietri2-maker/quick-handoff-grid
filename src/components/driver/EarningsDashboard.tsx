import { Clock, Car } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useEarnings } from '@/hooks/useEarnings';

export function EarningsDashboard() {
  const { today, week, weekBreakdown, loading } = useEarnings();

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-muted-foreground font-heading">Loading earnings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="today">
        <TabsList className="w-full">
          <TabsTrigger value="today" className="flex-1 font-heading">Today</TabsTrigger>
          <TabsTrigger value="week" className="flex-1 font-heading">This Week</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-4 mt-4">
          <Card className="gradient-primary text-primary-foreground shadow-primary">
            <CardContent className="p-6 text-center">
              <p className="text-primary-foreground/80 text-sm">Today's Earnings</p>
              <p className="font-heading font-bold text-4xl mt-1">${today.total.toFixed(2)}</p>
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Car} label="Trips" value={today.trips.toString()} />
            <StatCard icon={Clock} label="Base Pay" value={`$${today.basePay.toFixed(2)}`} />
          </div>
          {today.trips === 0 && (
            <p className="text-center text-sm text-muted-foreground">No deliveries completed today yet</p>
          )}
        </TabsContent>

        <TabsContent value="week" className="space-y-4 mt-4">
          <Card className="gradient-primary text-primary-foreground shadow-primary">
            <CardContent className="p-6 text-center">
              <p className="text-primary-foreground/80 text-sm">This Week</p>
              <p className="font-heading font-bold text-4xl mt-1">${week.total.toFixed(2)}</p>
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Car} label="Trips" value={week.trips.toString()} />
            <StatCard icon={Clock} label="Base Pay" value={`$${week.basePay.toFixed(2)}`} />
          </div>

          <Card className="shadow-[var(--shadow-md)]">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-lg">Weekly Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekBreakdown}>
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="base" name="Base" stackId="a" fill="hsl(0 85% 50%)" radius={[0,0,0,0]} />
                    <Bar dataKey="tips" name="Tips" stackId="a" fill="hsl(142 71% 45%)" radius={[0,0,0,0]} />
                    <Bar dataKey="bonus" name="Bonus" stackId="a" fill="hsl(38 92% 50%)" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <Card className="shadow-[var(--shadow-sm)]">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="font-heading font-bold text-lg text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
