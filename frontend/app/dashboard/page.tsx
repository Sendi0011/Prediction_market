"use client"

import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { usePrivy } from "@privy-io/react-auth"
import { useRouter } from "next/navigation"
import { Wallet, TrendingUp, Award, Clock, Copy, Loader2 } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import { usePublicClient } from 'wagmi'
import { baseSepolia } from 'viem/chains'
import { USDC_ADDRESS, USDC_ABI, MARKET_ABI } from '@/lib/contracts'
import { formatUsdc } from '@/lib/web3-utils'
import { useFactory } from '@/hooks/use-factory'
import { useMarket } from '@/hooks/use-market'
import { AddFundsModal } from "@/components/AddFundsModal"
import { toast } from 'sonner'
import type { Address } from 'viem'

interface UserPosition {
  marketAddress: Address
  yesStake: number
  noStake: number
  totalStake: number
  side: number
  canClaim: boolean
  potentialPayout: number
}

export default function DashboardPage() {
  const { user, logout } = usePrivy()
  const router = useRouter()
  const publicClient = usePublicClient({ chainId: baseSepolia.id })
  const { getAllMarkets } = useFactory()

  const [usdcBalance, setUsdcBalance] = useState<number>(0)
  const [userPositions, setUserPositions] = useState<UserPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddFundsModalOpen, setIsAddFundsModalOpen] = useState(false)

  const address = user?.wallet?.address as Address | undefined

  // Fetch USDC balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (!address || !publicClient) return

      try {
        const balance = await publicClient.readContract({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: 'balanceOf',
          args: [address],
        })
        setUsdcBalance(formatUsdc(balance as bigint))
      } catch (error) {
        console.error('Error fetching USDC balance:', error)
      }
    }

    fetchBalance()
    const interval = setInterval(fetchBalance, 10000) // Refresh every 10s
    return () => clearInterval(interval)
  }, [address, publicClient])

  // Fetch user positions
  useEffect(() => {
    const fetchPositions = async () => {
      if (!address || !publicClient) return

      setLoading(true)
      try {
        const markets = await getAllMarkets(0, 50)
        
        const positionsPromises = markets.map(async (marketAddress) => {
          try {
            const [yesStake, noStake, canClaimResult, potentialPayout] = await Promise.all([
              publicClient.readContract({
                address: marketAddress,
                abi: MARKET_ABI,
                functionName: 'stakes',
                args: [address, 0], // YES
              }),
              publicClient.readContract({
                address: marketAddress,
                abi: MARKET_ABI,
                functionName: 'stakes',
                args: [address, 1], // NO
              }),
              publicClient.readContract({
                address: marketAddress,
                abi: MARKET_ABI,
                functionName: 'canClaim',
                args: [address],
              }),
              publicClient.readContract({
                address: marketAddress,
                abi: MARKET_ABI,
                functionName: 'getPotentialPayout',
                args: [address],
              }),
            ])

            const yesStakeFormatted = formatUsdc(yesStake as bigint)
            const noStakeFormatted = formatUsdc(noStake as bigint)
            const totalStake = yesStakeFormatted + noStakeFormatted

            if (totalStake === 0) return null

            const side = yesStakeFormatted > 0 ? 0 : 1

            return {
              marketAddress,
              yesStake: yesStakeFormatted,
              noStake: noStakeFormatted,
              totalStake,
              side,
              canClaim: canClaimResult as boolean,
              potentialPayout: formatUsdc(potentialPayout as bigint),
            }
          } catch (error) {
            console.error(`Error fetching position for ${marketAddress}:`, error)
            return null
          }
        })

        const positions = await Promise.all(positionsPromises)
        const validPositions = positions.filter((p): p is UserPosition => p !== null)
        setUserPositions(validPositions)
      } catch (error) {
        console.error('Error fetching positions:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPositions()
  }, [address, publicClient, getAllMarkets])

  useEffect(() => {
    if (!user) {
      router.push("/")
    }
  }, [user, router])

  if (!user) return null

  const totalStaked = userPositions.reduce((sum, p) => sum + p.totalStake, 0)
  const totalPotentialEarnings = userPositions.reduce((sum, p) => sum + p.potentialPayout, 0)
  const activePositions = userPositions.filter(p => !p.canClaim).length
  const claimablePositions = userPositions.filter(p => p.canClaim)

  const handleClaim = async (marketAddress: Address) => {
    try {
      const { claim, isLoading } = useMarket(marketAddress)
      await claim()
      toast.success('Claimed successfully!')
      // Refresh positions
      window.location.reload()
    } catch (error: any) {
      toast.error(error?.message || 'Claim failed')
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-12">
        {/* Dashboard Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {user?.email?.address || "Forecaster"}
            </p>
          </div>
          <Button
            onClick={() => logout()}
            variant="outline"
            className="border-border text-foreground hover:bg-muted"
          >
            Logout
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6 border border-border bg-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Wallet Balance</p>
                <p className="text-2xl font-bold text-foreground">
                  {usdcBalance.toFixed(2)} USDC
                </p>
              </div>
              <Wallet className="h-8 w-8 text-accent" />
            </div>
          </Card>
          <Card className="p-6 border border-border bg-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Active Predictions</p>
                <p className="text-2xl font-bold text-foreground">{activePositions}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
          </Card>
          <Card className="p-6 border border-border bg-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Staked</p>
                <p className="text-2xl font-bold text-foreground">{totalStaked.toFixed(2)} USDC</p>
              </div>
              <Award className="h-8 w-8 text-accent" />
            </div>
          </Card>
          <Card className="p-6 border border-border bg-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Potential Earnings</p>
                <p className="text-2xl font-bold text-green-500">+{totalPotentialEarnings.toFixed(2)} USDC</p>
              </div>
              <Clock className="h-8 w-8 text-secondary" />
            </div>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Active Predictions */}
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-4">Your Positions</h2>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : userPositions.length === 0 ? (
                <Card className="p-12 border border-border bg-card text-center">
                  <p className="text-muted-foreground mb-4">You don't have any active positions yet</p>
                  <Button asChild>
                    <Link href="/markets">Explore Markets</Link>
                  </Button>
                </Card>
              ) : (
                <div className="space-y-4">
                  {userPositions.map((position) => (
                    <Card
                      key={position.marketAddress}
                      className="p-6 border border-border bg-card hover:border-primary transition"
                    >
                      <div className="mb-4">
                        <h3 className="font-semibold text-foreground mb-2">
                          Market: {position.marketAddress.slice(0, 6)}...{position.marketAddress.slice(-4)}
                        </h3>
                        <Badge variant={position.side === 0 ? 'default' : 'secondary'}>
                          Predicted {position.side === 0 ? 'YES' : 'NO'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-4 mb-4 text-sm">
                        <div>
                          <p className="text-muted-foreground mb-1">Your Stake</p>
                          <p className="font-semibold text-foreground">
                            {position.totalStake.toFixed(2)} USDC
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">Potential Payout</p>
                          <p className="font-semibold text-green-500">
                            {position.potentialPayout.toFixed(2)} USDC
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">Status</p>
                          <p className="font-semibold text-foreground">
                            {position.canClaim ? 'Claimable' : 'Active'}
                          </p>
                        </div>
                        <div className="text-right">
                          {position.canClaim ? (
                            <Button
                              size="sm"
                              onClick={() => handleClaim(position.marketAddress)}
                              className="bg-accent hover:bg-accent/90 text-accent-foreground"
                            >
                              Claim
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                            >
                              <Link href={`/markets/${position.marketAddress}`}>View</Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Wallet Section */}
            <Card className="p-6 border border-border bg-card">
              <h3 className="font-bold text-foreground mb-4">Wallet</h3>
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-1">Connected Wallet</p>
                {address && (
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-sm text-foreground truncate mr-2">
                      {address.slice(0, 6)}...{address.slice(-4)}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(address)
                        toast.success('Address copied!')
                      }}
                      className="px-2"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-1">Available Balance</p>
                <p className="text-2xl font-bold text-foreground">{usdcBalance.toFixed(2)} USDC</p>
              </div>

              <Button
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mb-2"
                onClick={() => setIsAddFundsModalOpen(true)}
              >
                Add Funds
              </Button>
              <Button
                variant="outline"
                className="w-full border-border text-foreground hover:bg-muted bg-transparent"
                onClick={() => toast.info('Withdraw feature coming soon')}
              >
                Withdraw
              </Button>
            </Card>

            {/* Quick Actions */}
            <Card className="p-6 border border-border bg-card">
              <h3 className="font-bold text-foreground mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/markets">Browse Markets</Link>
                </Button>
                <Button variant="outline" className="w-full" onClick={() => window.location.reload()}>
                  Refresh Data
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </main>

      {address && (
        <AddFundsModal
          address={address}
          isOpen={isAddFundsModalOpen}
          onClose={() => setIsAddFundsModalOpen(false)}
        />
      )}
    </div>
  )
}
