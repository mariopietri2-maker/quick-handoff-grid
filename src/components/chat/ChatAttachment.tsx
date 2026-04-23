import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface ChatAttachmentProps {
  url: string;
  type?: string | null;
  className?: string;
}

/** Renders an image/gif attachment in a chat bubble. Click to open full-size. */
export function ChatAttachment({ url, type, className }: ChatAttachmentProps) {
  const [open, setOpen] = useState(false);
  const isGif = type === 'gif' || url.toLowerCase().includes('.gif');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`block rounded-lg overflow-hidden border bg-background/40 max-w-[220px] hover:opacity-90 transition-opacity ${className ?? ''}`}
      >
        <img
          src={url}
          alt={isGif ? 'GIF' : 'Εικόνα'}
          loading="lazy"
          className="w-full h-auto max-h-64 object-cover"
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-2 bg-background">
          <img src={url} alt="" className="w-full h-auto max-h-[80vh] object-contain rounded" />
        </DialogContent>
      </Dialog>
    </>
  );
}
