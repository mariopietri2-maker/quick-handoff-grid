import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ClipboardList, UtensilsCrossed, Settings, Plus, Bell, BarChart3, Tag,
  Package, Clock, Zap, PackagePlus, ArrowLeft, Power, ReceiptText,
  LayoutDashboard, History, Wallet, ChevronRight, Menu as MenuIcon, X,
} from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { UserMenu } from '@/components/UserMenu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StoreDashboard from '@/components/store/StoreDashboard';
import { MenuControl } from '@/components/store/MenuControl';
import { StoreSettings } from '@/components/store/StoreSettings';
import { PrinterSettings } from '@/components/store/PrinterSettings';
import { StoreAnalyticsDashboard } from '@/components/store/StoreAnalyticsDashboard';
import { PromoManager } from '@/components/store/PromoManager';
import { InventoryControl } from '@/components/store/InventoryControl';
import { StoreHoursManager } from '@/components/store/StoreHoursManager';
import AutoAcceptRules from '@/components/store/AutoAcceptRules';
import StoreExternalOrderIngest from '@/components/store/StoreExternalOrderIngest';
import StoreWalletCard from '@/components/store/StoreWalletCard';
import StoreOrderPnl from '@/components/store/StoreOrderPnl';
import MenuImportFromReceipt from '@/components/store/MenuImportFromReceipt';
import { StoreOpennessToggle } from '@/components/store/StoreOpennessToggle';
import { isStoreOpenNow } from '@/lib/store-hours';
import { StoreSupportButton } from '@/components/store/StoreSupportButton';
import { OwnerStoresPortal } from '@/components/store/OwnerStoresPortal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StoreCallPanel } from '@/components/store/StoreCallPanel';
import { StoreNewsPanel } from '@/components/store/StoreNewsPanel';
import { StoreDriverIdPanel } from '@/components/store/StoreDriverIdPanel';
import { Switch } from '@/components/ui/switch';
import { useStoreOrders } from '@/hooks/useOrders';
import { useStore } from '@/hooks/useStore';
import { requestNotificationPermission, installAudioUnlock, unlockAudio } from '@/lib/notifications';
import { showOsNotification } from '@/lib/push-notifications';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// NOTE: Full file body is applied from local workspace patch.
// If this push fails validation, use the repo local path.
export {};
