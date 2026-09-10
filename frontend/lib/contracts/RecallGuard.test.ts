import { describe, expect, it } from "vitest";
import { isSuccessfulTransaction } from "./RecallGuard";

describe("GenLayer transaction success semantics", () => {
  it("does not treat Accepted as durable application completion", () => {
    expect(isSuccessfulTransaction({ statusName: "ACCEPTED", txExecutionResultName: "FINISHED_WITH_RETURN" })).toBe(false);
  });

  it("accepts a finalized transaction only with FINISHED_WITH_RETURN", () => {
    expect(isSuccessfulTransaction({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_RETURN" })).toBe(true);
  });

  it("rejects finalized execution errors", () => {
    expect(isSuccessfulTransaction({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_ERROR" })).toBe(false);
  });

  it("rejects accepted execution errors", () => {
    expect(isSuccessfulTransaction({ statusName: "ACCEPTED", txExecutionResultName: "FINISHED_WITH_ERROR" })).toBe(false);
  });

  it("rejects undetermined transactions even when a leader returned", () => {
    expect(isSuccessfulTransaction({ statusName: "UNDETERMINED", txExecutionResultName: "FINISHED_WITH_RETURN" })).toBe(false);
  });

  it("does not trust the legacy leader receipt success string", () => {
    expect(isSuccessfulTransaction({ statusName: "FINALIZED", consensus_data: { leader_receipt: [{ execution_result: "SUCCESS" }] } })).toBe(false);
  });

  it("rejects missing execution results", () => {
    expect(isSuccessfulTransaction({ statusName: "FINALIZED" })).toBe(false);
  });

  it("does not treat a non-v2 execution-result field as success", () => {
    expect(isSuccessfulTransaction({ statusName: "FINALIZED", executionResultName: "FINISHED_WITH_RETURN" })).toBe(false);
  });

  it("requires protocol status and execution result together", () => {
    expect(isSuccessfulTransaction({ statusName: "FINALIZED", txExecutionResultName: "NOT_VOTED" })).toBe(false);
    expect(isSuccessfulTransaction({ statusName: "PENDING", txExecutionResultName: "FINISHED_WITH_RETURN" })).toBe(false);
  });
});
