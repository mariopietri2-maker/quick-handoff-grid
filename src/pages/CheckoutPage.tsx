import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, Trash2, MapPin, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, storeId, storeName, total, itemCount, updateQuantity, removeItem, clearCart } = useCart();
  const { user } = useAuth();
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const deliveryFee = 0.99;
  const tip = 0;
  const grandTotal = total + deliveryFee + tip;

  const handlePlaceOrder = async () => {
    if (!user) {
      toast.error('Please sign in to place an order');
      navigate('/auth');
      return;
    }
    if (!address.trim()) {
      toast.error('Please enter a delivery address');
      return;
    }
    if (!storeId || items.length === 0) return;

    setSubmitting(true);
    try {
      // Create the order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: user.id,
          store_id: storeId,
          status: 'placed' as any,
          total_amount: total,
          delivery_fee: deliveryFee,
          tip_amount: tip,
          delivery_address: address,
          notes: notes || null,
        })
        .select()
        .single();

      if (orderError || !order) {
        throw orderError || new Error('Failed to create order');
      }

      // Create order items
      const orderItems = items.map(item => ({
        order_id: order.id,
        menu_item_id: item.menuItemId,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        throw itemsError;
      }

      clearCart();
      toast.success('Order placed! 🎉');
      navigate(`/order-tracking/${order.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-50">
          <button onClick={() => navigate('/order')} className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="font-heading font-bold text-lg text-foreground">Your Cart</h1>
        </header>
        <div className="text-center py-16 px-4">
          <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="font-heading text-xl text-foreground">Your cart is empty</p>
          <p className="text-sm text-muted-foreground mt-1">Browse restaurants and add items</p>
          <Button onClick={() => navigate('/order')} className="mt-6 gradient-primary text-primary-foreground font-heading shadow-primary">
            Browse Restaurants
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div>
          <h1 className="font-heading font-bold text-lg text-foreground">Checkout</h1>
          <p className="text-xs text-muted-foreground">from {storeName}</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Cart Items */}
        <Card className="shadow-[var(--shadow-md)]">
          <CardContent className="p-4 space-y-3">
            <h2 className="font-heading font-semibold text-foreground">Your Items</h2>
            {items.map(item => (
              <div key={item.menuItemId} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex-1">
                  <p className="font-heading text-sm text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">${item.price.toFixed(2)} each</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.menuItemId, item.quantity - 1)}
                    className="h-7 w-7 rounded-full bg-muted flex items-center justify-center"
                  >
                    {item.quantity === 1 ? <Trash2 className="h-3.5 w-3.5 text-destructive" /> : <Minus className="h-3.5 w-3.5 text-foreground" />}
                  </button>
                  <span className="font-heading font-bold text-sm w-5 text-center text-foreground">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.menuItemId, item.quantity + 1)}
                    className="h-7 w-7 rounded-full gradient-primary flex items-center justify-center"
                  >
                    <Plus className="h-3.5 w-3.5 text-primary-foreground" />
                  </button>
                  <span className="font-heading font-semibold text-sm text-foreground w-14 text-right">
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Delivery Address */}
        <Card className="shadow-[var(--shadow-md)]">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <h2 className="font-heading font-semibold text-foreground">Delivery Address</h2>
            </div>
            <Input
              placeholder="Enter your delivery address"
              value={address}
              onChange={e => setAddress(e.target.value)}
              maxLength={200}
            />
          </CardContent>
        </Card>

        {/* Notes */}
        <Card className="shadow-[var(--shadow-md)]">
          <CardContent className="p-4 space-y-2">
            <Label className="font-heading">Order Notes (optional)</Label>
            <Textarea
              placeholder="Any special instructions..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              maxLength={500}
              rows={2}
            />
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card className="shadow-[var(--shadow-md)]">
          <CardContent className="p-4 space-y-2">
            <h2 className="font-heading font-semibold text-foreground">Order Summary</h2>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-foreground">${total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Delivery Fee</span>
              <span className="text-foreground">${deliveryFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-heading font-bold pt-2 border-t border-border">
              <span className="text-foreground">Total</span>
              <span className="text-foreground">${grandTotal.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Place Order Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur border-t border-border z-50">
        <div className="max-w-lg mx-auto">
          <Button
            onClick={handlePlaceOrder}
            disabled={submitting || !address.trim()}
            className="w-full h-14 gradient-primary shadow-primary text-primary-foreground font-heading text-lg rounded-2xl"
          >
            {submitting ? 'Placing Order...' : `Place Order — $${grandTotal.toFixed(2)}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
