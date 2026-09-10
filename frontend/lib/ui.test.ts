import { describe, expect, it } from "vitest";
import { humanizeError, hostFromUrl, labelForState, labelForVerdict } from "./ui";

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
});
