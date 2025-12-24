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
      const result = await window.localStorage.get(`alerts:${userAddress}`)
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
      await window.localStorage.set(
        `alerts:${userAddress}`,
        JSON.stringify(updatedAlerts)
      )
    } catch (error) {
      console.error('Error updating alert:', error)
    }
  }, [userAddress])

  // Fetch market state
  const fetchMarketState = useCallback(async (
    marketAddress: Address
  ): Promise<MarketState | null> => {
    if (!publicClient) return null

    try {
      const [yesPool, noPool, endsAt] = await Promise.all([
        publicClient.readContract({
          address: marketAddress,
          abi: MARKET_ABI,
          functionName: 'yesPool',
        }),
        publicClient.readContract({
          address: marketAddress,
          abi: MARKET_ABI,
          functionName: 'noPool',
        }),
        publicClient.readContract({
          address: marketAddress,
          abi: MARKET_ABI,
          functionName: 'endsAt',
        }),
      ])

      const yesPoolFormatted = formatUsdc(yesPool as bigint)
      const noPoolFormatted = formatUsdc(noPool as bigint)
      const totalPool = yesPoolFormatted + noPoolFormatted
      const yesOdds = totalPool > 0 ? (yesPoolFormatted / totalPool) * 100 : 50

      return {
        address: marketAddress,
        yesOdds,
        noOdds: 100 - yesOdds,
        endsAt: Number(endsAt),
        totalPool,
        lastChecked: Date.now(),
      }
    } catch (error) {
      console.error('Error fetching market state:', error)
      return null
    }
  }, [publicClient])

  // Check odds threshold alert
  const checkOddsThreshold = useCallback((
    alert: MarketAlert,
    currentState: MarketState
  ): boolean => {
    if (!alert.targetOdds || !alert.oddsDirection) return false

    const { yesOdds } = currentState

    if (alert.oddsDirection === 'below' && yesOdds < alert.targetOdds) {
      return true
    }
    if (alert.oddsDirection === 'above' && yesOdds > alert.targetOdds) {
      return true
    }

    return false
  }, [])

  // Check odds movement alert
  const checkOddsMovement = useCallback((
    alert: MarketAlert,
    currentState: MarketState,
    previousState: MarketState | undefined
  ): boolean => {
    if (!alert.movementPercent || !previousState) return false

    const oddsChange = Math.abs(currentState.yesOdds - previousState.yesOdds)
    return oddsChange >= alert.movementPercent
  }, [])

  // Check time before close alert
  const checkTimeBeforeClose = useCallback((
    alert: MarketAlert,
    currentState: MarketState
  ): boolean => {
    if (!alert.hoursBeforeClose) return false

    const now = Date.now() / 1000 // Convert to seconds
    const timeUntilClose = currentState.endsAt - now
    const targetTime = alert.hoursBeforeClose * 60 * 60 // Convert hours to seconds

    // Trigger if within the alert window (with 5 minute buffer)
    const isInWindow = timeUntilClose <= targetTime && timeUntilClose > (targetTime - 300)
    
    // Only trigger once per alert (check lastTriggered)
    const hasNotTriggeredRecently = !alert.lastTriggered || 
      (Date.now() - alert.lastTriggered) > 60 * 60 * 1000 // 1 hour cooldown

    return isInWindow && hasNotTriggeredRecently
  }, [])

  // Check new market alert (simplified - would need proper event monitoring in production)
  const checkNewMarkets = useCallback(async (
    alert: MarketAlert
  ): Promise<boolean> => {
    if (!alert.category || !publicClient) return false

    // In production, you'd monitor MarketCreated events
    // For now, we'll just check if there are new markets since last check
    try {
      const totalMarkets = await publicClient.readContract({
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: 'getTotalMarkets',
      }) as bigint

      // Store last known count
      const lastKnownCount = parseInt(
        localStorage.getItem('lastMarketCount') || '0'
      )
      const currentCount = Number(totalMarkets)

      if (currentCount > lastKnownCount) {
        localStorage.setItem('lastMarketCount', currentCount.toString())
        return true
      }
    } catch (error) {
      console.error('Error checking new markets:', error)
    }

    return false
  }, [publicClient])

  // Trigger notification
  const triggerNotification = useCallback((
    alert: MarketAlert,
    currentState?: MarketState
  ) => {
    let title = ''
    let description = ''

    switch (alert.type) {
      case 'odds_threshold':
        title = `Odds Alert: ${alert.marketTitle || 'Market'}`
        description = `YES odds are now ${currentState?.yesOdds.toFixed(1)}% (${alert.oddsDirection} ${alert.targetOdds}%)`
        break

      case 'odds_movement':
        title = `Odds Movement: ${alert.marketTitle || 'Market'}`
        description = `Odds have moved ${alert.movementPercent}%+ since your last check`
        break

      case 'time_before_close':
        title = `Market Closing Soon`
        description = `${alert.marketTitle || 'Market'} closes in ${alert.hoursBeforeClose} hours`
        break

      case 'new_market':
        title = `New ${alert.category} Market`
        description = `A new market in ${alert.category} category has been created`
        break

      case 'position_change':
        title = `Position Value Changed`
        description = `Your position in ${alert.marketTitle || 'market'} has changed ${alert.positionChangePercent}%+`
        break
    }

    // Show browser notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: description,
        icon: '/icon.svg',
        tag: alert.id, // Prevent duplicate notifications
      })
    }

    // Show toast notification
    toast.success(title, {
      description,
      duration: 5000,
      action: alert.marketAddress ? {
        label: 'View Market',
        onClick: () => {
          window.location.href = `/markets/${alert.marketAddress}`
        },
      } : undefined,
    })

    // Update alert trigger count
    updateAlertTrigger(alert.id)
  }, [updateAlertTrigger])

  // Main monitoring loop
  const checkAlerts = useCallback(async () => {
    const alerts = await loadAlerts()
    const enabledAlerts = alerts.filter(a => a.enabled)

    if (enabledAlerts.length === 0) return

    // Get unique market addresses
    const marketAddresses = new Set<Address>()
    enabledAlerts.forEach(alert => {
      if (alert.marketAddress) {
        marketAddresses.add(alert.marketAddress as Address)
      }
    })

    // Fetch current states for all markets
    const statePromises = Array.from(marketAddresses).map(address =>
      fetchMarketState(address)
    )
    const states = await Promise.all(statePromises)

    // Update market states map
    states.forEach(state => {
      if (state) {
        const previousState = marketStatesRef.current.get(state.address)
        marketStatesRef.current.set(state.address, state)

        // Check alerts for this market
        enabledAlerts.forEach(alert => {
          if (alert.marketAddress === state.address) {
            let shouldTrigger = false

            switch (alert.type) {
              case 'odds_threshold':
                shouldTrigger = checkOddsThreshold(alert, state)
                break

              case 'odds_movement':
                shouldTrigger = checkOddsMovement(alert, state, previousState)
                break

              case 'time_before_close':
                shouldTrigger = checkTimeBeforeClose(alert, state)
                break
            }

            if (shouldTrigger) {
              triggerNotification(alert, state)
            }
          }
        })
      }
    })

    // Check new market alerts
    const newMarketAlerts = enabledAlerts.filter(a => a.type === 'new_market')
    for (const alert of newMarketAlerts) {
      const hasNewMarkets = await checkNewMarkets(alert)
      if (hasNewMarkets) {
        triggerNotification(alert)
      }
    }

    lastCheckRef.current = Date.now()
  }, [
    loadAlerts,
    fetchMarketState,
    checkOddsThreshold,
    checkOddsMovement,
    checkTimeBeforeClose,
    checkNewMarkets,
    triggerNotification,
  ])

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Start monitoring
  useEffect(() => {
    if (!userAddress) return

    // Initial check
    checkAlerts()

    // Check every 30 seconds
    const interval = setInterval(checkAlerts, 30000)

    return () => clearInterval(interval)
  }, [userAddress, checkAlerts])

  return {
    checkAlerts, // Manual trigger
  }
}

/**
 * Alert Notification Badge Component
 * Shows number of active alerts
 */
export function AlertBadge({ userAddress }: { userAddress: string | undefined }) {
  const [alertCount, setAlertCount] = React.useState(0)

  React.useEffect(() => {
    const loadCount = async () => {
      if (!userAddress) return

      try {
        const result = await window.localStorage.get(`alerts:${userAddress}`)
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

import React from 'react'