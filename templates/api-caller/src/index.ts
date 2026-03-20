import { type Task, type TaskHandler, type TaskResult } from "@on-chain-agent/core";
import { EthBridgeSDK } from "@on-chain-agent/eth-sdk";
import { keccak256 } from "viem";

/**
 * Shape of the JSON task data expected by the API caller agent.
 */
interface ApiCallRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

/**
 * ApiCallerHandler parses the task data as a JSON ApiCallRequest,
 * executes the HTTP call, and returns the response body as the result.
 */
class ApiCallerHandler implements TaskHandler {
  async handle(task: Task, taskData: Uint8Array): Promise<TaskResult> {
    // Decode and parse task data as JSON
    const raw = new TextDecoder().decode(taskData).trim();
    let request: ApiCallRequest;

    try {
      request = JSON.parse(raw) as ApiCallRequest;
    } catch {
      throw new Error(`Task ${task.id}: invalid JSON task data: ${raw}`);
    }

    const { url, method = "GET", headers, body } = request;

    console.log(`[api-caller] Task ${task.id}: ${method} ${url}`);

    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? body : undefined,
    });

    const responseText = await response.text();
    const resultPayload = JSON.stringify({
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseText,
    });

    const resultBytes = new TextEncoder().encode(resultPayload);
    const resultHash = keccak256(resultBytes);

    const base64 = Buffer.from(resultBytes).toString("base64");
    const resultURI = `data:application/json;base64,${base64}`;

    console.log(
      `[api-caller] Task ${task.id}: response ${response.status}, ${resultBytes.length} bytes`
    );

    return {
      taskId: task.id,
      resultHash,
      resultURI,
      data: resultBytes,
    };
  }
}

async function main(): Promise<void> {
  const rpcUrl = process.env.RPC_URL;
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const privateKey = process.env.AGENT_PRIVATE_KEY;

  if (!rpcUrl || !contractAddress || !privateKey) {
    console.error(
      "Missing required environment variables: RPC_URL, CONTRACT_ADDRESS, AGENT_PRIVATE_KEY"
    );
    process.exit(1);
  }

  const sdk = new EthBridgeSDK({
    rpcUrl,
    contractAddress,
    privateKey,
    chain: "ethereum",
  });

  const handler = new ApiCallerHandler();

  console.log("[api-caller] Agent started. Listening for tasks...");
  await sdk.run(handler);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
