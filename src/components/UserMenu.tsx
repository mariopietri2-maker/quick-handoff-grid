import { useState } from 'react';
import {
  LogOut, User, Home, UserCircle, Bell, Settings, TrendingUp, Wallet,
  LifeBuoy, Users, Share2, FileText, HelpCircle, Star,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { DriverSoundSettings } from '@/components/driver/DriverSoundSettings';
import { DriverAppSettings } from '@/components/driver/DriverAppSettings';
import { toast } from 'sonner';

export function UserMenu() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const isDriver = profile?.role === 'driver';
  const [soundOpen, setSoundOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleShare = async () => {
    const text = 'Γίνε QuickGrid driver και κέρδισε bonus καλωσορίσματος!';
    const url = window.location.origin + '/auth';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'QuickGrid Drivers', text, url });
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast.success('Αντιγράφηκε ο σύνδεσμος');
      }
    } catch {}
  };

  if (!user) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <User className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <div className="px-3 py-2.5 bg-gradient-to-br from-primary/10 to-transparent rounded-t-md">
            <p className="text-sm font-heading font-bold text-foreground truncate">
              {profile?.full_name || 'Χρήστης'}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            {isDriver && (
              <span className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-[10px] font-heading font-semibold text-primary">
                <Star className="h-2.5 w-2.5" /> DRIVER
              </span>
            )}
          </div>

          {isDriver ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Λογαριασμός
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => navigate('/driver/profile')}>
                <UserCircle className="mr-2 h-4 w-4" />
                Προφίλ Οδηγού
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/driver?tab=earnings')}>
                <TrendingUp className="mr-2 h-4 w-4" />
                Κέρδη & Στατιστικά
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/driver?tab=wallet')}>
                <Wallet className="mr-2 h-4 w-4" />
                Πορτοφόλι
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/driver?tab=referral')}>
                <Users className="mr-2 h-4 w-4" />
                Πρόσκληση Οδηγών
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Ρυθμίσεις
              </DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={(e) => { e.preventDefault(); setSettingsOpen(true); }}
              >
                <Settings className="mr-2 h-4 w-4" />
                Ρυθμίσεις Εφαρμογής
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => { e.preventDefault(); setSoundOpen(true); }}
              >
                <Bell className="mr-2 h-4 w-4" />
                Ήχος Ειδοποιήσεων
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Βοήθεια
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => navigate('/driver/profile?tab=support')}>
                <LifeBuoy className="mr-2 h-4 w-4" />
                Υποστήριξη
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleShare}>
                <Share2 className="mr-2 h-4 w-4" />
                Μοιραστείτε την εφαρμογή
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open('https://quick-handoff-grid.lovable.app', '_blank')}>
                <HelpCircle className="mr-2 h-4 w-4" />
                Συχνές Ερωτήσεις
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open('https://quick-handoff-grid.lovable.app', '_blank')}>
                <FileText className="mr-2 h-4 w-4" />
                Όροι & Πολιτική
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/')}>
                <Home className="mr-2 h-4 w-4" />
                Αρχική
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Αποσύνδεση
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isDriver && (
        <>
          <DriverSoundSettings open={soundOpen} onOpenChange={setSoundOpen} />
          <DriverAppSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
        </>
      )}
    </>
  );
}
