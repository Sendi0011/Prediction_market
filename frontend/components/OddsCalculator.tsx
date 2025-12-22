"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, AlertCircle, DollarSign, Percent } from 'lucide-react';

interface OddsCalculatorProps {
  yesPool: number;
  noPool: number;
  feeBP: number;
  selectedSide: 'yes' | 'no' | null;
  amount: string;
  onAmountChange: (amount: string) => void;
}

export function OddsCalculator({
  yesPool,
  noPool,
  feeBP,
  selectedSide,
  amount,
  onAmountChange,
}: OddsCalculatorProps) {
  const [debouncedAmount, setDebouncedAmount] = useState(amount);

  // Debounce amount input for smoother updates
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAmount(amount);
    }, 300);
    return () => clearTimeout(timer);
  }, [amount]);

  // Calculate current odds
  const currentOdds = useMemo(() => {
    const total = yesPool + noPool;
    if (total === 0) return { yes: 50, no: 50 };
    
    return {
      yes: (yesPool / total) * 100,
      no: (noPool / total) * 100,
    };
  }, [yesPool, noPool]);

  // Calculate new odds after stake
  const projectedOdds = useMemo(() => {
    if (!selectedSide || !debouncedAmount || parseFloat(debouncedAmount) <= 0) {
      return currentOdds;
    }

    const stakeAmount = parseFloat(debouncedAmount);
    const newYesPool = selectedSide === 'yes' ? yesPool + stakeAmount : yesPool;
    const newNoPool = selectedSide === 'no' ? noPool + stakeAmount : noPool;
    const newTotal = newYesPool + newNoPool;

    return {
      yes: (newYesPool / newTotal) * 100,
      no: (newNoPool / newTotal) * 100,
    };
  }, [selectedSide, debouncedAmount, yesPool, noPool, currentOdds]);

  // Calculate slippage
  const slippage = useMemo(() => {
    if (!selectedSide || !debouncedAmount || parseFloat(debouncedAmount) <= 0) {
      return 0;
    }

    const currentProb = selectedSide === 'yes' ? currentOdds.yes : currentOdds.no;
    const newProb = selectedSide === 'yes' ? projectedOdds.yes : projectedOdds.no;
    
    return Math.abs(newProb - currentProb);
  }, [selectedSide, debouncedAmount, currentOdds, projectedOdds]);

  // Calculate potential payout
  const potentialPayout = useMemo(() => {
    if (!selectedSide || !debouncedAmount || parseFloat(debouncedAmount) <= 0) {
      return { gross: 0, fee: 0, net: 0, roi: 0 };
    }

    const stakeAmount = parseFloat(debouncedAmount);
    const winningPool = selectedSide === 'yes' ? yesPool + stakeAmount : noPool + stakeAmount;
    const losingPool = selectedSide === 'yes' ? noPool : yesPool;
    const totalPool = winningPool + losingPool;
    
    // If user wins, they get their share of the total pool
    const userShare = stakeAmount / winningPool;
    const grossPayout = totalPool * userShare;
    
    // Calculate fee
    const feeAmount = (grossPayout * feeBP) / 10000;
    const netPayout = grossPayout - feeAmount;
    
    // Calculate ROI
    const roi = ((netPayout - stakeAmount) / stakeAmount) * 100;

    return {
      gross: grossPayout,
      fee: feeAmount,
      net: netPayout,
      roi: roi,
    };
  }, [selectedSide, debouncedAmount, yesPool, noPool, feeBP]);

  const hasStakeAmount = debouncedAmount && parseFloat(debouncedAmount) > 0;
  const showCalculations = selectedSide && hasStakeAmount;

  return (
    <div className="space-y-4">
      {/* Current Odds Display */}
      <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Percent className="h-4 w-4" />
            Current Market Odds
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">YES</span>
            <Badge variant="default" className="font-semibold">
              {currentOdds.yes.toFixed(2)}%
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">NO</span>
            <Badge variant="secondary" className="font-semibold">
              {currentOdds.no.toFixed(2)}%
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Slippage Preview */}
      {showCalculations && (
        <>
          <Card className="border-accent/30 bg-accent/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Impact Preview
              </CardTitle>
              <CardDescription className="text-xs">
                How your {parseFloat(debouncedAmount).toFixed(2)} USDC stake will affect the market
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* New Odds */}
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground mb-1">New Odds After Your Stake</div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                  <span className="text-sm font-medium">YES</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground line-through">
                      {currentOdds.yes.toFixed(2)}%
                    </span>
                    <Badge 
                      variant={selectedSide === 'yes' ? 'default' : 'outline'}
                      className="font-semibold"
                    >
                      {projectedOdds.yes.toFixed(2)}%
                    </Badge>
                    {selectedSide === 'yes' && (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                  <span className="text-sm font-medium">NO</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground line-through">
                      {currentOdds.no.toFixed(2)}%
                    </span>
                    <Badge 
                      variant={selectedSide === 'no' ? 'secondary' : 'outline'}
                      className="font-semibold"
                    >
                      {projectedOdds.no.toFixed(2)}%
                    </Badge>
                    {selectedSide === 'no' && (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    )}
                  </div>
                </div>
              </div>

              {/* Slippage */}
              <div className="p-3 rounded-lg bg-background/70 border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Odds Movement
                  </span>
                  <Badge 
                    variant={slippage > 5 ? 'destructive' : slippage > 2 ? 'default' : 'secondary'}
                    className="font-mono"
                  >
                    +{slippage.toFixed(2)}%
                  </Badge>
                </div>
                {slippage > 5 && (
                  <div className="flex items-start gap-2 mt-2 text-xs text-amber-600 dark:text-amber-400">
                    <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>High impact: Your stake will significantly move the odds</span>
                  </div>
                )}
              </div>

              {/* Pool Distribution */}
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground mb-1">Pool Distribution After Stake</div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span>YES Pool</span>
                    <span className="font-mono font-medium">
                      ${(selectedSide === 'yes' ? yesPool + parseFloat(debouncedAmount) : yesPool).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>NO Pool</span>
                    <span className="font-mono font-medium">
                      ${(selectedSide === 'no' ? noPool + parseFloat(debouncedAmount) : noPool).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs pt-1 border-t border-border">
                    <span className="font-semibold">Total Pool</span>
                    <span className="font-mono font-semibold">
                      ${(yesPool + noPool + parseFloat(debouncedAmount)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Potential Payout Card */}
          <Card className="border-green-500/30 bg-green-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Potential Returns (If You Win)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gross Payout</span>
                  <span className="font-mono font-semibold">
                    ${potentialPayout.gross.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Platform Fee ({(feeBP / 100).toFixed(1)}%)</span>
                  <span className="font-mono text-destructive">
                    -${potentialPayout.fee.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-border">
                  <span className="font-semibold">Net Payout</span>
                  <span className="font-mono font-bold text-green-600 dark:text-green-400">
                    ${potentialPayout.net.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-background/70 border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Return on Investment</span>
                  <Badge 
                    variant={potentialPayout.roi > 50 ? 'default' : 'secondary'}
                    className="font-mono text-base px-3"
                  >
                    {potentialPayout.roi > 0 ? '+' : ''}{potentialPayout.roi.toFixed(1)}%
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Profit: ${(potentialPayout.net - parseFloat(debouncedAmount)).toFixed(2)}
                </div>
              </div>

              <div className="text-xs text-muted-foreground bg-background/50 p-2 rounded border border-border">
                💡 <strong>Note:</strong> This assumes you win. If the outcome is {selectedSide === 'yes' ? 'NO' : 'YES'}, you'll lose your stake.
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty State */}
      {!showCalculations && (
        <Card className="border-dashed">
          <CardContent className="pt-6 pb-6 text-center">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {!selectedSide 
                ? 'Select YES or NO to see odds calculation' 
                : 'Enter a stake amount to preview market impact'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}