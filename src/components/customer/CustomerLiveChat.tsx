import { useAuth } from '@/hooks/useAuth';
import { LiveChatThread } from '@/components/support/LiveChatThread';

export function CustomerLiveChat({ orderId, className }: { orderId?: string | null; className?: string }) {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <LiveChatThread
      customerId={user.id}
      orderId={orderId}
      viewerRole="customer"
      title="Ζωντανή Συνομιλία"
      subtitle="Επείγον — απάντηση σε πραγματικό χρόνο"
      className={className}
    />
  );
}
