import { describe, expect, it } from "vitest";
import { challengeActionLabel, challengePath, humanizeError, hostFromUrl, labelForState, labelForVerdict, stateExplanation, toneForState } from "./ui";

describe("contract result presentation", () => {
  it("keeps exact enums behind human-readable labels", () => {
    expect(labelForState("UNASSESSED")).toBe("Not yet assessed");
    expect(labelForState("CLEARED")).toBe("Cleared by consensus");
    expect(labelForState("REVIEW_REQUIRED")).toBe("Review required");
    expect(labelForState("BLOCKED")).toBe("Blocked");
    expect(labelForVerdict("AFFECTED")).toBe("Affected");
    expect(labelForVerdict("NOT_AFFECTED")).toBe("Not affected");
    expect(labelForVerdict("INCONCLUSIVE")).toBe("Inconclusive");
  });

  it("maps infrastructure failures to non-verdict language", () => {
    expect(humanizeError(new Error("EVIDENCE_UNAVAILABLE: timeout_or_fetch_failure")).title).toBe("Evidence unavailable");
    expect(humanizeError(new Error("CONSENSUS: disagreement")).message).toContain("safety state was not changed");
    expect(humanizeError(new Error("malformed_output")).message).toContain("strict decision schema");
  });

  it("renders evidence hosts defensively", () => {
    expect(hostFromUrl("https://cpsc.gov/recalls/notice")).toBe("cpsc.gov");
    expect(hostFromUrl("not-a-url")).toBe("not-a-url");
  });

  it("keeps unassessed visually neutral and semantically explicit", () => {
    expect(toneForState("UNASSESSED")).toBe("neutral");
    expect(stateExplanation("UNASSESSED")).toBe("No consensus assessment exists yet.");
    expect(labelForState("UNASSESSED")).not.toMatch(/safe|clear|verified|approved|active/i);
  });

  it.each([
    ["CLEARED", "positive", "Cleared by consensus"],
    ["REVIEW_REQUIRED", "caution", "Review required"],
    ["BLOCKED", "danger", "Blocked"],
  ] as const)("maps %s only to its own safety tone and label", (state, tone, label) => {
    expect(toneForState(state)).toBe(tone);
    expect(labelForState(state)).toBe(label);
  });

  it("exposes one permissionless challenge action for every listing", () => {
    expect(challengeActionLabel).toBe("Check against a recall");
    expect(challengePath("listing/with spaces")).toBe("/app/listings/listing%2Fwith%20spaces/check");
  });

  it("explains that a cleared state comes from contract history", () => {
    expect(stateExplanation("CLEARED")).toContain("consensus-backed");
    expect(stateExplanation("REVIEW_REQUIRED")).toContain("inconclusive");
    expect(stateExplanation("BLOCKED")).toContain("affected");
  });

  it("keeps wallet disconnects and wrong networks out of the business state", () => {
    expect(humanizeError(new Error("wallet disconnected")).message).toContain("No transaction was broadcast");
    expect(humanizeError(new Error("wrong network chain")).title).toBe("Wrong network");
  });
});
