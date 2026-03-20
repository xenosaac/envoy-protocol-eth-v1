import { type Task, type TaskHandler, type TaskResult } from "@on-chain-agent/core";
import { EthBridgeSDK } from "@on-chain-agent/eth-sdk";
import { keccak256 } from "viem";

/**
 * WebScraperHandler fetches the URL encoded in the task data and returns
 * the raw HTML content as the task result.
 */
class WebScraperHandler implements TaskHandler {
  async handle(task: Task, taskData: Uint8Array): Promise<TaskResult> {
    // Decode task data as a UTF-8 URL string
    const url = new TextDecoder().decode(taskData).trim();

    console.log(`[web-scraper] Task ${task.id}: fetching ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${url}: ${response.status} ${response.statusText}`
      );
    }

    const html = await response.text();
    const resultBytes = new TextEncoder().encode(html);
    const resultHash = keccak256(resultBytes);

    // Encode result as a base64 data URI so it can be stored on-chain as a URI
    const base64 = Buffer.from(resultBytes).toString("base64");
    const resultURI = `data:text/html;base64,${base64}`;

    console.log(
      `[web-scraper] Task ${task.id}: fetched ${resultBytes.length} bytes`
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

  const handler = new WebScraperHandler();

  console.log("[web-scraper] Agent started. Listening for tasks...");
  await sdk.run(handler);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
