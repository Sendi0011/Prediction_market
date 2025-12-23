"use client"

import { useState, useEffect, useCallback } from 'react'
import { usePublicClient } from 'wagmi'
import { baseSepolia } from 'viem/chains'
import { MARKET_ABI } from '@/lib/contracts'
import { formatUsdc } from '@/lib/web3-utils'
import type { Address } from 'viem'

interface MarketHistoryPoint {
  timestamp: number
  yesOdds: number
  noOdds: number
  yesVolume: number
  noVolume: number
  totalVolume: number
  blockNumber: number
}

/**
 * Hook to fetch and track market probability history
 * This listens to Staked events and builds a historical timeline
 */
export function useMarketHistory(marketAddress: Address) {
  const publicClient = usePublicClient({ chainId: baseSepolia.id })
  const [history, setHistory] = useState<MarketHistoryPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch historical stake events
  const fetchHistory = useCallback(async () => {
    if (!publicClient || !marketAddress) return

    setIsLoading(true)
    setError(null)

    try {
      // Get market creation block (you can store this in your factory or calculate it)
      const currentBlock = await publicClient.getBlockNumber()
      const fromBlock = currentBlock - BigInt(100000) // Look back ~2 weeks on Base

      // Fetch all Staked events
      const logs = await publicClient.getLogs({
        address: marketAddress,
        event: {
          type: 'event',
          name: 'Staked',
          inputs: [
            { name: 'user', type: 'address', indexed: true },
            { name: 'side', type: 'uint8', indexed: false },
            { name: 'amount', type: 'uint256', indexed: false },
            { name: 'totalPool', type: 'uint256', indexed: false },
          ],
        },
        fromBlock,
        toBlock: 'latest',
      })

      // Build history from events
      const historyPoints: MarketHistoryPoint[] = []
      let yesPool = 0
      let noPool = 0

      for (const log of logs) {
        const { args, blockNumber } = log as any
        const side = args.side
        const amount = formatUsdc(args.amount)
        
        // Update pools
        if (side === 0) { // YES
          yesPool += amount
        } else { // NO
          noPool += amount
        }

        const totalPool = yesPool + noPool
        const yesOdds = totalPool > 0 ? (yesPool / totalPool) * 100 : 50
        const noOdds = 100 - yesOdds

        // Get block timestamp
        const block = await publicClient.getBlock({ blockNumber })
        
        historyPoints.push({
          timestamp: Number(block.timestamp) * 1000, // Convert to ms
          yesOdds,
          noOdds,
          yesVolume: yesPool,
          noVolume: noPool,
          totalVolume: totalPool,
          blockNumber: Number(blockNumber),
        })
      }

      // If no history, create initial point with current state
      if (historyPoints.length === 0) {
        const [yesPoolCurrent, noPoolCurrent] = await Promise.all([
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
        ])

        const yesPoolFormatted = formatUsdc(yesPoolCurrent as bigint)
        const noPoolFormatted = formatUsdc(noPoolCurrent as bigint)
        const total = yesPoolFormatted + noPoolFormatted

        if (total > 0) {
          historyPoints.push({
            timestamp: Date.now(),
            yesOdds: (yesPoolFormatted / total) * 100,
            noOdds: (noPoolFormatted / total) * 100,
            yesVolume: yesPoolFormatted,
            noVolume: noPoolFormatted,
            totalVolume: total,
            blockNumber: Number(currentBlock),
          })
        }
      }

      setHistory(historyPoints)
    } catch (err) {
      console.error('Error fetching market history:', err)
      setError('Failed to load market history')
    } finally {
      setIsLoading(false)
    }
  }, [publicClient, marketAddress])

  // Initial fetch
  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // Poll for new events every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchHistory()
    }, 30000)

    return () => clearInterval(interval)
  }, [fetchHistory])

  return {
    history,
    isLoading,
    error,
    refetch: fetchHistory,
  }
}

/**
 * Generate mock historical data for testing/demo
 * Remove this in production once you have real event data
 */
export function generateMockHistory(
  currentYesOdds: number,
  daysBack: number = 7
): MarketHistoryPoint[] {
  const points: MarketHistoryPoint[] = []
  const now = Date.now()
  const msPerDay = 24 * 60 * 60 * 1000
  
  // Start with odds different from current
  let yesOdds = Math.max(20, Math.min(80, currentYesOdds + (Math.random() * 30 - 15)))
  let totalVolume = 1000

  for (let i = daysBack * 24; i >= 0; i--) {
    // Add some random walk to the odds
    const change = (Math.random() - 0.5) * 5
    yesOdds = Math.max(10, Math.min(90, yesOdds + change))
    
    // Gradually converge toward current odds
    const convergeFactor = 1 - (i / (daysBack * 24))
    yesOdds = yesOdds * (1 - convergeFactor * 0.1) + currentYesOdds * (convergeFactor * 0.1)
    
    const noOdds = 100 - yesOdds
    
    // Increase volume over time
    totalVolume += Math.random() * 500
    const yesVolume = (totalVolume * yesOdds) / 100
    const noVolume = (totalVolume * noOdds) / 100

    points.push({
      timestamp: now - i * (msPerDay / 24), // Hourly points
      yesOdds,
      noOdds,
      yesVolume,
      noVolume,
      totalVolume,
      blockNumber: 1000000 + (daysBack * 24 - i),
    })
  }

  return points
}