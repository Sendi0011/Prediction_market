"use client"

import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { OddsCalculator } from "@/components/OddsCalculator"
import { usePrivy } from "@privy-io/react-auth"
import { useRouter, useParams } from "next/navigation"
import { useState, useEffect } from "react"
import { ArrowLeft, TrendingUp, Clock, Loader2 } from "lucide-react"
import Link from "next/link"
import { useMarket } from "@/hooks/use-market"
import { useOracle } from "@/hooks/use-oracle"
import { usePublicClient } from 'wagmi'
import { baseSepolia } from 'viem/chains'
import { USDC_ADDRESS, USDC_ABI } from '@/lib/contracts'
import { formatUsdc } from '@/lib/web3-utils'
import { toast } from 'sonner'
import type { Address } from 'viem'

export default function MarketDetailPage() {
  const { user, login } = usePrivy()
  const router = useRouter()
  const params = useParams()
  const marketAddress = params.id as Address
  const publicClient = usePublicClient({ chainId: baseSepolia.id })

  const { getMarketInfo, getUserStake, stake, isLoading: isStaking } = useMarket(marketAddress)
  const { getResolution, isResolutionFinalized } = useOracle()

  const [selectedSide, setSelectedSide] = useState<"yes" | "no" | null>(null)
  const [amount, setAmount] = useState("")
  const [usdcBalance, setUsdcBalance] = useState<number>(0)
  const [marketInfo, setMarketInfo] = useState<any>(null)
  const [userStake, setUserStake] = useState<any>(null)
  const [isResolved, setIsResolved] = useState(false)
  const [loading, setLoading] = useState(true)

  // Fetch USDC balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (!user?.wallet?.address || !publicClient) return

      try {
        const balance = await publicClient.readContract({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: 'balanceOf',
          args: [user.wallet.address as Address],
        })
        setUsdcBalance(formatUsdc(balance as bigint))
      } catch (error) {
        console.error('Error fetching USDC balance:', error)
      }
    }

    fetchBalance()
  }, [user?.wallet?.address, publicClient])

  // Fetch market data
  useEffect(() => {
    const fetchMarketData = async () => {
      setLoading(true)
      try {
        const [info, resolution] = await Promise.all([
          getMarketInfo(),
          getResolution(marketAddress),
        ])

        setMarketInfo(info)
        setIsResolved(resolution !== null && resolution !== 255)

        if (user?.wallet?.address) {
          const stake = await getUserStake(user.wallet.address as Address)
          setUserStake(stake)
        }
      } catch (error) {
        console.error('Error fetching market data:', error)
        toast.error('Failed to load market data')
      } finally {
        setLoading(false)
      }
    }

    if (marketAddress) {
      fetchMarketData()
    }
  }, [marketAddress, user?.wallet?.address, getMarketInfo, getUserStake, getResolution])

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl font-bold mb-4 text-foreground">Sign in to view this market</h2>
          <Button onClick={login} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            Login with Privy
          </Button>
        </main>
      </div>
    )
  }

  if (loading || !marketInfo) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    )
  }

  const handleStake = async () => {
    if (!selectedSide || !amount || !user?.wallet?.address) return

    const amountNum = parseFloat(amount)
    if (amountNum <= 0 || amountNum > usdcBalance) {
      toast.error('Invalid amount')
      return
    }

    try {
      await stake(selectedSide, amountNum)
      toast.success('Stake placed successfully!')
      
      // Refresh data
      const [info, userStakeData] = await Promise.all([
        getMarketInfo(),
        getUserStake(user.wallet.address as Address),
      ])
      setMarketInfo(info)
      setUserStake(userStakeData)
      setAmount("")
      setSelectedSide(null)
    } catch (error: any) {
      console.error('Staking error:', error)
      toast.error(error?.message || 'Failed to place stake')
    }
  }

  const daysLeft = Math.ceil((marketInfo.endsAt * 1000 - Date.now()) / (24 * 60 * 60 * 1000))
  const marketState = ['Pending', 'Active', 'Closed', 'Resolved', 'Cancelled'][marketInfo.state]

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <Button variant="ghost" className="mb-6 text-muted-foreground hover:text-foreground" asChild>
          <Link href="/markets" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Markets
          </Link>
        </Button>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-8 border border-border bg-card">
              <div className="mb-4 flex items-center gap-2">
                <Badge variant="secondary">Market</Badge>
                <Badge variant={marketInfo.state === 1 ? 'default' : 'outline'}>
                  {marketState}
                </Badge>
              </div>
              <h1 className="text-3xl font-bold text-foreground mb-4">Market: {marketAddress.slice(0, 10)}...</h1>
              
              <div className="p-6 rounded-lg bg-muted/50 mb-6">
                <h3 className="font-semibold text-foreground mb-4">Current Probability</h3>
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-foreground">Market Prediction</span>
                    <span className="text-sm text-muted-foreground">{(100 - marketInfo.yesProbability).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-border rounded-full h-3">
                    <div
                      className="h-3 rounded-full bg-gradient-to-r from-primary to-accent transition-all"
                      style={{ width: `${marketInfo.yesProbability}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center mt-3 text-sm font-medium">
                    <span className="text-primary">YES {marketInfo.yesProbability.toFixed(1)}%</span>
                    <span className="text-secondary">NO {(100 - marketInfo.yesProbability).toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {userStake && userStake.totalStake > 0 && (
                <div className="p-4 rounded-lg bg-accent/10 border border-accent/20 mb-6">
                  <h4 className="font-semibold text-foreground mb-2">Your Position</h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Staked</span>
                    <span className="font-medium text-foreground">{userStake.totalStake.toFixed(2)} USDC</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Side</span>
                    <Badge variant={userStake.side === 0 ? 'default' : 'secondary'}>
                      {userStake.side === 0 ? 'YES' : 'NO'}
                    </Badge>
                  </div>
                </div>
              )}
            </Card>

            <div className="grid grid-cols-3 gap-4">
              <Card className="p-4 border border-border bg-card">
                <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  Total Pool
                </div>
                <div className="text-2xl font-bold text-foreground">${(marketInfo.totalPool / 1000).toFixed(1)}k</div>
              </Card>
              <Card className="p-4 border border-border bg-card">
                <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Ends In
                </div>
                <div className="text-2xl font-bold text-foreground">{daysLeft > 0 ? `${daysLeft}d` : 'Ended'}</div>
              </Card>
              <Card className="p-4 border border-border bg-card">
                <div className="text-sm text-muted-foreground mb-1">
                  Fee
                </div>
                <div className="text-2xl font-bold text-foreground">{(marketInfo.feeBP / 100).toFixed(1)}%</div>
              </Card>
            </div>
          </div>

          {/* Staking Sidebar */}
          <div className="lg:sticky lg:top-20 h-fit">
            <Card className="p-6 border border-border bg-card">
              <h2 className="text-xl font-bold text-foreground mb-6">Place Your Prediction</h2>

              {marketInfo.state !== 1 && (
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 mb-4 text-sm text-destructive">
                  This market is {marketState.toLowerCase()} and not accepting new stakes.
                </div>
              )}

              {/* Side Selection */}
              <div className="space-y-3 mb-6">
                <button
                  onClick={() => setSelectedSide("yes")}
                  disabled={marketInfo.state !== 1}
                  className={`w-full p-4 rounded-lg border-2 transition font-semibold ${
                    selectedSide === "yes"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/50 text-foreground hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  }`}
                >
                  Predict YES
                </button>
                <button
                  onClick={() => setSelectedSide("no")}
                  disabled={marketInfo.state !== 1}
                  className={`w-full p-4 rounded-lg border-2 transition font-semibold ${
                    selectedSide === "no"
                      ? "border-secondary bg-secondary/10 text-secondary"
                      : "border-border bg-muted/50 text-foreground hover:border-secondary/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  }`}
                >
                  Predict NO
                </button>
              </div>

              {/* Amount Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-foreground mb-2">Stake Amount (USDC)</label>
                <Input
                  type="number"
                  placeholder="100"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  disabled={!selectedSide || marketInfo.state !== 1}
                />
                <p className="text-xs text-muted-foreground mt-2">Available Balance: {usdcBalance.toFixed(2)} USDC</p>
              </div>

              {/* ODDS CALCULATOR - NEW FEATURE */}
              <div className="mb-6">
                <OddsCalculator
                  yesPool={marketInfo.yesPool}
                  noPool={marketInfo.noPool}
                  feeBP={marketInfo.feeBP}
                  selectedSide={selectedSide}
                  amount={amount}
                  onAmountChange={setAmount}
                />
              </div>

              {/* Stake Button */}
              <Button
                onClick={handleStake}
                disabled={!selectedSide || !amount || isStaking || Number(amount) > usdcBalance || marketInfo.state !== 1}
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold mb-3"
              >
                {isStaking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  'Confirm Prediction'
                )}
              </Button>

              {/* Terms */}
              <p className="text-xs text-muted-foreground text-center">
                By staking, you agree to the platform terms and conditions.
              </p>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}