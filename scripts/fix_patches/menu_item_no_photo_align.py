#!/usr/bin/env python3
"""Align Προσθήκη for menu items without photos (same right column as with photos)."""
from pathlib import Path

p = Path('src/pages/RestaurantPage.tsx')
t = p.read_text()
if 'Fixed right column so Προσθήκη aligns' in t:
    print('already')
    raise SystemExit(0)

old = '''function MenuItemRow({
  item,
  qty,
  onAdd,
  onMinus,
  disabled = false,
}: {
  item: MenuItemRow;
  qty: number;
  onAdd: () => void;
  onMinus: () => void;
  disabled?: boolean;
}) {
  const hasImage = Boolean(item.image_url);
  const inCart = qty > 0;

  return (
    <div
      className={`flex gap-3.5 py-4 ${inCart ? 'bg-[hsl(var(--c-accent-soft))] -mx-2 px-2 rounded-xl' : ''}`}
    >
      <div className="flex-1 min-w-0 flex flex-col">
        <h3 className="font-heading font-extrabold text-[15px] c-ink leading-snug tracking-tight">
          {item.name}
        </h3>
        {item.description && (
          <p className="text-[12px] c-muted mt-1 line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        )}
        <MenuItemBadges
          isVegan={(item as any).is_vegan}
          isVegetarian={(item as any).is_vegetarian}
          isGlutenFree={(item as any).is_gluten_free}
          spicyLevel={(item as any).spicy_level}
          allergens={(item as any).allergens}
          calories={(item as any).calories}
        />
        <div className="mt-auto pt-2.5 flex items-center gap-2 flex-wrap">
          <span className="text-[14px] font-extrabold c-ink tabular-nums">
            {Number(item.price).toFixed(2)}€
          </span>
          {!hasImage && !disabled && (
            inCart ? (
              <QuantityStepper qty={qty} onMinus={onMinus} onPlus={onAdd} />
            ) : (
              <AddButton onClick={onAdd} />
            )
          )}
        </div>
      </div>

      {hasImage && (
        <div className="relative flex-shrink-0 w-[104px]">
          <img
            src={item.image_url!}
            alt={`Φωτογραφία ${item.name}`}
            className="h-[104px] w-[104px] rounded-2xl object-cover bg-[hsl(var(--c-surface-muted))]"
            loading="lazy"
          />
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-max max-w-[112px]">
            {inCart ? (
              <QuantityStepper qty={qty} onMinus={onMinus} onPlus={onAdd} onImage />
            ) : (
              <AddButton onClick={onAdd} compact />
            )}
          </div>
        </div>
      )}
    </div>
  );
}'''

new = '''function MenuItemRow({
  item,
  qty,
  onAdd,
  onMinus,
  disabled = false,
}: {
  item: MenuItemRow;
  qty: number;
  onAdd: () => void;
  onMinus: () => void;
  disabled?: boolean;
}) {
  const hasImage = Boolean(item.image_url);
  const inCart = qty > 0;

  return (
    <div
      className={`flex gap-3.5 py-4 items-stretch ${inCart ? 'bg-[hsl(var(--c-accent-soft))] -mx-2 px-2 rounded-xl' : ''}`}
    >
      <div className="flex-1 min-w-0 flex flex-col">
        <h3 className="font-heading font-extrabold text-[15px] c-ink leading-snug tracking-tight">
          {item.name}
        </h3>
        {item.description && (
          <p className="text-[12px] c-muted mt-1 line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        )}
        <MenuItemBadges
          isVegan={(item as any).is_vegan}
          isVegetarian={(item as any).is_vegetarian}
          isGlutenFree={(item as any).is_gluten_free}
          spicyLevel={(item as any).spicy_level}
          allergens={(item as any).allergens}
          calories={(item as any).calories}
        />
        <div className="mt-auto pt-2.5">
          <span className="text-[14px] font-extrabold c-ink tabular-nums">
            {Number(item.price).toFixed(2)}€
          </span>
        </div>
      </div>

      {/* Fixed right column so Προσθήκη aligns with or without photo */}
      <div className="relative flex-shrink-0 w-[104px] flex flex-col items-center">
        {hasImage ? (
          <img
            src={item.image_url!}
            alt={`Φωτογραφία ${item.name}`}
            className="h-[104px] w-[104px] rounded-2xl object-cover bg-[hsl(var(--c-surface-muted))]"
            loading="lazy"
          />
        ) : (
          <div className="h-[104px] w-[104px] rounded-2xl bg-[hsl(var(--c-surface-muted))] flex items-center justify-center">
            <span className="text-2xl opacity-40" aria-hidden>🍽️</span>
          </div>
        )}
        {!disabled && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-max max-w-[112px]">
            {inCart ? (
              <QuantityStepper qty={qty} onMinus={onMinus} onPlus={onAdd} onImage />
            ) : (
              <AddButton onClick={onAdd} compact />
            )}
          </div>
        )}
      </div>
    </div>
  );
}'''

if old not in t:
    print('miss')
    raise SystemExit(1)
t = t.replace(old, new)
p.write_text(t)
print('patched')
