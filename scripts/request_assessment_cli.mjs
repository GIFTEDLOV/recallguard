import { spawn } from "node:child_process";
import path from "node:path";

const DEFAULT_CLI_PATH = path.resolve("node_modules/genlayer/dist/index.js");

/**
 * Build the official CLI argv for request_assessment without shell parsing.
 * JSON.stringify is intentional: it produces literal quote characters around
 * a string value, which the CLI's JSON.parse-based argument parser decodes as
 * a JavaScript string.
 */
export function buildRequestAssessmentInvocation({
  cliPath = process.env.GENLAYER_CLI_PATH || DEFAULT_CLI_PATH,
  contractAddress,
  rpc,
  feeProfile,
  listingId,
  recallIdentifier,
  appealRounds,
  cwd = process.cwd(),
}) {
  const recallArg = JSON.stringify(String(recallIdentifier));
  const cliArgv = [
    cliPath,
    "write",
    contractAddress,
    "request_assessment",
    "--rpc",
    rpc,
    "--fee-profile",
    feeProfile,
    ...(appealRounds === undefined ? [] : ["--appeal-rounds", String(appealRounds)]),
    "--wallet",
    "keystore",
    "--args",
    listingId,
    recallArg,
  ];
  return {
    command: process.execPath,
    cliArgv,
    options: { cwd, shell: false },
    recallArg,
  };
}

export function spawnRequestAssessment(options) {
  const invocation = buildRequestAssessmentInvocation(options);
  return spawn(invocation.command, invocation.cliArgv, {
    ...invocation.options,
    stdio: ["ignore", "pipe", "pipe"],
  });
}
