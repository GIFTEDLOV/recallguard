import { describe, expect, it } from "vitest";
import {
  connectWallet,
  currentChainId,
  currentWallet,
  EXPECTED_CHAIN_ID,
  GENLAYER_NETWORK,
  GENLAYER_NETWORK_LABEL,
  GENLAYER_RPC_URL,
  switchToGenLayerNetwork,
} from "./client";

describe("production GenLayer configuration", () => {
  it("defaults to the Studio-dev network and RPC", () => {
    expect(GENLAYER_NETWORK).toBe("studioDevnet");
    expect(GENLAYER_RPC_URL).toBe("https://studio-dev.genlayer.com/api");
    expect(EXPECTED_CHAIN_ID).toBe("0xf22d");
    expect(GENLAYER_NETWORK_LABEL).toBe("GenLayer Studio-dev");
  });

  it("defaults to the authoritative V2 contract", async () => {
    const { CONTRACT_ADDRESS } = await import("./client");
    expect(CONTRACT_ADDRESS).toBe("0x6E2EAfF16124c513022Ad85751fD4dfF8d7e5580");
  });

  it("treats a disconnected wallet as no account", async () => {
    Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
    await expect(currentWallet()).resolves.toBeNull();
    Reflect.deleteProperty(globalThis, "window");
  });

  it("normalizes the provider chain id for wrong-network checks", async () => {
    Object.defineProperty(globalThis, "window", { configurable: true, value: { ethereum: { request: async () => "0XF22F" } } });
    await expect(currentChainId()).resolves.toBe("0xf22f");
    Reflect.deleteProperty(globalThis, "window");
  });

  it("fails wallet connection without an injected provider", async () => {
    Reflect.deleteProperty(globalThis, "window");
    await expect(connectWallet()).rejects.toThrow("Install an EIP-1193 wallet");
  });

  it("does not attempt a network switch while disconnected", async () => {
    Reflect.deleteProperty(globalThis, "window");
    await expect(switchToGenLayerNetwork()).rejects.toThrow("Connect a wallet");
  });
});
