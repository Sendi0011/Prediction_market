"use client"

import { useState, useEffect, useCallback } from 'react'
import { usePublicClient } from 'wagmi'
import { baseSepolia } from 'viem/chains'
import { FACTORY_ADDRESS, FACTORY_ABI, MARKET_ABI, MARKET_STATE } from '@/lib/contracts'
import { formatUsdc } from '@/lib/web3-utils'
import type { Address } from 'viem'

export interface UserPosition {
  marketAddress: string
  marketTitle: string
  side: 'YES' | 'NO'
  stakeAmount: number
  currentOdds: number
  potentialPayout: number
  isResolved: boolean
  outcome?: 'WIN' | 'LOSS'
  actualPayout?: number
  timestamp: number
  category?: string
  endsAt: number
  state: number
}

/**
 * Hook to fetch all user positions across all markets
 */
export function useUserPositions(userAddress: Address | undefined) {
  const publicClient = usePublicClient({ chainId: baseSepolia.id })
  const [positions, setPositions] = useState<UserPosition[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUserPositions = useCallback(async () => {
    if (!publicClient || !userAddress) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Get all markets
      const totalMarkets = await publicClient.readContract({
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: 'getTotalMarkets',
      }) as bigint

      const marketCount = Number(totalMarkets)
      
      // Fetch markets in batches
      const markets = await publicClient.readContract({
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: 'getAllMarkets',
        args: [BigInt(0), BigInt(Math.min(marketCount, 100))],
      }) as readonly Address[]

      // Fetch user stakes for each market
      const positionPromises = markets.map(async (marketAddress) => {
        try {
          const [yesStake, noStake, yesPool, noPool, state, endsAt, metadata] = await Promise.all([
            publicClient.readContract({
              address: marketAddress,
              abi: MARKET_ABI,
              functionName: 'stakes',
              args: [userAddress, 0], // YES
            }),
            publicClient.readContract({
              address: marketAddress,
              abi: MARKET_ABI,
              functionName: 'stakes',
              args: [userAddress, 1], // NO
            }),
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
              functionName: 'state',
            }),
            publicClient.readContract({
              address: marketAddress,
              abi: MARKET_ABI,
              functionName: 'endsAt',
            }),
            publicClient.readContract({
              address: marketAddress,
              abi: MARKET_ABI,
              functionName: 'metadata',
            }),
          ])

          const yesStakeFormatted = formatUsdc(yesStake as bigint)
          const noStakeFormatted = formatUsdc(noStake as bigint)

          // Skip if user has no stake in this market
          if (yesStakeFormatted === 0 && noStakeFormatted === 0) {
            return null
          }

          const yesPoolFormatted = formatUsdc(yesPool as bigint)
          const noPoolFormatted = formatUsdc(noPool as bigint)
          const totalPool = yesPoolFormatted + noPoolFormatted
          const currentOdds = totalPool > 0 ? (yesPoolFormatted / totalPool) * 100 : 50

          const side = yesStakeFormatted > 0 ? 'YES' : 'NO'
          const stakeAmount = side === 'YES' ? yesStakeFormatted : noStakeFormatted
          const marketState = Number(state)
          const isResolved = marketState === MARKET_STATE.RESOLVED

          // Get market metadata
          const metadataResult = metadata as any
          const question = metadataResult[0] || `Market ${marketAddress.slice(0, 8)}...`
          const category = metadataResult[1] || 'Unknown'

          let potentialPayout = 0
          let outcome: 'WIN' | 'LOSS' | undefined
          let actualPayout: number | undefined

          if (isResolved) {
            // Check if user can claim (meaning they won)
            try {
              const canClaim = await publicClient.readContract({
                address: marketAddress,
                abi: MARKET_ABI,
                functionName: 'canClaim',
                args: [userAddress],
              }) as boolean

              if (canClaim) {
                outcome = 'WIN'
                const payout = await publicClient.readContract({
                  address: marketAddress,
                  abi: MARKET_ABI,
                  functionName: 'getPotentialPayout',
                  args: [userAddress],
                }) as bigint
                actualPayout = formatUsdc(payout)
                potentialPayout = actualPayout
              } else {
                outcome = 'LOSS'
                actualPayout = 0
                potentialPayout = 0
              }
            } catch (err) {
              outcome = 'LOSS'
              actualPayout = 0
            }
          } else {
            // Calculate potential payout for active positions
            try {
              const payout = await publicClient.readContract({
                address: marketAddress,
                abi: MARKET_ABI,
                functionName: 'getPotentialPayout',
                args: [userAddress],
              }) as bigint
              potentialPayout = formatUsdc(payout)
            } catch (err) {
              // Estimate if contract call fails
              const winningPool = side === 'YES' ? yesPoolFormatted : noPoolFormatted
              const userShare = stakeAmount / winningPool
              potentialPayout = totalPool * userShare * 0.98 // Assume 2% fee
            }
          }

          // Get timestamp from Staked event (or use current time as fallback)
          const currentBlock = await publicClient.getBlockNumber()
          const fromBlock = currentBlock - BigInt(100000)
          
          let timestamp = Date.now()
          try {
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
              args: {
                user: userAddress,
              },
              fromBlock,
              toBlock: 'latest',
            })

            if (logs.length > 0) {
              const firstLog = logs[0]
              const block = await publicClient.getBlock({ blockNumber: firstLog.blockNumber })
              timestamp = Number(block.timestamp) * 1000
            }
          } catch (err) {
            console.log('Could not fetch stake timestamp:', err)
          }

          return {
            marketAddress,
            marketTitle: question,
            side,
            stakeAmount,
            currentOdds,
            potentialPayout,
            isResolved,
            outcome,
            actualPayout,
            timestamp,
            category,
            endsAt: Number(endsAt),
            state: marketState,
          } as UserPosition
        } catch (err) {
          console.error(`Error fetching position for market ${marketAddress}:`, err)
          return null
        }
      })

      const results = await Promise.all(positionPromises)
      const validPositions = results.filter((p): p is UserPosition => p !== null)
      
      // Sort by timestamp (newest first)
      validPositions.sort((a, b) => b.timestamp - a.timestamp)

      setPositions(validPositions)
    } catch (err) {
      console.error('Error fetching user positions:', err)
      setError('Failed to load positions')
    } finally {
      setIsLoading(false)
    }
  }, [publicClient, userAddress])

  useEffect(() => {
    fetchUserPositions()
  }, [fetchUserPositions])

  // Refetch every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchUserPositions, 30000)
    return () => clearInterval(interval)
  }, [fetchUserPositions])

  return {
    positions,
    isLoading,
    error,
    refetch: fetchUserPositions,
  }
}

/**
 * Generate mock positions for testing
 */
export function generateMockPositions(): UserPosition[] {
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000

  return [
    // Winning positions
    {
      marketAddress: '0x1234567890123456789012345678901234567890' as Address,
      marketTitle: 'Will Bitcoin reach $100k by end of 2024?',
      side: 'YES',
      stakeAmount: 100,
      currentOdds: 65,
      potentialPayout: 153.85,
      isResolved: true,
      outcome: 'WIN',
      actualPayout: 153.85,
      timestamp: now - 30 * dayMs,
      category: 'Crypto',
      endsAt: Math.floor((now - 15 * dayMs) / 1000),
      state: MARKET_STATE.RESOLVED,
    },
    {
      marketAddress: '0x2345678901234567890123456789012345678901' as Address,
      marketTitle: 'Will Ethereum ETF be approved in 2024?',
      side: 'YES',
      stakeAmount: 50,
      currentOdds: 72,
      potentialPayout: 69.44,
      isResolved: true,
      outcome: 'WIN',
      actualPayout: 69.44,
      timestamp: now - 45 * dayMs,
      category: 'Crypto',
      endsAt: Math.floor((now - 20 * dayMs) / 1000),
      state: MARKET_STATE.RESOLVED,
    },
    // Losing positions
    {
      marketAddress: '0x3456789012345678901234567890123456789012' as Address,
      marketTitle: 'Will stock market crash by Q4 2024?',
      side: 'YES',
      stakeAmount: 75,
      currentOdds: 25,
      potentialPayout: 0,
      isResolved: true,
      outcome: 'LOSS',
      actualPayout: 0,
      timestamp: now - 60 * dayMs,
      category: 'Economy',
      endsAt: Math.floor((now - 10 * dayMs) / 1000),
      state: MARKET_STATE.RESOLVED,
    },
    // Active positions
    {
      marketAddress: '0x4567890123456789012345678901234567890123' as Address,
      marketTitle: 'Will AI surpass human intelligence by 2025?',
      side: 'NO',
      stakeAmount: 120,
      currentOdds: 45,
      potentialPayout: 240,
      isResolved: false,
      timestamp: now - 5 * dayMs,
      category: 'Technology',
      endsAt: Math.floor((now + 30 * dayMs) / 1000),
      state: MARKET_STATE.ACTIVE,
    },
    {
      marketAddress: '0x5678901234567890123456789012345678901234' as Address,
      marketTitle: 'Will Tesla stock hit $300 in 2025?',
      side: 'YES',
      stakeAmount: 80,
      currentOdds: 58,
      potentialPayout: 137.93,
      isResolved: false,
      timestamp: now - 3 * dayMs,
      category: 'Stocks',
      endsAt: Math.floor((now + 60 * dayMs) / 1000),
      state: MARKET_STATE.ACTIVE,
    },
    {
      marketAddress: '0x6789012345678901234567890123456789012345' as Address,
      marketTitle: 'Will there be a major crypto regulation in 2025?',
      side: 'YES',
      stakeAmount: 150,
      currentOdds: 68,
      potentialPayout: 220.59,
      isResolved: false,
      timestamp: now - 2 * dayMs,
      category: 'Crypto',
      endsAt: Math.floor((now + 90 * dayMs) / 1000),
      state: MARKET_STATE.ACTIVE,
    },
  ]
}