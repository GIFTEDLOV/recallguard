"use client";

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

export interface EthereumProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export const GENLAYER_RPC_URL =
  process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || "https://studio.genlayer.com/api";
export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
export const GENLAYER_NETWORK = "studionet" as const;
export const GENLAYER_NETWORK_LABEL = "GenLayer Studio";
export const EXPECTED_CHAIN_ID = `0x${studionet.id.toString(16)}`;

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

export async function currentChainId(): Promise<string | null> {
  const provider = getEthereumProvider();
  if (!provider) return null;
  return String(await provider.request({ method: "eth_chainId" })).toLowerCase();
}

export async function switchToGenLayerNetwork(walletAddress?: string): Promise<void> {
  const address = walletAddress || (await currentWallet());
  if (!address) throw new Error("Connect a wallet before switching networks");
  const client = createGenLayerClient(address);
  await client.connect(GENLAYER_NETWORK);
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
