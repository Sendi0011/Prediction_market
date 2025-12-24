"use client"

import React, { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import type { MarketAlert } from './AlertManager'

interface AlertBadgeProps {
  userAddress: string | undefined
}

/**
 * Alert Notification Badge Component
 * Shows number of active alerts in navigation
 */
export function AlertBadge({ userAddress }: AlertBadgeProps) {
  const [alertCount, setAlertCount] = useState(0)

  useEffect(() => {
    const loadCount = async () => {
      if (!userAddress) return

      try {
        const result = await window.storage.get(`alerts:${userAddress}`)
        if (result?.value) {
          const alerts = JSON.parse(result.value) as MarketAlert[]
          const activeCount = alerts.filter(a => a.enabled).length
          setAlertCount(activeCount)
        }
      } catch (error) {
        console.error('Error loading alert count:', error)
      }
    }

    loadCount()
    
    // Refresh count every 10 seconds
    const interval = setInterval(loadCount, 10000)
    return () => clearInterval(interval)
  }, [userAddress])

  if (alertCount === 0) return null

  return (
    <div className="relative">
      <Bell className="h-5 w-5" />
      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
        {alertCount}
      </span>
    </div>
  )
}