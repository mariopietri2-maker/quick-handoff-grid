-- Customer picks a problem topic before starting live chat.
-- The topic is stamped on the messages they send so support agents see it.

ALTER TABLE public.live_chat_messages
  ADD COLUMN IF NOT EXISTS topic text;

CREATE INDEX IF NOT EXISTS idx_live_chat_topic
  ON public.live_chat_messages (topic);
