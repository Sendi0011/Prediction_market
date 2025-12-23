"use client"

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  ComposedChart,
  Bar,
} from 'recharts';
import { TrendingUp, TrendingDown, Activity, DollarSign } from 'lucide-react';

interface ProbabilityDataPoint {
  timestamp: number;
  yesOdds: number;
  noOdds: number;
  yesVolume?: number;
  noVolume?: number;
  totalVolume?: number;
}

interface ProbabilityChartProps {
  data: ProbabilityDataPoint[];
  marketQuestion?: string;
  currentYesOdds: number;
  currentNoOdds: number;
}

type TimeRange = '24h' | '7d' | '30d' | 'all';

export function ProbabilityChart({
  data,
  marketQuestion = "Market Probability",
  currentYesOdds,
  currentNoOdds,
}: ProbabilityChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [showVolume, setShowVolume] = useState(true);

  // Filter data based on time range
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const now = Date.now();
    let cutoffTime: number;

    switch (timeRange) {
      case '24h':
        cutoffTime = now - 24 * 60 * 60 * 1000;
        break;
      case '7d':
        cutoffTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case '30d':
        cutoffTime = now - 30 * 24 * 60 * 60 * 1000;
        break;
      case 'all':
      default:
        cutoffTime = 0;
        break;
    }

    return data.filter(d => d.timestamp >= cutoffTime);
  }, [data, timeRange]);

  // Calculate trend
  const trend = useMemo(() => {
    if (filteredData.length < 2) return { direction: 'flat', change: 0 };

    const firstPoint = filteredData[0];
    const lastPoint = filteredData[filteredData.length - 1];
    const change = lastPoint.yesOdds - firstPoint.yesOdds;

    return {
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
      change: Math.abs(change),
    };
  }, [filteredData]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (filteredData.length === 0) {
      return {
        high: currentYesOdds,
        low: currentYesOdds,
        avg: currentYesOdds,
        totalVolume: 0,
      };
    }

    const yesOddsValues = filteredData.map(d => d.yesOdds);
    const totalVolume = filteredData.reduce((sum, d) => sum + (d.totalVolume || 0), 0);

    return {
      high: Math.max(...yesOddsValues),
      low: Math.min(...yesOddsValues),
      avg: yesOddsValues.reduce((a, b) => a + b, 0) / yesOddsValues.length,
      totalVolume,
    };
  }, [filteredData, currentYesOdds]);

  // Format timestamp for display
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    if (timeRange === '24h') {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (timeRange === '7d') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    const date = new Date(data.timestamp);

    return (
      <div className="bg-card border border-border rounded-lg shadow-lg p-3">
        <p className="text-xs text-muted-foreground mb-2">
          {date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary" />
              YES
            </span>
            <span className="text-sm font-bold text-primary">{data.yesOdds.toFixed(1)}%</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-secondary" />
              NO
            </span>
            <span className="text-sm font-bold text-secondary">{data.noOdds.toFixed(1)}%</span>
          </div>
          {data.totalVolume > 0 && (
            <div className="flex items-center justify-between gap-4 pt-1 border-t border-border mt-1">
              <span className="text-xs text-muted-foreground">Volume</span>
              <span className="text-xs font-medium">${data.totalVolume.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!filteredData || filteredData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Probability History
          </CardTitle>
          <CardDescription>Market odds over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No historical data available yet</p>
              <p className="text-xs mt-1">Chart will appear as stakes are placed</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2 mb-2">
              <Activity className="h-5 w-5" />
              Probability History
            </CardTitle>
            <CardDescription className="text-xs">
              Track how market sentiment has evolved
            </CardDescription>
          </div>
          
          {/* Trend Indicator */}
          <div className="flex items-center gap-2">
            <Badge 
              variant={trend.direction === 'up' ? 'default' : trend.direction === 'down' ? 'secondary' : 'outline'}
              className="gap-1"
            >
              {trend.direction === 'up' ? (
                <TrendingUp className="h-3 w-3" />
              ) : trend.direction === 'down' ? (
                <TrendingDown className="h-3 w-3" />
              ) : null}
              {trend.direction === 'flat' ? 'Stable' : `${trend.change.toFixed(1)}%`}
            </Badge>
          </div>
        </div>

        {/* Statistics Row */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className="text-xs text-muted-foreground mb-1">Current</div>
            <div className="font-bold text-sm">{currentYesOdds.toFixed(1)}%</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className="text-xs text-muted-foreground mb-1">High</div>
            <div className="font-bold text-sm text-green-600 dark:text-green-400">{stats.high.toFixed(1)}%</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className="text-xs text-muted-foreground mb-1">Low</div>
            <div className="font-bold text-sm text-red-600 dark:text-red-400">{stats.low.toFixed(1)}%</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className="text-xs text-muted-foreground mb-1">Avg</div>
            <div className="font-bold text-sm">{stats.avg.toFixed(1)}%</div>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center justify-between mt-4">
          <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <TabsList className="h-8">
              <TabsTrigger value="24h" className="text-xs px-3 h-7">24H</TabsTrigger>
              <TabsTrigger value="7d" className="text-xs px-3 h-7">7D</TabsTrigger>
              <TabsTrigger value="30d" className="text-xs px-3 h-7">30D</TabsTrigger>
              <TabsTrigger value="all" className="text-xs px-3 h-7">ALL</TabsTrigger>
            </TabsList>
          </Tabs>

          <button
            onClick={() => setShowVolume(!showVolume)}
            className="text-xs text-muted-foreground hover:text-foreground transition flex items-center gap-1"
          >
            <DollarSign className="h-3 w-3" />
            {showVolume ? 'Hide' : 'Show'} Volume
          </button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Main Chart */}
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="yesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="noGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatTimestamp}
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
            />
            
            <YAxis 
              domain={[0, 100]}
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              tickFormatter={(value) => `${value}%`}
            />
            
            <Tooltip content={<CustomTooltip />} />
            
            <ReferenceLine y={50} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" opacity={0.5} />
            
            <Area
              type="monotone"
              dataKey="yesOdds"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#yesGradient)"
              name="YES"
            />
            
            <Area
              type="monotone"
              dataKey="noOdds"
              stroke="hsl(var(--secondary))"
              strokeWidth={2}
              fill="url(#noGradient)"
              name="NO"
            />

            {showVolume && (
              <Bar 
                dataKey="totalVolume" 
                fill="hsl(var(--muted))" 
                opacity={0.3}
                yAxisId="volume"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-xs font-medium">YES Odds</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-secondary" />
            <span className="text-xs font-medium">NO Odds</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="text-xs text-muted-foreground">
            50% = Even odds
          </div>
        </div>

        {/* Insights */}
        {trend.change > 10 && (
          <div className="mt-4 p-3 rounded-lg bg-accent/10 border border-accent/20">
            <p className="text-xs text-muted-foreground">
              💡 <strong>Notable Movement:</strong> YES odds have {trend.direction === 'up' ? 'increased' : 'decreased'} by {trend.change.toFixed(1)}% 
              {timeRange === '24h' ? ' in the last 24 hours' : timeRange === '7d' ? ' this week' : ' in this period'}.
              {trend.direction === 'up' 
                ? ' Market sentiment is shifting toward YES.'
                : ' Market sentiment is shifting toward NO.'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}