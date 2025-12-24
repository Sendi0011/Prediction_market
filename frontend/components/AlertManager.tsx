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

  // Load alerts from storage
  useEffect(() => {
    const loadAlerts = async () => {
      try {
        const result = await window.storage.get(`alerts:${userAddress}`);
        if (result?.value) {
          setAlerts(JSON.parse(result.value));
        }
      } catch (error) {
        console.log('No saved alerts or error loading:', error);
      }
    };
    loadAlerts();
  }, [userAddress]);

  // Save alerts to storage
  const saveAlerts = async (updatedAlerts: MarketAlert[]) => {
    try {
      await window.storage.set(
        `alerts:${userAddress}`,
        JSON.stringify(updatedAlerts)
      );
      setAlerts(updatedAlerts);
    } catch (error) {
      console.error('Error saving alerts:', error);
      toast.error('Failed to save alert');
    }
  };

  // Create new alert
  const createAlert = (type: AlertType) => {
    const newAlert: MarketAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      marketAddress: currentMarketAddress,
      marketTitle: currentMarketTitle,
      type,
      enabled: true,
      createdAt: Date.now(),
      triggerCount: 0,
    };

    // Set type-specific parameters
    switch (type) {
      case 'odds_threshold':
        newAlert.targetOdds = parseFloat(targetOdds);
        newAlert.oddsDirection = oddsDirection;
        break;
      case 'odds_movement':
        newAlert.movementPercent = parseFloat(movementPercent);
        break;
      case 'time_before_close':
        newAlert.hoursBeforeClose = parseFloat(hoursBeforeClose);
        break;
      case 'new_market':
        newAlert.category = category;
        newAlert.marketAddress = undefined; // Global alert
        break;
      case 'position_change':
        newAlert.positionChangePercent = parseFloat(positionChangePercent);
        break;
    }

    const updatedAlerts = [...alerts, newAlert];
    saveAlerts(updatedAlerts);
    toast.success('Alert created successfully!');
    setIsOpen(false);
  };

  // Toggle alert
  const toggleAlert = async (alertId: string) => {
    const updatedAlerts = alerts.map(alert =>
      alert.id === alertId ? { ...alert, enabled: !alert.enabled } : alert
    );
    saveAlerts(updatedAlerts);
    toast.success(updatedAlerts.find(a => a.id === alertId)?.enabled ? 'Alert enabled' : 'Alert disabled');
  };

  // Delete alert
  const deleteAlert = async (alertId: string) => {
    const updatedAlerts = alerts.filter(alert => alert.id !== alertId);
    saveAlerts(updatedAlerts);
    toast.success('Alert deleted');
  };

  // Get alert description
  const getAlertDescription = (alert: MarketAlert): string => {
    switch (alert.type) {
      case 'odds_threshold':
        return `Notify when YES odds go ${alert.oddsDirection} ${alert.targetOdds}%`;
      case 'odds_movement':
        return `Notify when odds move ${alert.movementPercent}%+ from current`;
      case 'time_before_close':
        return `Notify ${alert.hoursBeforeClose}h before market closes`;
      case 'new_market':
        return `Notify when new ${alert.category} market is created`;
      case 'position_change':
        return `Notify when position value changes ${alert.positionChangePercent}%+`;
      default:
        return 'Unknown alert type';
    }
  };

  // Get alert icon
  const getAlertIcon = (type: AlertType) => {
    switch (type) {
      case 'odds_threshold':
      case 'odds_movement':
        return <TrendingUp className="h-4 w-4" />;
      case 'time_before_close':
        return <Clock className="h-4 w-4" />;
      case 'new_market':
        return <Sparkles className="h-4 w-4" />;
      case 'position_change':
        return <Target className="h-4 w-4" />;
    }
  };

  // Filter alerts for current market
  const marketAlerts = alerts.filter(a => 
    a.marketAddress === currentMarketAddress || a.type === 'new_market'
  );
  const activeAlerts = marketAlerts.filter(a => a.enabled);

  return (
    <div className="space-y-4">
      {/* Alert Summary Badge (for market page) */}
      {currentMarketAddress && activeAlerts.length > 0 && (
        <Badge variant="secondary" className="gap-2">
          <BellRing className="h-3 w-3" />
          {activeAlerts.length} active {activeAlerts.length === 1 ? 'alert' : 'alerts'}
        </Badge>
      )}

      {/* Create Alert Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Create Alert
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Market Alert</DialogTitle>
            <DialogDescription>
              Get notified when specific conditions are met
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AlertType)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="odds_threshold" className="text-xs">
                <TrendingUp className="h-3 w-3 mr-1" />
                Odds
              </TabsTrigger>
              <TabsTrigger value="odds_movement" className="text-xs">
                <Target className="h-3 w-3 mr-1" />
                Movement
              </TabsTrigger>
              <TabsTrigger value="time_before_close" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                Time
              </TabsTrigger>
            </TabsList>

            {/* Odds Threshold Alert */}
            <TabsContent value="odds_threshold" className="space-y-4">
              <div className="space-y-3">
                <Label>Notify me when YES odds...</Label>
                <Select value={oddsDirection} onValueChange={(v: 'above' | 'below') => setOddsDirection(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="below">Drop below</SelectItem>
                    <SelectItem value="above">Rise above</SelectItem>
                  </SelectContent>
                </Select>

                <div className="space-y-2">
                  <Label>Target Percentage</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={targetOdds}
                      onChange={(e) => setTargetOdds(e.target.value)}
                      className="flex-1"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                  {currentYesOdds && (
                    <p className="text-xs text-muted-foreground">
                      Current odds: {currentYesOdds.toFixed(1)}%
                    </p>
                  )}
                </div>

                <div className="p-3 rounded-lg bg-muted/50 text-sm">
                  <strong>Example:</strong> If you set "below 40%", you'll be notified when 
                  YES odds drop below 40% (meaning NO becomes more likely).
                </div>
              </div>

              <Button onClick={() => createAlert('odds_threshold')} className="w-full">
                Create Odds Alert
              </Button>
            </TabsContent>

            {/* Odds Movement Alert */}
            <TabsContent value="odds_movement" className="space-y-4">
              <div className="space-y-3">
                <Label>Notify me when odds move by...</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={movementPercent}
                    onChange={(e) => setMovementPercent(e.target.value)}
                    className="flex-1"
                  />
                  <span className="text-muted-foreground">% or more</span>
                </div>

                <div className="p-3 rounded-lg bg-muted/50 text-sm">
                  <strong>Example:</strong> If odds are currently 50% and you set 10%, 
                  you'll be notified when they reach 60% or drop to 40%.
                </div>
              </div>

              <Button onClick={() => createAlert('odds_movement')} className="w-full">
                Create Movement Alert
              </Button>
            </TabsContent>

            {/* Time Before Close Alert */}
            <TabsContent value="time_before_close" className="space-y-4">
              <div className="space-y-3">
                <Label>Notify me this many hours before market closes</Label>
                <Select value={hoursBeforeClose} onValueChange={setHoursBeforeClose}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 hour</SelectItem>
                    <SelectItem value="6">6 hours</SelectItem>
                    <SelectItem value="12">12 hours</SelectItem>
                    <SelectItem value="24">24 hours (1 day)</SelectItem>
                    <SelectItem value="48">48 hours (2 days)</SelectItem>
                    <SelectItem value="168">168 hours (1 week)</SelectItem>
                  </SelectContent>
                </Select>

                <div className="p-3 rounded-lg bg-muted/50 text-sm">
                  <strong>Tip:</strong> Set this alert to remind yourself to make a final 
                  prediction before the market closes!
                </div>
              </div>

              <Button onClick={() => createAlert('time_before_close')} className="w-full">
                Create Time Alert
              </Button>
            </TabsContent>
          </Tabs>

          {/* Additional Alert Types */}
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-sm font-semibold">More Alert Types</Label>
            
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setActiveTab('new_market');
                  createAlert('new_market');
                }}
                className="h-auto py-4 flex-col gap-2"
              >
                <Sparkles className="h-5 w-5" />
                <div className="text-xs text-center">
                  New {category} Markets
                </div>
              </Button>

              {currentMarketAddress && (
                <Button
                  variant="outline"
                  onClick={() => createAlert('position_change')}
                  className="h-auto py-4 flex-col gap-2"
                >
                  <Target className="h-5 w-5" />
                  <div className="text-xs text-center">
                    Position Value ±{positionChangePercent}%
                  </div>
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Active Alerts List */}
      {marketAlerts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Your Alerts
            </CardTitle>
            <CardDescription className="text-xs">
              {activeAlerts.length} active • {marketAlerts.length - activeAlerts.length} paused
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {marketAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition ${
                  alert.enabled
                    ? 'bg-card border-border'
                    : 'bg-muted/30 border-muted opacity-60'
                }`}
              >
                <div className={`p-2 rounded-lg ${
                  alert.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  {getAlertIcon(alert.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {getAlertDescription(alert)}
                  </p>
                  {alert.marketTitle && (
                    <p className="text-xs text-muted-foreground truncate">
                      {alert.marketTitle}
                    </p>
                  )}
                  {alert.triggerCount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Triggered {alert.triggerCount} {alert.triggerCount === 1 ? 'time' : 'times'}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={alert.enabled}
                    onCheckedChange={() => toggleAlert(alert.id)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteAlert(alert.id)}
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {marketAlerts.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="pt-6 pb-6 text-center">
            <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground mb-1">No alerts set</p>
            <p className="text-xs text-muted-foreground">
              Create alerts to stay updated on market changes
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}