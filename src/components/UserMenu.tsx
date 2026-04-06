import { LogOut, User, Home, UserCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';

export function UserMenu() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const isDriver = profile?.role === 'driver';

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
          <User className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="px-2 py-1.5">
          <p className="text-sm font-heading font-semibold text-foreground">{profile?.full_name || 'Χρήστης'}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
        {isDriver ? (
          <DropdownMenuItem onClick={() => navigate('/driver/profile')}>
            <UserCircle className="mr-2 h-4 w-4" />
            Προφίλ Οδηγού
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => navigate('/')}>
            <Home className="mr-2 h-4 w-4" />
            Αρχική
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Αποσύνδεση
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
