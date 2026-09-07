"use client";

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

interface EthereumProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export const GENLAYER_RPC_URL =
  process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || "https://studio.genlayer.com/api";
export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";

export function getEthereumProvider(): EthereumProvider | null {
  return typeof window === "undefined" ? null : window.ethereum || null;
}

export async function connectWallet(): Promise<string> {
  const provider = getEthereumProvider();
  if (!provider) throw new Error("Install an EIP-1193 wallet to continue");
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts?.[0]) throw new Error("No wallet account was selected");
  return accounts[0];
}

export async function currentWallet(): Promise<string | null> {
  const provider = getEthereumProvider();
  if (!provider) return null;
  const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
  return accounts?.[0] || null;
}

export function createGenLayerClient(address?: string) {
  const config: Record<string, unknown> = {
    chain: studionet,
    endpoint: GENLAYER_RPC_URL,
  };
  if (address) {
    const provider = getEthereumProvider();
    if (!provider) throw new Error("Connect an EIP-1193 wallet before submitting a transaction");
    config.account = address as `0x${string}`;
    config.provider = provider;
  }
  return createClient(config as never);
}
