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

  
}