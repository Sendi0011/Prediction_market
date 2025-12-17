"use client";

// privyConfig.ts
import type { PrivyClientConfig } from '@privy-io/react-auth';
import { baseSepolia } from 'viem/chains';

export const privyConfig: PrivyClientConfig = {
  loginMethods: ['email', 'google', 'wallet'],   // allow these methods
  embeddedWallets: {
    createOnLogin: 'users-without-wallets',      // create embedded wallet automatically if none exists
  },
  // optionally set the default blockchain chain (if needed)
  defaultChain: baseSepolia,
};