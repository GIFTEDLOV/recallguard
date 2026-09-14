import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { buildRequestAssessmentInvocation } from "../../scripts/request_assessment_cli.mjs";

test("request_assessment preserves the recall identifier as a CLI JSON string", () => {
  const invocation = buildRequestAssessmentInvocation({
    cliPath: "C:\\Users\\DELL\\AppData\\Roaming\\npm\\node_modules\\genlayer\\dist\\index.js",
    contractAddress: "0xfD7C6d9FB229e5bD14677505E9Db2F15A7D45e04",
    rpc: "http://127.0.0.1:4000/api",
    feeProfile: "frontend/public/fee-profile.json",
    listingId: "fc579fdf19698bf917bb7cc5a9e3d29a99fd45911d85306008e34c99cceaa3e0",
    recallIdentifier: 26741,
  });
  const argsIndex = invocation.cliArgv.indexOf("--args");
  const recallArg = invocation.cliArgv[argsIndex + 2];

  assert.equal(recallArg, '"26741"');
  assert.equal(recallArg.includes("\\"), false);
  assert.equal(JSON.parse(recallArg), "26741");
  assert.equal(typeof JSON.parse(recallArg), "string");
  assert.notEqual(JSON.parse(recallArg), 26741);
  assert.notEqual(JSON.parse(recallArg), "26-741");

  const probe = spawnSync(
    process.execPath,
    ["-e", "process.stdout.write(JSON.stringify(process.argv.slice(1)))", recallArg],
    { shell: false, encoding: "utf8" },
  );
  assert.equal(probe.status, 0);
  assert.deepEqual(JSON.parse(probe.stdout), ["\"26741\""]);
});
