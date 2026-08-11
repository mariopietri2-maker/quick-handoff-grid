-- Enable realtime for menu_items so the customer app can show new items
-- instantly when a restaurant/store adds or edits a menu item.
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
