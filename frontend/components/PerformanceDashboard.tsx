"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Trophy,
  Target,
  DollarSign,
  Percent,
  Award,
  Activity,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface Position {
  marketAddress: string;
  marketTitle: string;
  side: 'YES' | 'NO';
  stakeAmount: number;
  currentOdds: number;
  potentialPayout: number;
  isResolved: boolean;
  outcome?: 'WIN' | 'LOSS';
  actualPayout?: number;
  timestamp: number;
}

interface PerformanceStats {
  totalStaked: number;
  totalWon: number;
  totalLost: number;
  netProfit: number;
  winRate: number;
  totalTrades: number;
  wins: number;
  losses: number;
  activeTrades: number;
  averageROI: number;
  bestTrade: Position | null;
  worstTrade: Position | null;
}

interface PerformanceDashboardProps {
  userAddress: string;
  positions: Position[];
}

export function PerformanceDashboard({ userAddress, positions }: PerformanceDashboardProps) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  // Calculate performance statistics
  const stats = useMemo((): PerformanceStats => {
    const resolvedPositions = positions.filter(p => p.isResolved);
    const activePositions = positions.filter(p => !p.isResolved);
    
    const wins = resolvedPositions.filter(p => p.outcome === 'WIN');
    const losses = resolvedPositions.filter(p => p.outcome === 'LOSS');
    
    const totalWon = wins.reduce((sum, p) => sum + (p.actualPayout || 0), 0);
    const totalLost = losses.reduce((sum, p) => sum + p.stakeAmount, 0);
    const totalStaked = resolvedPositions.reduce((sum, p) => sum + p.stakeAmount, 0);
    
    const netProfit = totalWon - totalStaked;
    const winRate = resolvedPositions.length > 0 ? (wins.length / resolvedPositions.length) * 100 : 0;
    
    // Calculate average ROI
    const avgROI = wins.length > 0
      ? wins.reduce((sum, p) => sum + ((p.actualPayout! - p.stakeAmount) / p.stakeAmount * 100), 0) / wins.length
      : 0;

    // Find best and worst trades
    const bestTrade = wins.length > 0
      ? wins.reduce((best, p) => {
          const roi = ((p.actualPayout! - p.stakeAmount) / p.stakeAmount) * 100;
          const bestRoi = best ? ((best.actualPayout! - best.stakeAmount) / best.stakeAmount) * 100 : 0;
          return roi > bestRoi ? p : best;
        }, wins[0])
      : null;

    const worstTrade = losses.length > 0 ? losses[0] : null;

    return {
      totalStaked,
      totalWon,
      totalLost,
      netProfit,
      winRate,
      totalTrades: resolvedPositions.length,
      wins: wins.length,
      losses: losses.length,
      activeTrades: activePositions.length,
      averageROI: avgROI,
      bestTrade,
      worstTrade,
    };
  }, [positions]);

  // Prepare chart data - Profit/Loss over time
  const profitOverTime = useMemo(() => {
    const sortedPositions = [...positions]
      .filter(p => p.isResolved)
      .sort((a, b) => a.timestamp - b.timestamp);

    let runningProfit = 0;
    return sortedPositions.map(position => {
      const profit = position.outcome === 'WIN' 
        ? (position.actualPayout! - position.stakeAmount)
        : -position.stakeAmount;
      
      runningProfit += profit;
      
      return {
        date: new Date(position.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        profit: runningProfit,
        trade: position.marketTitle?.slice(0, 30) + '...',
      };
    });
  }, [positions]);

  // Win/Loss distribution by category
  const categoryPerformance = useMemo(() => {
    const categories = new Map<string, { wins: number; losses: number; profit: number }>();
    
    positions.filter(p => p.isResolved).forEach(position => {
      // You'd get this from market metadata - using placeholder for now
      const category = 'Crypto'; // TODO: Get from market
      const current = categories.get(category) || { wins: 0, losses: 0, profit: 0 };
      
      if (position.outcome === 'WIN') {
        current.wins++;
        current.profit += (position.actualPayout! - position.stakeAmount);
      } else {
        current.losses++;
        current.profit -= position.stakeAmount;
      }
      
      categories.set(category, current);
    });

    return Array.from(categories.entries()).map(([category, data]) => ({
      category,
      wins: data.wins,
      losses: data.losses,
      winRate: ((data.wins / (data.wins + data.losses)) * 100).toFixed(1),
      profit: data.profit,
    }));
  }, [positions]);

  // Portfolio value over time
  const portfolioValue = useMemo(() => {
    const activePositions = positions.filter(p => !p.isResolved);
    const totalStaked = activePositions.reduce((sum, p) => sum + p.stakeAmount, 0);
    const totalPotential = activePositions.reduce((sum, p) => sum + p.potentialPayout, 0);
    
    return {
      invested: totalStaked,
      potential: totalPotential,
      unrealizedPL: totalPotential - totalStaked,
    };
  }, [positions]);

  // Monthly performance
  const monthlyStats = useMemo(() => {
    const months = new Map<string, { profit: number; trades: number }>();
    
    positions.filter(p => p.isResolved).forEach(position => {
      const month = new Date(position.timestamp).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const current = months.get(month) || { profit: 0, trades: 0 };
      
      const profit = position.outcome === 'WIN' 
        ? (position.actualPayout! - position.stakeAmount)
        : -position.stakeAmount;
      
      current.profit += profit;
      current.trades++;
      
      months.set(month, current);
    });

    return Array.from(months.entries()).map(([month, data]) => ({
      month,
      profit: data.profit,
      trades: data.trades,
      avgProfit: data.profit / data.trades,
    }));
  }, [positions]);

  const COLORS = {
    win: '#10b981',
    loss: '#ef4444',
    active: '#3b82f6',
    profit: '#10b981',
    loss2: '#ef4444',
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={stats.netProfit >= 0 ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Net Profit/Loss</span>
              {stats.netProfit >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </div>
            <div className={`text-2xl font-bold ${stats.netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {stats.netProfit >= 0 ? '+' : ''}{stats.netProfit.toFixed(2)} USDC
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {((stats.netProfit / (stats.totalStaked || 1)) * 100).toFixed(1)}% ROI
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Win Rate</span>
              <Target className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{stats.winRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.wins}W / {stats.losses}L / {stats.activeTrades} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Total Trades</span>
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{stats.totalTrades}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalStaked.toFixed(0)} USDC staked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Avg ROI</span>
              <Percent className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{stats.averageROI.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Per winning trade
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Profit/Loss Over Time */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Profit/Loss Over Time
                </CardTitle>
                <CardDescription>Your cumulative performance</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={profitOverTime}>
                    <defs>
                      <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.profit} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={COLORS.profit} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      dataKey="date" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="profit"
                      stroke={COLORS.profit}
                      strokeWidth={2}
                      fill="url(#profitGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Win/Loss Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Win/Loss Distribution
                </CardTitle>
                <CardDescription>Overall performance breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center mb-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Wins', value: stats.wins, color: COLORS.win },
                          { name: 'Losses', value: stats.losses, color: COLORS.loss },
                          { name: 'Active', value: stats.activeTrades, color: COLORS.active },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {[
                          { name: 'Wins', value: stats.wins, color: COLORS.win },
                          { name: 'Losses', value: stats.losses, color: COLORS.loss },
                          { name: 'Active', value: stats.activeTrades, color: COLORS.active },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="font-bold text-green-600 dark:text-green-400">{stats.wins}</div>
                    <div className="text-xs text-muted-foreground">Wins</div>
                  </div>
                  <div>
                    <div className="font-bold text-red-600 dark:text-red-400">{stats.losses}</div>
                    <div className="text-xs text-muted-foreground">Losses</div>
                  </div>
                  <div>
                    <div className="font-bold text-blue-600 dark:text-blue-400">{stats.activeTrades}</div>
                    <div className="text-xs text-muted-foreground">Active</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Monthly Performance
              </CardTitle>
              <CardDescription>Track your progress month by month</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="month" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="profit" fill={COLORS.profit} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          {/* Best & Worst Trades */}
          <div className="grid lg:grid-cols-2 gap-4">
            {stats.bestTrade && (
              <Card className="border-green-500/30 bg-green-500/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Award className="h-5 w-5 text-green-500" />
                    Best Trade
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium truncate">{stats.bestTrade.marketTitle}</p>
                    <Badge variant="default" className="mt-1">{stats.bestTrade.side}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Staked</span>
                      <p className="font-semibold">${stats.bestTrade.stakeAmount.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Won</span>
                      <p className="font-semibold text-green-600 dark:text-green-400">
                        ${stats.bestTrade.actualPayout?.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <span className="text-xs text-muted-foreground">ROI</span>
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">
                      +{(((stats.bestTrade.actualPayout! - stats.bestTrade.stakeAmount) / stats.bestTrade.stakeAmount) * 100).toFixed(1)}%
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {stats.worstTrade && (
              <Card className="border-red-500/30 bg-red-500/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ArrowDownRight className="h-5 w-5 text-red-500" />
                    Biggest Loss
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium truncate">{stats.worstTrade.marketTitle}</p>
                    <Badge variant="secondary" className="mt-1">{stats.worstTrade.side}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Staked</span>
                      <p className="font-semibold">${stats.worstTrade.stakeAmount.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Lost</span>
                      <p className="font-semibold text-red-600 dark:text-red-400">
                        ${stats.worstTrade.stakeAmount.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <span className="text-xs text-muted-foreground">ROI</span>
                    <p className="text-xl font-bold text-red-600 dark:text-red-400">-100%</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Performance by Category */}
          {categoryPerformance.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Performance by Category</CardTitle>
                <CardDescription>See which market types you excel at</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {categoryPerformance.map((cat) => (
                    <div key={cat.category} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{cat.category}</span>
                          <Badge variant="secondary">{cat.winRate}% WR</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {cat.wins} wins • {cat.losses} losses
                        </div>
                      </div>
                      <div className={`text-lg font-bold ${cat.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {cat.profit >= 0 ? '+' : ''}{cat.profit.toFixed(0)} USDC
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Portfolio Tab */}
        <TabsContent value="portfolio" className="space-y-4">
          <div className="grid lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Total Invested</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${portfolioValue.invested.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across {stats.activeTrades} active positions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Potential Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  ${portfolioValue.potential.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  If all positions win
                </p>
              </CardContent>
            </Card>

            <Card className={portfolioValue.unrealizedPL >= 0 ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}>
              <CardHeader>
                <CardTitle className="text-sm">Unrealized P/L</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${portfolioValue.unrealizedPL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {portfolioValue.unrealizedPL >= 0 ? '+' : ''}${portfolioValue.unrealizedPL.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {((portfolioValue.unrealizedPL / (portfolioValue.invested || 1)) * 100).toFixed(1)}% potential return
                </p>
              </CardContent>
            </Card>
          </div>

          {/* What-if Scenarios */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5" />
                "What If" Scenarios
              </CardTitle>
              <CardDescription>Explore potential outcomes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowUpRight className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Best Case</span>
                  </div>
                  <div className="text-xl font-bold text-green-600 dark:text-green-400">
                    +${portfolioValue.potential.toFixed(0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">All positions win</p>
                </div>

                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium">Expected</span>
                  </div>
                  <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
                    +${(portfolioValue.potential * (stats.winRate / 100)).toFixed(0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Based on {stats.winRate.toFixed(0)}% win rate</p>
                </div>

                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowDownRight className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium">Worst Case</span>
                  </div>
                  <div className="text-xl font-bold text-red-600 dark:text-red-400">
                    -${portfolioValue.invested.toFixed(0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">All positions lose</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Trading Insights</CardTitle>
              <CardDescription>AI-powered analysis of your performance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats.winRate > 60 && (
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                  <div className="flex items-start gap-3">
                    <Trophy className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-green-600 dark:text-green-400 mb-1">Strong Performance</h4>
                      <p className="text-sm text-muted-foreground">
                        Your {stats.winRate.toFixed(0)}% win rate is excellent! You're consistently making profitable predictions.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {stats.averageROI > 50 && (
                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <div className="flex items-start gap-3">
                    <DollarSign className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-blue-600 dark:text-blue-400 mb-1">High ROI Strategy</h4>
                      <p className="text-sm text-muted-foreground">
                        Your average {stats.averageROI.toFixed(0)}% ROI per winning trade shows you're finding high-value opportunities.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {stats.totalTrades < 10 && (
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-start gap-3">
                    <Activity className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-amber-600 dark:text-amber-400 mb-1">Build Your Track Record</h4>
                      <p className="text-sm text-muted-foreground">
                        You've completed {stats.totalTrades} trades. Make more predictions to build a reliable performance history.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {stats.activeTrades > 5 && (
                <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
                  <div className="flex items-start gap-3">
                    <Target className="h-5 w-5 text-purple-500 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-purple-600 dark:text-purple-400 mb-1">Active Portfolio</h4>
                      <p className="text-sm text-muted-foreground">
                        You have {stats.activeTrades} open positions. Consider your risk exposure and diversification.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {stats.netProfit < 0 && stats.totalTrades > 5 && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                  <div className="flex items-start gap-3">
                    <TrendingDown className="h-5 w-5 text-red-500 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-red-600 dark:text-red-400 mb-1">Room for Improvement</h4>
                      <p className="text-sm text-muted-foreground">
                        Your net P/L is negative. Review your best performing trades and try to identify patterns in your successful predictions.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Achievement Badges */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="h-5 w-5" />
                Achievements
              </CardTitle>
              <CardDescription>Milestones you've unlocked</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {stats.totalTrades >= 10 && (
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <div className="text-2xl mb-1">🎯</div>
                    <div className="text-xs font-medium">First 10 Trades</div>
                  </div>
                )}
                {stats.wins >= 5 && (
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <div className="text-2xl mb-1">🏆</div>
                    <div className="text-xs font-medium">5 Wins</div>
                  </div>
                )}
                {stats.winRate >= 60 && stats.totalTrades >= 10 && (
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <div className="text-2xl mb-1">⭐</div>
                    <div className="text-xs font-medium">60%+ Win Rate</div>
                  </div>
                )}
                {stats.netProfit >= 100 && (
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <div className="text-2xl mb-1">💰</div>
                    <div className="text-xs font-medium">$100+ Profit</div>
                  </div>
                )}
                {stats.averageROI >= 50 && stats.wins >= 5 && (
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <div className="text-2xl mb-1">📈</div>
                    <div className="text-xs font-medium">50%+ Avg ROI</div>
                  </div>
                )}
                {stats.totalTrades >= 50 && (
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <div className="text-2xl mb-1">🔥</div>
                    <div className="text-xs font-medium">50 Trades</div>
                  </div>
                )}
                {stats.bestTrade && ((stats.bestTrade.actualPayout! - stats.bestTrade.stakeAmount) / stats.bestTrade.stakeAmount) >= 2 && (
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <div className="text-2xl mb-1">💎</div>
                    <div className="text-xs font-medium">200%+ ROI Trade</div>
                  </div>
                )}
                {stats.winRate >= 70 && stats.totalTrades >= 20 && (
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <div className="text-2xl mb-1">👑</div>
                    <div className="text-xs font-medium">Elite Trader</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Trading Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Trading Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-3 text-sm">
                <span className="text-primary">💡</span>
                <p>Diversify across multiple markets to reduce risk exposure.</p>
              </div>
              <div className="flex gap-3 text-sm">
                <span className="text-primary">💡</span>
                <p>Markets with high volume tend to have more accurate odds.</p>
              </div>
              <div className="flex gap-3 text-sm">
                <span className="text-primary">💡</span>
                <p>Set alerts to catch favorable odds changes in your positions.</p>
              </div>
              <div className="flex gap-3 text-sm">
                <span className="text-primary">💡</span>
                <p>Review your worst trades to identify and avoid common mistakes.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}