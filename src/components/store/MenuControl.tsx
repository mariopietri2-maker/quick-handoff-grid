import { useState } from 'react';
import { Moon, X, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { mockMenuItems } from '@/lib/mock-data';

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  isAvailable: boolean;
  isSnoozed: boolean;
}

export function MenuControl() {
  const [items, setItems] = useState<MenuItem[]>(mockMenuItems);
  const [search, setSearch] = useState('');

  const toggleAvailable = (id: string) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, isAvailable: !item.isAvailable, isSnoozed: false } : item
    ));
  };

  const toggleSnooze = (id: string) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, isSnoozed: !item.isSnoozed } : item
    ));
  };

  const filtered = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.category.toLowerCase().includes(search.toLowerCase())
  );

  const categories = [...new Set(filtered.map(i => i.category))];

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search menu items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {categories.map(category => (
        <div key={category}>
          <h3 className="font-heading font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-2">
            {category}
          </h3>
          <div className="space-y-2">
            {filtered.filter(i => i.category === category).map(item => (
              <Card key={item.id} className={`shadow-[var(--shadow-sm)] ${
                !item.isAvailable ? 'opacity-50' : item.isSnoozed ? 'border-warning/40' : ''
              }`}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-semibold text-foreground">{item.name}</span>
                      {item.isSnoozed && (
                        <Badge variant="outline" className="text-warning border-warning/30 text-xs">
                          <Moon className="h-3 w-3 mr-1" />
                          Snoozed
                        </Badge>
                      )}
                      {!item.isAvailable && (
                        <Badge variant="destructive" className="text-xs">
                          <X className="h-3 w-3 mr-1" />
                          86'd
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">${item.price.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {item.isAvailable && (
                      <button
                        onClick={() => toggleSnooze(item.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          item.isSnoozed 
                            ? 'bg-warning/10 text-warning' 
                            : 'bg-muted text-muted-foreground hover:text-warning'
                        }`}
                        title="Snooze item"
                      >
                        <Moon className="h-4 w-4" />
                      </button>
                    )}
                    <Switch
                      checked={item.isAvailable}
                      onCheckedChange={() => toggleAvailable(item.id)}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
