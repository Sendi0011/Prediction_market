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
        const result = await window.storage.get(`alerts:${user.wallet.address}`)
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

  
}