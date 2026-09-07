import { describe, expect, it } from "vitest";
import {
  EXPECTED_CHAIN_ID,
  GENLAYER_NETWORK,
  GENLAYER_NETWORK_LABEL,
  GENLAYER_RPC_URL,
} from "./client";

describe("production GenLayer configuration", () => {
  it("defaults to the Bradbury network and RPC", () => {
    expect(GENLAYER_NETWORK).toBe("testnetBradbury");
    expect(GENLAYER_RPC_URL).toBe("https://rpc-bradbury.genlayer.com");
    expect(EXPECTED_CHAIN_ID).toBe("0x107d");
    expect(GENLAYER_NETWORK_LABEL).toBe("GenLayer Bradbury");
  });
});
