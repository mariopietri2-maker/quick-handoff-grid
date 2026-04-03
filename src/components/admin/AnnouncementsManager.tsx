import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Megaphone, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';

const audienceLabels: Record<string, string> = {
  all: 'Everyone',
  drivers: 'Drivers',
  store_owners: 'Store Owners',
};

const audienceColors: Record<string, string> = {
  all: 'bg-primary/10 text-primary border-primary/20',
  drivers: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  store_owners: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
};

export default function AnnouncementsManager() {
  const { user } = useAuth();
  const { data: announcements, isLoading } = useAnnouncements();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<string>('all');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !message.trim() || !user) return;
    setSending(true);
    const { error } = await supabase.from('announcements').insert({
      title: title.trim(),
      message: message.trim(),
      target_audience: audience,
      created_by: user.id,
    } as any);
    setSending(false);
    if (error) {
      toast.error('Failed to send announcement');
    } else {
      toast.success('Announcement sent!');
      setTitle('');
      setMessage('');
      setAudience('all');
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) toast.error('Failed to delete');
    else {
      toast.success('Announcement deleted');
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <Megaphone className="h-5 w-5" /> New Announcement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Announcement title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            placeholder="Write your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
          />
          <div className="flex items-center gap-3">
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                <SelectItem value="drivers">Drivers Only</SelectItem>
                <SelectItem value="store_owners">Store Owners Only</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSend} disabled={sending || !title.trim() || !message.trim()}>
              <Send className="h-4 w-4 mr-2" />
              {sending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base">Sent Announcements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {announcements?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No announcements yet</p>
          )}
          {announcements?.map((a: any) => (
            <div key={a.id} className="border rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">{a.title}</h4>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={audienceColors[a.target_audience] ?? ''}>
                    {audienceLabels[a.target_audience] ?? a.target_audience}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(a.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{a.message}</p>
              <p className="text-xs text-muted-foreground/60">
                {format(new Date(a.created_at), 'MMM d, yyyy · HH:mm')}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
