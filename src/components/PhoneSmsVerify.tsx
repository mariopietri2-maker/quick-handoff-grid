import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

function normalizeGrPhone(raw: string): string {
  const d = raw.replace(/[^\d+]/g, '');
  if (d.startsWith('+')) return d;
  if (d.startsWith('30')) return `+${d}`;
  if (d.startsWith('0')) return `+30${d.slice(1)}`;
  return `+30${d}`;
}

type Props = {
  initialPhone?: string;
  onVerified?: (phone: string) => void;
  className?: string;
};

/** Twilio-backed SMS OTP (edge: send-phone-otp / verify-phone-otp). */
export function PhoneSmsVerify({ initialPhone = '', onVerified, className }: Props) {
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    const tel = normalizeGrPhone(phone);
    if (tel.replace(/\D/g, '').length < 10) {
      toast.error('Βάλε έγκυρο κινητό (π.χ. 69xxxxxxxx)');
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-phone-otp', {
        body: { phone: tel },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error === 'sms_not_configured') {
        throw new Error('Το SMS δεν είναι ρυθμισμένο (Twilio). Επικοινώνησε με υποστήριξη.');
      }
      if ((data as { error?: string })?.error) {
        throw new Error((data as { error: string }).error);
      }
      setSent(true);
      setPhone(tel);
      toast.success('Στείλαμε κωδικό με SMS');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Αποτυχία αποστολής SMS');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    const tel = normalizeGrPhone(phone);
    const c = code.replace(/\s/g, '');
    if (c.length < 4) {
      toast.error('Βάλε τον κωδικό από το SMS');
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-phone-otp', {
        body: { phone: tel, code: c },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error === 'bad_code') {
        throw new Error('Λάθος ή ληγμένος κωδικός');
      }
      if ((data as { error?: string })?.error) {
        throw new Error((data as { error: string }).error);
      }
      toast.success('Το κινητό επιβεβαιώθηκε');
      onVerified?.(tel);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Αποτυχία επιβεβαίωσης');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className ?? 'space-y-3'}>
      <div className="space-y-1.5">
        <Label>Κινητό τηλέφωνο</Label>
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          placeholder="69xxxxxxxx"
          disabled={busy || sent}
        />
      </div>
      {sent && (
        <div className="space-y-1.5">
          <Label>Κωδικός SMS</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            placeholder="6ψήφιος κωδικός"
            disabled={busy}
          />
        </div>
      )}
      <div className="flex flex-col gap-2">
        {!sent ? (
          <Button type="button" onClick={sendCode} disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Στείλε κωδικό SMS'}
          </Button>
        ) : (
          <>
            <Button type="button" onClick={verify} disabled={busy} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Επιβεβαίωση'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                setSent(false);
                setCode('');
              }}
            >
              Αλλαγή αριθμού / νέος κωδικός
            </Button>
          </>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Θα λάβεις SMS με κωδικό (ισχύει 10 λεπτά). Χρειάζεται ρυθμισμένο Twilio στο Supabase.
      </p>
    </div>
  );
}
