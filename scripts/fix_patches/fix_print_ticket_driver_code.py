#!/usr/bin/env python3
from pathlib import Path
p = Path("src/components/store/PrintOrderTicket.tsx")
t = p.read_text()
if "driverCode?: string | null" in t:
    print("already")
    raise SystemExit(0)
old = """export function PrintTicketButton({
  order,
  storeName,
  extras,
  storeId,
}: {
  order: OrderWithItems;
  storeName: string;
  extras?: PrintOrderExtras;
  storeId?: string | null;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        void printOrderSafe(order, storeName, extras, storeId).catch(() => {});
      }}"""
new = """export function PrintTicketButton({
  order,
  storeName,
  extras,
  storeId,
  driverCode,
}: {
  order: OrderWithItems;
  storeName: string;
  extras?: PrintOrderExtras;
  storeId?: string | null;
  driverCode?: string | null;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        const merged = { ...(extras ?? {}), ...(driverCode ? { driverCode } : {}) };
        void printOrderSafe(order, storeName, merged, storeId).catch(() => {});
      }}"""
if old not in t:
    raise SystemExit("MISS PrintTicketButton")
t = t.replace(old, new)
p.write_text(t)
print("ok")
