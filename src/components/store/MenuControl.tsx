import { useState } from 'react';
import { Moon, X, Search, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useMenuItems } from '@/hooks/useMenuItems';

interface MenuControlProps {
  storeId: string;
}

export function MenuControl({ storeId }: MenuControlProps) {
  const { items, loading, toggleAvailable, toggleSnooze, addItem } = useMenuItems(storeId);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', price: '', category: '', description: '' });

  const handleAdd = async () => {
    if (!newItem.name || !newItem.price || !newItem.category) return;
    await addItem({
      name: newItem.name,
      price: parseFloat(newItem.price),
      category: newItem.category,
      description: newItem.description || undefined,
    });
    setNewItem({ name: '', price: '', category: '', description: '' });
    setAddOpen(false);
  };

  const filtered = items.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    (item.category ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const categories = [...new Set(filtered.map(i => i.category ?? 'Uncategorized'))];

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-muted-foreground font-heading">Loading menu...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search menu items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground shadow-primary">
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">Add Menu Item</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="font-heading">Name</Label>
                <Input value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} placeholder="Item name" maxLength={100} />
              </div>
              <div>
                <Label className="font-heading">Price</Label>
                <Input type="number" step="0.01" min="0" value={newItem.price} onChange={e => setNewItem(p => ({ ...p, price: e.target.value }))} placeholder="0.00" />
              </div>
              <div>
                <Label className="font-heading">Category</Label>
                <Input value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))} placeholder="e.g. Pizza, Drinks" maxLength={50} />
              </div>
              <div>
                <Label className="font-heading">Description (optional)</Label>
                <Input value={newItem.description} onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))} placeholder="Short description" maxLength={200} />
              </div>
              <Button onClick={handleAdd} className="w-full gradient-primary text-primary-foreground font-heading" disabled={!newItem.name || !newItem.price || !newItem.category}>
                Add Item
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16">
          <p className="font-heading text-foreground">No menu items yet</p>
          <p className="text-sm text-muted-foreground mt-1">Add your first item to get started</p>
        </div>
      ) : (
        categories.map(category => (
          <div key={category}>
            <h3 className="font-heading font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-2">
              {category}
            </h3>
            <div className="space-y-2">
              {filtered.filter(i => (i.category ?? 'Uncategorized') === category).map(item => (
                <Card key={item.id} className={`shadow-[var(--shadow-sm)] ${
                  !item.is_available ? 'opacity-50' : item.is_snoozed ? 'border-warning/40' : ''
                }`}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-semibold text-foreground">{item.name}</span>
                        {item.is_snoozed && (
                          <Badge variant="outline" className="text-warning border-warning/30 text-xs">
                            <Moon className="h-3 w-3 mr-1" />
                            Snoozed
                          </Badge>
                        )}
                        {!item.is_available && (
                          <Badge variant="destructive" className="text-xs">
                            <X className="h-3 w-3 mr-1" />
                            86'd
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">${Number(item.price).toFixed(2)}</span>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {item.is_available && (
                        <button
                          onClick={() => toggleSnooze(item.id)}
                          className={`p-2 rounded-lg transition-colors ${
                            item.is_snoozed
                              ? 'bg-warning/10 text-warning'
                              : 'bg-muted text-muted-foreground hover:text-warning'
                          }`}
                          title="Snooze item"
                        >
                          <Moon className="h-4 w-4" />
                        </button>
                      )}
                      <Switch
                        checked={item.is_available ?? true}
                        onCheckedChange={() => toggleAvailable(item.id)}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
