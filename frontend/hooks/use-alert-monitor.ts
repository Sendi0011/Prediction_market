"use client"

import { useEffect, useRef, useCallback } from 'react'
import { usePublicClient } from 'wagmi'
import { baseSepolia } from 'viem/chains'
import { MARKET_ABI, FACTORY_ABI, FACTORY_ADDRESS } from '@/lib/contracts'
import { formatUsdc } from '@/lib/web3-utils'
import { toast } from 'sonner'
import type { Address } from 'viem'
import type { MarketAlert } from '@/components/AlertManager'

interface MarketState {
  address: Address
  yesOdds: number
  noOdds: number
  endsAt: number
  totalPool: number
  lastChecked: number
}

/**
 * Hook to monitor alerts and trigger notifications
 * Checks conditions every 30 seconds
 */
export function useAlertMonitor(userAddress: string | undefined) {
  const publicClient = usePublicClient({ chainId: baseSepolia.id })
  const marketStatesRef = useRef<Map<Address, MarketState>>(new Map())
  const alertsRef = useRef<MarketAlert[]>([])
  const lastCheckRef = useRef<number>(Date.now())

  // Load alerts from storage
  const loadAlerts = useCallback(async () => {
    if (!userAddress) return []

    try {
      const result = await window.storage.get(`alerts:${userAddress}`)
      if (result?.value) {
        const alerts = JSON.parse(result.value) as MarketAlert[]
        alertsRef.current = alerts
        return alerts
      }
    } catch (error) {
      console.error('Error loading alerts:', error)
    }
    return []
  }, [userAddress])

  // Update alert trigger count
  const updateAlertTrigger = useCallback(async (alertId: string) => {
    if (!userAddress) return

    const updatedAlerts = alertsRef.current.map(alert => {
      if (alert.id === alertId) {
        return {
          ...alert,
          lastTriggered: Date.now(),
          triggerCount: alert.triggerCount + 1,
        }
      }
      return alert
    })

    alertsRef.current = updatedAlerts

    try {
      await window.storage.set(
        `alerts:${userAddress}`,
        JSON.stringify(updatedAlerts)
      )
    } catch (error) {
      console.error('Error updating alert:', error)
    }
  }, [userAddress])

  

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

import React from 'react'