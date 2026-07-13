/*
# Fix store sticker trigger blocking store creation

## Problem
The `auto_create_store_sticker` trigger used `ON CONFLICT (store_id)` but there was no unique constraint on `store_stickers.store_id`, only on `sticker_code`. This caused the trigger to throw an error when a new store was inserted, which aborted the entire store creation.

## Fix
1. Add a unique constraint on `store_stickers.store_id` so `ON CONFLICT (store_id)` is valid.
2. Make the trigger function more robust: check if a sticker already exists for this store before inserting, instead of relying solely on ON CONFLICT.
*/

-- Add unique constraint on store_id so ON CONFLICT (store_id) works
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_stickers_store_id_unique ON store_stickers(store_id);

-- Recreate the trigger function with a safer approach
CREATE OR REPLACE FUNCTION auto_create_store_sticker()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code text;
  v_store_name text;
  v_exists boolean;
BEGIN
  v_store_name := COALESCE(NEW.name, 'Store');

  -- Check if a sticker already exists for this store
  SELECT EXISTS(SELECT 1 FROM store_stickers WHERE store_id = NEW.id) INTO v_exists;
  IF v_exists THEN
    RETURN NEW;
  END IF;

  -- Generate a unique sticker code: STK-<store initials>-<random 6 chars>
  v_code := 'STK-' || UPPER(LEFT(regexp_replace(v_store_name, '[^A-Za-z0-9]', '', 'g'), 4))
    || '-' || UPPER(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

  INSERT INTO store_stickers (store_id, sticker_code, qr_url, print_status)
  VALUES (
    NEW.id,
    v_code,
    'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' || v_code,
    'pending'
  );

  RETURN NEW;
END;
$$;
