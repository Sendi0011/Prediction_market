"use client"

import { Navbar } from "@/components/navbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PerformanceDashboard } from "@/components/PerformanceDashboard"
import { useUserPositions, generateMockPositions } from "@/hooks/use-user-positions"
import { usePrivy } from "@privy-io/react-auth"
import { useState } from "react"
import { Loader2, TrendingUp, Clock, DollarSign, Target } from "lucide-react"
import Link from "next/link"
import type { Address } from 'viem'

export default function DashboardPage() {
  const { user, login } = usePrivy()
  const { positions, isLoading, refetch } = useUserPositions(user?.wallet?.address as Address)

  // Use mock data if no real positions (for testing)
  const displayPositions = positions.length > 0 ? positions : generateMockPositions()

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl font-bold mb-4 text-foreground">Sign in to view your dashboard</h2>
          <Button onClick={login} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            Login with Privy
          </Button>
        </main>
      </div>
    )
  }

  const activePositions = displayPositions.filter(p => !p.isResolved)
  const resolvedPositions = displayPositions.filter(p => p.isResolved)

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Your Dashboard</h1>
              <p className="text-muted-foreground">
                Track your performance and manage your positions
              </p>
            </div>
            <Button onClick={refetch} variant="outline" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                'Refresh'
              )}
            </Button>
          </div>
        </div>

        {displayPositions.length === 0 && !isLoading ? (
          // Empty State
          <Card className="border-dashed">
            <CardContent className="pt-12 pb-12 text-center">
              <Target className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-xl font-semibold mb-2">No Positions Yet</h3>
              <p className="text-muted-foreground mb-6">
                Start trading on prediction markets to see your performance here
              </p>
              <Button asChild>
                <Link href="/markets">Browse Markets</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Performance Dashboard */}
            <div className="mb-8">
              <PerformanceDashboard
                userAddress={user.wallet?.address || ''}
                positions={displayPositions}
              />
            </div>

            {/* Active Positions */}
            {activePositions.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4">Active Positions</h2>
                <div className="grid gap-4">
                  {activePositions.map((position) => {
                    const daysLeft = Math.ceil((position.endsAt * 1000 - Date.now()) / (24 * 60 * 60 * 1000))
                    const unrealizedPL = position.potentialPayout - position.stakeAmount
                    const unrealizedPLPercent = (unrealizedPL / position.stakeAmount) * 100

                    return (
                      <Card key={position.marketAddress} className="hover:shadow-md transition">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <Link 
                                href={`/markets/${position.marketAddress}`}
                                className="text-lg font-semibold hover:text-primary transition"
                              >
                                {position.marketTitle}
                              </Link>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant={position.side === 'YES' ? 'default' : 'secondary'}>
                                  {position.side}
                                </Badge>
                                <Badge variant="outline">{position.category}</Badge>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-lg font-bold ${unrealizedPL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {unrealizedPL >= 0 ? '+' : ''}{unrealizedPL.toFixed(2)} USDC
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {unrealizedPLPercent >= 0 ? '+' : ''}{unrealizedPLPercent.toFixed(1)}%
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-4 gap-4 pt-4 border-t">
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Staked</div>
                              <div className="font-semibold">${position.stakeAmount.toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Current Odds</div>
                              <div className="font-semibold">{position.currentOdds.toFixed(1)}%</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Potential</div>
                              <div className="font-semibold text-blue-600 dark:text-blue-400">
                                ${position.potentialPayout.toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Closes In
                              </div>
                              <div className="font-semibold">
                                {daysLeft > 0 ? `${daysLeft}d` : 'Ended'}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Resolved Positions */}
            {resolvedPositions.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Trade History</h2>
                <div className="space-y-3">
                  {resolvedPositions.slice(0, 10).map((position) => {
                    const profit = position.outcome === 'WIN' 
                      ? (position.actualPayout! - position.stakeAmount)
                      : -position.stakeAmount
                    const roi = (profit / position.stakeAmount) * 100

                    return (
                      <Card 
                        key={position.marketAddress}
                        className={position.outcome === 'WIN' ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}
                      >
                        <CardContent className="pt-4 pb-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant={position.outcome === 'WIN' ? 'default' : 'destructive'}>
                                  {position.outcome}
                                </Badge>
                                <Badge variant={position.side === 'YES' ? 'default' : 'secondary'} className="text-xs">
                                  {position.side}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {new Date(position.timestamp).toLocaleDateString()}
                                </span>
                              </div>
                              <Link 
                                href={`/markets/${position.marketAddress}`}
                                className="text-sm font-medium hover:text-primary transition"
                              >
                                {position.marketTitle}
                              </Link>
                            </div>
                            <div className="text-right">
                              <div className={`font-bold ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {profit >= 0 ? '+' : ''}{profit.toFixed(2)} USDC
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {roi >= 0 ? '+' : ''}{roi.toFixed(1)}% ROI
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}

                  {resolvedPositions.length > 10 && (
                    <div className="text-center pt-4">
                      <Button variant="outline">
                        Load More History
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}