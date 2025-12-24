"use client"

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bell, BellRing, Plus, Trash2, TrendingUp, Clock, Target, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

// Alert types
export type AlertType = 
  | 'odds_threshold'      // YES odds reach X%
  | 'odds_movement'       // Odds move X% from current
  | 'time_before_close'   // X hours before market closes
  | 'new_market'          // New market in category
  | 'position_change';    // Your position value changes X%

export interface MarketAlert {
  id: string;
  marketAddress?: string;
  marketTitle?: string;
  type: AlertType;
  enabled: boolean;
  createdAt: number;
  
  // Alert-specific parameters
  targetOdds?: number;           // For odds_threshold
  oddsDirection?: 'above' | 'below';
  movementPercent?: number;      // For odds_movement
  hoursBeforeClose?: number;     // For time_before_close
  category?: string;             // For new_market
  positionChangePercent?: number; // For position_change
  
  // Tracking
  lastTriggered?: number;
  triggerCount: number;
}

interface AlertManagerProps {
  userAddress: string;
  currentMarketAddress?: string;
  currentMarketTitle?: string;
  currentYesOdds?: number;
}

export function AlertManager({
  userAddress,
  currentMarketAddress,
  currentMarketTitle,
  currentYesOdds,
}: AlertManagerProps) {
  const [alerts, setAlerts] = useState<MarketAlert[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AlertType>('odds_threshold');

  // Form state for new alert
  const [targetOdds, setTargetOdds] = useState('50');
  const [oddsDirection, setOddsDirection] = useState<'above' | 'below'>('below');
  const [movementPercent, setMovementPercent] = useState('10');
  const [hoursBeforeClose, setHoursBeforeClose] = useState('24');
  const [category, setCategory] = useState('Crypto');
  const [positionChangePercent, setPositionChangePercent] = useState('20');

 
}