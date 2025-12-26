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

