"use client"

import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertManager } from "@/components/AlertManager"
import { useAlertMonitor } from "@/hooks/use-alert-monitor"
import { usePrivy } from "@privy-io/react-auth"
import { useState, useEffect } from "react"
import { Bell, BellRing, BellOff, Settings, TrendingUp, Clock, Sparkles, Target } from "lucide-react"
import type { MarketAlert } from "@/components/AlertManager"

export default function AlertsPage() {
  const { user, login } = usePrivy()
  const { checkAlerts } = useAlertMonitor(user?.wallet?.address)
  const [alerts, setAlerts] = useState<MarketAlert[]>([])
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)

  // Load alerts
  useEffect(() => {
    const loadAlerts = async () => {
      if (!user?.wallet?.address) return

      try {
        const result = await window.localStorage.get(`alerts:${user.wallet.address}`)
        if (result?.value) {
          setAlerts(JSON.parse(result.value))
        }
      } catch (error) {
        console.error('Error loading alerts:', error)
      }
    }

    loadAlerts()

    // Refresh every 5 seconds
    const interval = setInterval(loadAlerts, 5000)
    return () => clearInterval(interval)
  }, [user?.wallet?.address])

  // Check notification permission
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted')
    }
  }, [])

  // Request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      setNotificationsEnabled(permission === 'granted')
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl font-bold mb-4 text-foreground">Sign in to manage alerts</h2>
          <Button onClick={login} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            Login with Privy
          </Button>
        </main>
      </div>
    )
  }

  const activeAlerts = alerts.filter(a => a.enabled)
  const pausedAlerts = alerts.filter(a => !a.enabled)

  // Group alerts by type
  const alertsByType = {
    odds_threshold: alerts.filter(a => a.type === 'odds_threshold'),
    odds_movement: alerts.filter(a => a.type === 'odds_movement'),
    time_before_close: alerts.filter(a => a.type === 'time_before_close'),
    new_market: alerts.filter(a => a.type === 'new_market'),
    position_change: alerts.filter(a => a.type === 'position_change'),
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Alert Center</h1>
              <p className="text-muted-foreground">
                Manage your market notifications and stay updated
              </p>
            </div>
            <Button onClick={checkAlerts} variant="outline" className="gap-2">
              <Settings className="h-4 w-4" />
              Test Alerts
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <BellRing className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{activeAlerts.length}</p>
                    <p className="text-sm text-muted-foreground">Active Alerts</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <BellOff className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{pausedAlerts.length}</p>
                    <p className="text-sm text-muted-foreground">Paused</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <Bell className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {alerts.reduce((sum, a) => sum + a.triggerCount, 0)}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Triggers</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${notificationsEnabled ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
                    <Bell className={`h-5 w-5 ${notificationsEnabled ? 'text-green-500' : 'text-destructive'}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {notificationsEnabled ? 'Enabled' : 'Disabled'}
                    </p>
                    <p className="text-xs text-muted-foreground">Browser Notifications</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Alert Manager */}
          <div className="lg:col-span-2 space-y-6">
            {/* Notification Permission */}
            {!notificationsEnabled && (
              <Card className="border-amber-500/50 bg-amber-500/5">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Bell className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">Enable Browser Notifications</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Get instant notifications even when you're not on the page
                      </p>
                      <Button 
                        onClick={requestNotificationPermission}
                        size="sm"
                        className="bg-amber-500 hover:bg-amber-600"
                      >
                        Enable Notifications
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* All Alerts */}
            <AlertManager
              userAddress={user.wallet?.address || ''}
            />

            {/* Alert Statistics by Type */}
            {alerts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Alerts by Type</CardTitle>
                  <CardDescription>Breakdown of your alert preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {alertsByType.odds_threshold.length > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Odds Threshold</span>
                      </div>
                      <Badge variant="secondary">{alertsByType.odds_threshold.length}</Badge>
                    </div>
                  )}

                  {alertsByType.odds_movement.length > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Odds Movement</span>
                      </div>
                      <Badge variant="secondary">{alertsByType.odds_movement.length}</Badge>
                    </div>
                  )}

                  {alertsByType.time_before_close.length > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Time Alerts</span>
                      </div>
                      <Badge variant="secondary">{alertsByType.time_before_close.length}</Badge>
                    </div>
                  )}

                  {alertsByType.new_market.length > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">New Markets</span>
                      </div>
                      <Badge variant="secondary">{alertsByType.new_market.length}</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Tips & Info */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  How Alerts Work
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <h4 className="font-semibold mb-1">Real-time Monitoring</h4>
                  <p className="text-muted-foreground">
                    We check your alerts every 30 seconds to ensure you never miss important changes.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-1">Browser Notifications</h4>
                  <p className="text-muted-foreground">
                    Get notified even when TruthBase isn't open. Enable browser notifications above.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-1">Smart Cooldowns</h4>
                  <p className="text-muted-foreground">
                    Alerts won't spam you - they have built-in cooldown periods to prevent notification fatigue.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/50 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-lg">Pro Tips</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex gap-2">
                  <span className="text-primary">💡</span>
                  <p>Set multiple alerts on the same market to catch different scenarios</p>
                </div>
                <div className="flex gap-2">
                  <span className="text-primary">💡</span>
                  <p>Use time alerts to remind yourself before markets close</p>
                </div>
                <div className="flex gap-2">
                  <span className="text-primary">💡</span>
                  <p>Movement alerts help you spot sudden changes in market sentiment</p>
                </div>
                <div className="flex gap-2">
                  <span className="text-primary">💡</span>
                  <p>Category alerts keep you updated on your favorite market types</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Alert Limits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current alerts</span>
                  <span className="font-semibold">{alerts.length} / 50</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${(alerts.length / 50) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  You can create up to 50 alerts per account
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}