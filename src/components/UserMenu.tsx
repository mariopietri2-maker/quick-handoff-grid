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
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const go = (path: string) => {
    setMenuOpen(false);
    setTimeout(() => navigate(path), 0);
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
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-white text-foreground border-2 border-border shadow-md hover:bg-accent"
          >
            <User className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={8}
          className="w-64 max-h-[80vh] overflow-y-auto bg-white text-foreground border border-border shadow-2xl z-[100]"
        >
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
              <DropdownMenuItem onSelect={() => go('/driver/profile')}>
                <UserCircle className="mr-2 h-4 w-4" />
                Προφίλ Οδηγού
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => go('/driver?tab=earnings')}>
                <TrendingUp className="mr-2 h-4 w-4" />
                Κέρδη & Στατιστικά
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => go('/driver?tab=wallet')}>
                <Wallet className="mr-2 h-4 w-4" />
                Πορτοφόλι
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => go('/driver?tab=referral')}>
                <Users className="mr-2 h-4 w-4" />
                Πρόσκληση Οδηγών
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Ρυθμίσεις
              </DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setMenuOpen(false);
                  setTimeout(() => setSettingsOpen(true), 50);
                }}
              >
                <Settings className="mr-2 h-4 w-4" />
                Ρυθμίσεις Εφαρμογής
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setMenuOpen(false);
                  setTimeout(() => setSoundOpen(true), 50);
                }}
              >
                <Bell className="mr-2 h-4 w-4" />
                Ήχος Ειδοποιήσεων
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Βοήθεια
              </DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => go('/driver/profile?tab=support')}>
                <LifeBuoy className="mr-2 h-4 w-4" />
                Υποστήριξη
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { setMenuOpen(false); handleShare(); }}>
                <Share2 className="mr-2 h-4 w-4" />
                Μοιραστείτε την εφαρμογή
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => window.open('https://quick-handoff-grid.lovable.app', '_blank')}>
                <HelpCircle className="mr-2 h-4 w-4" />
                Συχνές Ερωτήσεις
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => window.open('https://quick-handoff-grid.lovable.app', '_blank')}>
                <FileText className="mr-2 h-4 w-4" />
                Όροι & Πολιτική
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => go('/')}>
                <Home className="mr-2 h-4 w-4" />
                Αρχική
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => { setMenuOpen(false); handleSignOut(); }}
            className="text-destructive focus:text-destructive"
          >
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
