import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, Trash2, MapPin, ShoppingBag, Tag, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { SavedAddresses } from '@/components/SavedAddresses';

interface AppliedPromo {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, storeId, storeName, total, itemCount, updateQuantity, removeItem, clearCart } = useCart();
  const { user } = useAuth();
  const [address, setAddress] = useState('');
  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);

  const [tipOption, setTipOption] = useState<number | 'custom'>(15);
  const [customTip, setCustomTip] = useState('');

  const deliveryFee = 0.99;
  const subtotalAfterDiscount = Math.max(0, total - (appliedPromo
    ? appliedPromo.discount_type === 'percentage'
      ? Math.min(total, total * (appliedPromo.discount_value / 100))
      : Math.min(total, appliedPromo.discount_value)
    : 0));

  const tipAmount = tipOption === 'custom'
    ? Math.max(0, parseFloat(customTip) || 0)
    : subtotalAfterDiscount * (tipOption / 100);

  const discount = appliedPromo
    ? appliedPromo.discount_type === 'percentage'
      ? Math.min(total, total * (appliedPromo.discount_value / 100))
      : Math.min(total, appliedPromo.discount_value)
    : 0;
  const grandTotal = subtotalAfterDiscount + deliveryFee + tipAmount;

  const handleApplyPromo = async () => {
    const code = promoCode.trim();
    if (!code) return;
    setPromoLoading(true);

    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .ilike('code', code)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      toast.error('Invalid promo code');
      setPromoLoading(false);
      return;
    }

    // Validate expiry
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      toast.error('This promo code has expired');
      setPromoLoading(false);
      return;
    }

    // Validate max uses
    if (data.max_uses !== null && data.current_uses >= data.max_uses) {
      toast.error('This promo code has reached its usage limit');
      setPromoLoading(false);
      return;
    }

    // Validate min order amount
    if (total < Number(data.min_order_amount)) {
      toast.error(`Minimum order of $${Number(data.min_order_amount).toFixed(2)} required`);
      setPromoLoading(false);
      return;
    }

    // Validate store-specific promo
    if (data.store_id && data.store_id !== storeId) {
      toast.error('This code is not valid for this restaurant');
      setPromoLoading(false);
      return;
    }

    setAppliedPromo({
      id: data.id,
      code: data.code,
      discount_type: data.discount_type as 'percentage' | 'fixed',
      discount_value: Number(data.discount_value),
    });
    toast.success('Promo code applied! 🎉');
    setPromoLoading(false);
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoCode('');
  };

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
          total_amount: Math.max(0, total - discount),
          delivery_fee: deliveryFee,
          tip_amount: tipAmount,
          delivery_address: address,
          delivery_latitude: deliveryCoords?.lat ?? null,
          delivery_longitude: deliveryCoords?.lon ?? null,
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
            <AddressAutocomplete
              value={address}
              onChange={(addr, lat, lon) => {
                setAddress(addr);
                if (lat && lon) setDeliveryCoords({ lat, lon });
              }}
            />
            <SavedAddresses
              currentAddress={address}
              onSelect={(addr, lat, lon) => {
                setAddress(addr);
                setDeliveryCoords(lat && lon ? { lat, lon } : null);
              }}
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

        {/* Tip Selection */}
        <Card className="shadow-[var(--shadow-md)]">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">💰</span>
              <h2 className="font-heading font-semibold text-foreground">Tip your driver</h2>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[10, 15, 20, 'custom' as const].map(opt => {
                const isSelected = tipOption === opt;
                return (
                  <button
                    key={String(opt)}
                    onClick={() => setTipOption(opt)}
                    className={`py-2.5 rounded-xl text-sm font-heading font-semibold transition-all ${
                      isSelected
                        ? 'gradient-primary text-primary-foreground shadow-primary'
                        : 'bg-muted text-foreground hover:bg-accent'
                    }`}
                  >
                    {opt === 'custom' ? 'Custom' : `${opt}%`}
                  </button>
                );
              })}
            </div>
            {tipOption !== 'custom' && tipAmount > 0 && (
              <p className="text-sm text-muted-foreground text-center">
                ${tipAmount.toFixed(2)} tip
              </p>
            )}
            {tipOption === 'custom' && (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-heading">$</span>
                <Input
                  type="number"
                  value={customTip}
                  onChange={e => setCustomTip(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.50"
                  className="pl-7 font-heading"
                />
              </div>
            )}
            <button
              onClick={() => { setTipOption('custom'); setCustomTip('0'); }}
              className="text-xs text-muted-foreground underline underline-offset-2"
            >
              No tip
            </button>
          </CardContent>
        </Card>

        {/* Promo Code */}
        <Card className={`shadow-[var(--shadow-md)] ${appliedPromo ? 'border-success/30' : ''}`}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              <h2 className="font-heading font-semibold text-foreground">Promo Code</h2>
            </div>
            {appliedPromo ? (
              <div className="flex items-center justify-between bg-success/5 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <div>
                    <p className="font-heading font-semibold text-foreground text-sm">{appliedPromo.code}</p>
                    <p className="text-xs text-success">
                      {appliedPromo.discount_type === 'percentage'
                        ? `${appliedPromo.discount_value}% off`
                        : `$${appliedPromo.discount_value.toFixed(2)} off`}
                    </p>
                  </div>
                </div>
                <button onClick={removePromo} className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder="Enter code"
                  value={promoCode}
                  onChange={e => setPromoCode(e.target.value.toUpperCase())}
                  maxLength={30}
                  className="font-mono uppercase"
                  onKeyDown={e => e.key === 'Enter' && handleApplyPromo()}
                />
                <Button
                  onClick={handleApplyPromo}
                  disabled={!promoCode.trim() || promoLoading}
                  variant="outline"
                  className="font-heading shrink-0"
                >
                  {promoLoading ? '...' : 'Apply'}
                </Button>
              </div>
            )}
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
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-success">Discount</span>
                <span className="text-success">-${discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Delivery Fee</span>
              <span className="text-foreground">${deliveryFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Driver Tip</span>
              <span className="text-foreground">${tipAmount.toFixed(2)}</span>
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
