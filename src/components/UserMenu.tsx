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

  const itemClassName =
    'min-h-11 rounded-xl px-3 py-3 text-sm font-medium text-foreground cursor-pointer transition-colors focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground';
  const labelClassName =
    'px-3 pt-2 pb-1 text-[11px] font-heading font-bold uppercase tracking-wide text-muted-foreground';

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
            className="h-10 w-10 rounded-full bg-background text-foreground border-2 border-border shadow-md hover:bg-accent"
          >
            <User className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="z-[200] w-72 max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-2xl"
        >
          <div className="mb-1 rounded-xl border border-border bg-muted/60 px-3 py-3">
            <p className="text-sm font-heading font-bold text-foreground truncate">
              {profile?.full_name || 'Χρήστης'}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            {isDriver && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-1 text-[10px] font-heading font-semibold text-primary">
                <Star className="h-2.5 w-2.5" /> DRIVER
              </span>
            )}
          </div>

          {isDriver ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className={labelClassName}>Λογαριασμός</DropdownMenuLabel>
              <DropdownMenuItem className={itemClassName} onSelect={() => go('/driver/profile')}>
                <UserCircle className="mr-2 h-4 w-4 shrink-0" />
                Προφίλ Οδηγού
              </DropdownMenuItem>
              <DropdownMenuItem className={itemClassName} onSelect={() => go('/driver?tab=earnings')}>
                <TrendingUp className="mr-2 h-4 w-4 shrink-0" />
                Κέρδη & Στατιστικά
              </DropdownMenuItem>
              <DropdownMenuItem className={itemClassName} onSelect={() => go('/driver?tab=wallet')}>
                <Wallet className="mr-2 h-4 w-4 shrink-0" />
                Πορτοφόλι
              </DropdownMenuItem>
              <DropdownMenuItem className={itemClassName} onSelect={() => go('/driver?tab=referral')}>
                <Users className="mr-2 h-4 w-4 shrink-0" />
                Πρόσκληση Οδηγών
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className={labelClassName}>Ρυθμίσεις</DropdownMenuLabel>
              <DropdownMenuItem
                className={itemClassName}
                onSelect={(e) => {
                  e.preventDefault();
                  setMenuOpen(false);
                  setTimeout(() => setSettingsOpen(true), 50);
                }}
              >
                <Settings className="mr-2 h-4 w-4 shrink-0" />
                Ρυθμίσεις Εφαρμογής
              </DropdownMenuItem>
              <DropdownMenuItem
                className={itemClassName}
                onSelect={(e) => {
                  e.preventDefault();
                  setMenuOpen(false);
                  setTimeout(() => setSoundOpen(true), 50);
                }}
              >
                <Bell className="mr-2 h-4 w-4 shrink-0" />
                Ήχος Ειδοποιήσεων
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className={labelClassName}>Βοήθεια</DropdownMenuLabel>
              <DropdownMenuItem className={itemClassName} onSelect={() => go('/driver/profile?tab=support')}>
                <LifeBuoy className="mr-2 h-4 w-4 shrink-0" />
                Υποστήριξη
              </DropdownMenuItem>
              <DropdownMenuItem className={itemClassName} onSelect={() => { setMenuOpen(false); handleShare(); }}>
                <Share2 className="mr-2 h-4 w-4 shrink-0" />
                Μοιραστείτε την εφαρμογή
              </DropdownMenuItem>
              <DropdownMenuItem className={itemClassName} onSelect={() => window.open('https://quick-handoff-grid.lovable.app', '_blank')}>
                <HelpCircle className="mr-2 h-4 w-4 shrink-0" />
                Συχνές Ερωτήσεις
              </DropdownMenuItem>
              <DropdownMenuItem className={itemClassName} onSelect={() => window.open('https://quick-handoff-grid.lovable.app', '_blank')}>
                <FileText className="mr-2 h-4 w-4 shrink-0" />
                Όροι & Πολιτική
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className={itemClassName} onSelect={() => go('/')}>
                <Home className="mr-2 h-4 w-4 shrink-0" />
                Αρχική
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => { setMenuOpen(false); handleSignOut(); }}
            className="min-h-11 rounded-xl px-3 py-3 text-sm font-medium text-destructive cursor-pointer transition-colors focus:bg-destructive/10 focus:text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4 shrink-0" />
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
