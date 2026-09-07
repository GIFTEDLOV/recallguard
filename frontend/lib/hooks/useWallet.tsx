"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  connectWallet,
  currentChainId,
  currentWallet,
  EXPECTED_CHAIN_ID,
  GENLAYER_NETWORK_LABEL,
  getEthereumProvider,
  switchToGenLayerNetwork,
} from "../genlayer/client";

interface WalletContextValue {
  wallet: string | null;
  chainId: string | null;
  expectedChainId: string;
  networkLabel: string;
  providerAvailable: boolean;
  connecting: boolean;
  isCorrectNetwork: boolean;
  refresh: () => Promise<void>;
  connect: () => Promise<void>;
  switchNetwork: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const refresh = useCallback(async () => {
    const [nextWallet, nextChainId] = await Promise.all([currentWallet(), currentChainId()]);
    setWallet(nextWallet);
    setChainId(nextChainId);
  }, []);

  useEffect(() => {
    void refresh();
    const provider = getEthereumProvider();
    if (!provider?.on) return;
    const handleAccounts = () => void refresh();
    const handleChain = () => void refresh();
    provider.on("accountsChanged", handleAccounts);
    provider.on("chainChanged", handleChain);
    return () => {
      provider.removeListener?.("accountsChanged", handleAccounts);
      provider.removeListener?.("chainChanged", handleChain);
    };
  }, [refresh]);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      await connectWallet();
      await refresh();
    } finally {
      setConnecting(false);
    }
  }, [refresh]);

  const switchNetwork = useCallback(async () => {
    setConnecting(true);
    try {
      await switchToGenLayerNetwork(wallet || undefined);
      await refresh();
    } finally {
      setConnecting(false);
    }
  }, [refresh, wallet]);

  const value = useMemo<WalletContextValue>(() => ({
    wallet,
    chainId,
    expectedChainId: EXPECTED_CHAIN_ID,
    networkLabel: GENLAYER_NETWORK_LABEL,
    providerAvailable: Boolean(getEthereumProvider()),
    connecting,
    isCorrectNetwork: Boolean(chainId && chainId.toLowerCase() === EXPECTED_CHAIN_ID),
    refresh,
    connect,
    switchNetwork,
  }), [chainId, connect, connecting, refresh, switchNetwork, wallet]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used inside WalletProvider");
  return context;
}
