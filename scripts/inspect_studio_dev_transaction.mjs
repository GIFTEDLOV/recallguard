import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";

const RPC = "https://studio-dev.genlayer.com/api";
const TX = process.argv[2];

function json(value) {
  return JSON.stringify(value, (_, entry) => typeof entry === "bigint" ? entry.toString() : entry, 2);
}

function collect(node, path = "$", output = []) {
  if (!node || typeof node !== "object") return output;
  if (Array.isArray(node)) {
    node.forEach((value, index) => collect(value, `${path}[${index}]`, output));
    return output;
  }
  for (const [key, value] of Object.entries(node)) {
    if (["error", "error_code", "error_description", "stderr", "stdout", "raw_error", "leader_error", "execution_error"].includes(key) || key.endsWith("Error")) {
      output.push({ path: `${path}.${key}`, value });
    }
    collect(value, `${path}.${key}`, output);
  }
  return output;
}

function collectResults(node, path = "$", output = []) {
  if (!node || typeof node !== "object") return output;
  if (Array.isArray(node)) {
    node.forEach((value, index) => collectResults(value, `${path}[${index}]`, output));
    return output;
  }
  for (const [key, value] of Object.entries(node)) {
    const childPath = `${path}.${key}`;
    if (key === "result" && typeof value === "string" && path.includes("consensus")) {
      let decoded = null;
      try { decoded = Buffer.from(value, "base64").toString("utf8"); } catch { decoded = null; }
      output.push({ path: childPath, base64: value, decoded });
    }
    collectResults(value, childPath, output);
  }
  return output;
}

async function main() {
  if (!TX) throw new Error("TX_REQUIRED");
  const client = createClient({ chain: studioDevnet, endpoint: RPC });
  const transaction = await client.getTransaction({ hash: TX });
  console.log(json({
    tx: TX,
    status: transaction?.statusName ?? transaction?.status,
    execution: transaction?.txExecutionResultName ?? transaction?.txExecutionResult,
    resultFields: collectResults(transaction),
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
