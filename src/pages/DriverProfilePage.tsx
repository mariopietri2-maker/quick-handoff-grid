import { useState, useEffect } from 'react';
import { ArrowLeft, User, Car, FileText, Landmark, Save, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DriverProfile {
  driver_code: string | null;
  vehicle_type: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number | null;
  vehicle_color: string;
  license_plate: string;
  license_number: string;
  license_expiry: string;
  bank_name: string;
  account_holder: string;
  iban: string;
}

export default function DriverProfilePage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [driverProfile, setDriverProfile] = useState<DriverProfile>({
    driver_code: null,
    vehicle_type: 'motorcycle',
    vehicle_make: '',
    vehicle_model: '',
    vehicle_year: null,
    vehicle_color: '',
    license_plate: '',
    license_number: '',
    license_expiry: '',
    bank_name: '',
    account_holder: '',
    iban: '',
  });

  useEffect(() => {
    if (!user) return;
    setFullName(profile?.full_name || '');

    supabase.from('profiles').select('phone').eq('user_id', user.id).single()
      .then(({ data }) => { if (data) setPhone(data.phone || ''); });

    supabase.from('driver_profiles').select('*').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setDriverProfile({
            driver_code: (data as any).driver_code || null,
            vehicle_type: data.vehicle_type || 'motorcycle',
            vehicle_make: data.vehicle_make || '',
            vehicle_model: data.vehicle_model || '',
            vehicle_year: data.vehicle_year,
            vehicle_color: data.vehicle_color || '',
            license_plate: data.license_plate || '',
            license_number: data.license_number || '',
            license_expiry: data.license_expiry || '',
            bank_name: data.bank_name || '',
            account_holder: data.account_holder || '',
            iban: data.iban || '',
          });
        }
        setLoading(false);
      });
  }, [user, profile]);

  const handleSave = async (section: string) => {
    if (!user) return;
    setSaving(true);
    try {
      if (section === 'personal') {
        await supabase.from('profiles').update({ full_name: fullName, phone }).eq('user_id', user.id);
      }

      const { error } = await supabase.from('driver_profiles').upsert({
        user_id: user.id,
        ...driverProfile,
        vehicle_year: driverProfile.vehicle_year || null,
      }, { onConflict: 'user_id' });

      if (error) throw error;
      toast.success('Αποθηκεύτηκε επιτυχώς');
    } catch (e: any) {
      toast.error(e.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-dark text-primary-foreground px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/driver')}>
          <ArrowLeft className="h-5 w-5 text-primary-foreground/70 hover:text-primary-foreground" />
        </button>
        <h1 className="font-heading font-bold text-lg">Προφίλ Οδηγού</h1>
      </header>

      <div className="max-w-lg mx-auto p-4">
        <Tabs defaultValue="personal">
          <TabsList className="w-full mb-4 grid grid-cols-4">
            <TabsTrigger value="personal" className="text-xs font-heading">
              <User className="h-3.5 w-3.5 mr-1" />
              Προσωπικά
            </TabsTrigger>
            <TabsTrigger value="vehicle" className="text-xs font-heading">
              <Car className="h-3.5 w-3.5 mr-1" />
              Όχημα
            </TabsTrigger>
            <TabsTrigger value="documents" className="text-xs font-heading">
              <FileText className="h-3.5 w-3.5 mr-1" />
              Έγγραφα
            </TabsTrigger>
            <TabsTrigger value="bank" className="text-xs font-heading">
              <Landmark className="h-3.5 w-3.5 mr-1" />
              Τράπεζα
            </TabsTrigger>
          </TabsList>

          <TabsContent value="personal">
            <Card>
              <CardHeader><CardTitle className="font-heading text-lg">Προσωπικά Στοιχεία</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {driverProfile.driver_code && (
                  <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Κωδικός Οδηγού</p>
                      <p className="font-heading font-bold text-lg text-primary">{driverProfile.driver_code}</p>
                    </div>
                    <Badge variant="outline" className="border-primary/30 text-primary font-heading">ID</Badge>
                  </div>
                )}
                <div>
                  <Label htmlFor="fullName">Ονοματεπώνυμο</Label>
                  <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="phone">Τηλέφωνο</Label>
                  <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+30 210 1234567" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={user?.email || ''} disabled className="bg-muted" />
                </div>
                <Button onClick={() => handleSave('personal')} disabled={saving} className="w-full gradient-primary text-primary-foreground font-heading">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Αποθήκευση Προσωπικών
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vehicle">
            <Card>
              <CardHeader><CardTitle className="font-heading text-lg">Στοιχεία Οχήματος</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Τύπος Οχήματος</Label>
                  <Select value={driverProfile.vehicle_type} onValueChange={v => setDriverProfile(p => ({ ...p, vehicle_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="motorcycle">Μοτοσικλέτα</SelectItem>
                      <SelectItem value="bicycle">Ποδήλατο</SelectItem>
                      <SelectItem value="car">Αυτοκίνητο</SelectItem>
                      <SelectItem value="scooter">Σκούτερ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Μάρκα</Label>
                    <Input value={driverProfile.vehicle_make} onChange={e => setDriverProfile(p => ({ ...p, vehicle_make: e.target.value }))} placeholder="Honda" />
                  </div>
                  <div>
                    <Label>Μοντέλο</Label>
                    <Input value={driverProfile.vehicle_model} onChange={e => setDriverProfile(p => ({ ...p, vehicle_model: e.target.value }))} placeholder="CBR" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Έτος</Label>
                    <Input type="number" value={driverProfile.vehicle_year ?? ''} onChange={e => setDriverProfile(p => ({ ...p, vehicle_year: e.target.value ? Number(e.target.value) : null }))} placeholder="2023" />
                  </div>
                  <div>
                    <Label>Χρώμα</Label>
                    <Input value={driverProfile.vehicle_color} onChange={e => setDriverProfile(p => ({ ...p, vehicle_color: e.target.value }))} placeholder="Μαύρο" />
                  </div>
                </div>
                <div>
                  <Label>Πινακίδα</Label>
                  <Input value={driverProfile.license_plate} onChange={e => setDriverProfile(p => ({ ...p, license_plate: e.target.value }))} placeholder="ΑΒΓ-1234" />
                </div>
                <Button onClick={() => handleSave('vehicle')} disabled={saving} className="w-full gradient-primary text-primary-foreground font-heading">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Αποθήκευση Οχήματος
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardHeader><CardTitle className="font-heading text-lg">Έγγραφα</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Αριθμός Διπλώματος</Label>
                  <Input value={driverProfile.license_number} onChange={e => setDriverProfile(p => ({ ...p, license_number: e.target.value }))} placeholder="DL-123456789" />
                </div>
                <div>
                  <Label>Λήξη Διπλώματος</Label>
                  <Input type="date" value={driverProfile.license_expiry} onChange={e => setDriverProfile(p => ({ ...p, license_expiry: e.target.value }))} />
                </div>
                <p className="text-xs text-muted-foreground">Η μεταφόρτωση εγγράφων θα είναι σύντομα διαθέσιμη. Επικοινωνήστε με την υποστήριξη για υποβολή ταυτότητας και διπλώματος.</p>
                <Button onClick={() => handleSave('documents')} disabled={saving} className="w-full gradient-primary text-primary-foreground font-heading">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Αποθήκευση Εγγράφων
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bank">
            <Card>
              <CardHeader><CardTitle className="font-heading text-lg">Τραπεζικά Στοιχεία</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Τράπεζα</Label>
                  <Input value={driverProfile.bank_name} onChange={e => setDriverProfile(p => ({ ...p, bank_name: e.target.value }))} placeholder="Εθνική Τράπεζα" />
                </div>
                <div>
                  <Label>Δικαιούχος Λογαριασμού</Label>
                  <Input value={driverProfile.account_holder} onChange={e => setDriverProfile(p => ({ ...p, account_holder: e.target.value }))} placeholder="Γιάννης Παπαδόπουλος" />
                </div>
                <div>
                  <Label>IBAN</Label>
                  <Input value={driverProfile.iban} onChange={e => setDriverProfile(p => ({ ...p, iban: e.target.value }))} placeholder="GR1234567890123456" />
                </div>
                <Button onClick={() => handleSave('bank')} disabled={saving} className="w-full gradient-primary text-primary-foreground font-heading">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Αποθήκευση Τραπεζικών
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
