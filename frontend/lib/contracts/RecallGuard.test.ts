import { describe, expect, it } from "vitest";
import { isSuccessfulTransaction } from "./RecallGuard";

describe("GenLayer transaction success semantics", () => {
  it("accepts an accepted transaction only with FINISHED_WITH_RETURN", () => {
    expect(isSuccessfulTransaction({ statusName: "ACCEPTED", txExecutionResultName: "FINISHED_WITH_RETURN" })).toBe(true);
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

  it("supports the installed SDK's numeric compatibility mapping for accepted", () => {
    expect(isSuccessfulTransaction({ status: 5, txExecutionResultName: "FINISHED_WITH_RETURN" })).toBe(true);
  });

  it("supports the installed SDK's numeric compatibility mapping for finalized", () => {
    expect(isSuccessfulTransaction({ status: 7, txExecutionResultName: "FINISHED_WITH_RETURN" })).toBe(true);
  });

  it("does not mistake the old undetermined numeric status for finality", () => {
    expect(isSuccessfulTransaction({ status: 6, txExecutionResultName: "FINISHED_WITH_RETURN" })).toBe(false);
  });

  it("accepts the documented executionResultName spelling from transaction-kit adapters", () => {
    expect(isSuccessfulTransaction({ statusName: "FINALIZED", executionResultName: "FINISHED_WITH_RETURN" })).toBe(true);
  });

  it("requires protocol status and execution result together", () => {
    expect(isSuccessfulTransaction({ statusName: "FINALIZED", txExecutionResultName: "NOT_VOTED" })).toBe(false);
    expect(isSuccessfulTransaction({ statusName: "PENDING", txExecutionResultName: "FINISHED_WITH_RETURN" })).toBe(false);
  });
});
