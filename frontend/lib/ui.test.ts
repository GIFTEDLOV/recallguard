import { describe, expect, it } from "vitest";
import { challengeActionLabel, challengePath, humanizeError, hostFromUrl, labelForState, labelForVerdict, stateExplanation, toneForState } from "./ui";

describe("contract result presentation", () => {
  it("uses the four exact listing state labels", () => {
    expect(labelForState("UNASSESSED")).toBe("Not yet assessed");
    expect(labelForState("CLEARED")).toBe("Cleared by consensus");
    expect(labelForState("REVIEW_REQUIRED")).toBe("Review required");
    expect(labelForState("BLOCKED")).toBe("Blocked");
  });

  it("uses the three exact verdict labels", () => {
    expect(labelForVerdict("AFFECTED")).toBe("Affected");
    expect(labelForVerdict("NOT_AFFECTED")).toBe("Not affected");
    expect(labelForVerdict("INCONCLUSIVE")).toBe("Inconclusive");
  });

  it("keeps UNASSESSED neutral and never describes it as safe or clear", () => {
    expect(toneForState("UNASSESSED")).toBe("neutral");
    expect(labelForState("UNASSESSED")).not.toMatch(/safe|clear|verified|approved|active/i);
    expect(stateExplanation("UNASSESSED")).toContain("not described as safe or cleared");
  });

  it.each([
    ["CLEARED", "positive"],
    ["REVIEW_REQUIRED", "caution"],
    ["BLOCKED", "danger"],
  ] as const)("uses only the %s state tone", (state, tone) => expect(toneForState(state)).toBe(tone));

  it("explains that cleared means consensus against recorded facts", () => {
    expect(stateExplanation("CLEARED")).toContain("registered facts");
    expect(stateExplanation("REVIEW_REQUIRED")).toContain("inconclusive");
    expect(stateExplanation("BLOCKED")).toContain("cannot unblock");
  });

  it("exposes one permissionless challenge action for every listing", () => {
    expect(challengeActionLabel).toBe("Check against a recall");
    expect(challengePath("listing/with spaces")).toBe("/app/listings/listing%2Fwith%20spaces/check");
  });

  it("renders URLs defensively", () => {
    expect(hostFromUrl("https://www.saferproducts.gov/RestWebServices/Recall")).toBe("www.saferproducts.gov");
    expect(hostFromUrl("not-a-url")).toBe("not-a-url");
  });

  it("classifies structured wrong-network errors", () => {
    expect(humanizeError({ code: "CHAIN_MISMATCH", message: "rpc says something" })).toEqual({ title: "Wrong network", message: "Switch to the configured GenLayer network before submitting." });
  });

  it("classifies structured insufficient-fee errors", () => {
    expect(humanizeError({ data: { code: "INSUFFICIENT_FEES" }, message: "not an English hint" }).title).toBe("Insufficient fee or balance");
  });

  it("does not turn source failure into a business verdict", () => {
    expect(humanizeError(new Error("SOURCE:CPSC_EXACT_RECORD_NOT_FOUND")).message).toContain("No safety verdict");
  });

  it("does not turn consensus failure into inconclusive", () => {
    const result = humanizeError(new Error("CONSENSUS:DISAGREEMENT"));
    expect(result.title).toBe("Consensus not reached");
    expect(result.message).not.toContain("Inconclusive");
  });

  it("does not treat finalized with execution error as success", () => {
    expect(humanizeError(new Error("TRANSACTION:FINISHED_WITH_ERROR")).title).toBe("Transaction failed");
  });

  it("keeps a returned transaction ID in the recovery message", () => {
    expect(humanizeError(new Error("RECONCILIATION_REQUIRED:0xabc")).message).toContain("same transaction ID");
  });

  it("distinguishes a disconnected wallet from a failed assessment", () => {
    expect(humanizeError(new Error("WALLET:DISCONNECTED")).title).toBe("Wallet connection required");
  });

  it("distinguishes application state conflicts", () => {
    expect(humanizeError(new Error("STATE:ASSESSMENT_READBACK_MISMATCH")).title).toBe("Application state conflict");
  });
});
