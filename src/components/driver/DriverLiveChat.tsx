import { useAuth } from '@/hooks/useAuth';
import { LiveChatThread } from '@/components/support/LiveChatThread';

export function DriverLiveChat({ orderId, className }: { orderId?: string | null; className?: string }) {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <LiveChatThread
      driverId={user.id}
      orderId={orderId}
      viewerRole="driver"
      title="Ζωντανή Συνομιλία"
      subtitle="Επείγον — απάντηση σε πραγματικό χρόνο"
      className={className}
    />
  );
}
