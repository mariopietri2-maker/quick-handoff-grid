-- Soft launch offer: 10% off with FRESH10.
INSERT INTO public.promo_codes (code, discount_type, discount_value, is_active, max_uses, min_order_amount)
VALUES ('FRESH10', 'percentage', 10, true, 1000, 0)
ON CONFLICT (code) DO UPDATE
SET is_active = true,
    discount_type = 'percentage',
    discount_value = 10,
    max_uses = COALESCE(public.promo_codes.max_uses, 1000);
