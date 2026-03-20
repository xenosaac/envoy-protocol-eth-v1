import { type Task, type TaskHandler, type TaskResult } from "@on-chain-agent/core";
import { EthBridgeSDK } from "@on-chain-agent/eth-sdk";
import { keccak256 } from "viem";

/**
 * Calls the OpenAI Chat Completions API with the given prompt.
 * Set OPENAI_API_KEY in the environment to use this backend.
 */
async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${error}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  return data.choices[0]?.message?.content ?? "";
}

/**
 * Calls the Anthropic Messages API with the given prompt.
 * Set ANTHROPIC_API_KEY in the environment to use this backend.
 */
async function callAnthropic(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${error}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };

  return data.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

/**
 * Routes the prompt to the appropriate LLM backend based on available
 * environment variables. OPENAI_API_KEY takes precedence over ANTHROPIC_API_KEY.
 *
 * TODO: Connect to additional LLM providers as needed (Cohere, Mistral, etc.)
 */
async function callLLM(prompt: string): Promise<string> {
  if (process.env.OPENAI_API_KEY) {
    return callOpenAI(prompt);
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return callAnthropic(prompt);
  }

  // TODO: Replace this placeholder with a real LLM integration once
  // OPENAI_API_KEY or ANTHROPIC_API_KEY is provided in the environment.
  console.warn(
    "[llm-agent] WARNING: No LLM API key found. Returning a placeholder response. " +
      "Set OPENAI_API_KEY or ANTHROPIC_API_KEY to enable real LLM inference."
  );
  return `[PLACEHOLDER] Received prompt: "${prompt}". Set OPENAI_API_KEY or ANTHROPIC_API_KEY to get a real response.`;
}

/**
 * LLMAgentHandler interprets task data as a plain-text prompt, sends it
 * to an LLM, and returns the model's response as the task result.
 */
class LLMAgentHandler implements TaskHandler {
  async handle(task: Task, taskData: Uint8Array): Promise<TaskResult> {
    const prompt = new TextDecoder().decode(taskData).trim();

    console.log(
      `[llm-agent] Task ${task.id}: prompt="${prompt.slice(0, 80)}${prompt.length > 80 ? "..." : ""}"`
    );

    const responseText = await callLLM(prompt);

    const resultBytes = new TextEncoder().encode(responseText);
    const resultHash = keccak256(resultBytes);

    const base64 = Buffer.from(resultBytes).toString("base64");
    const resultURI = `data:text/plain;base64,${base64}`;

    console.log(
      `[llm-agent] Task ${task.id}: response ${resultBytes.length} bytes`
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

  const handler = new LLMAgentHandler();

  console.log("[llm-agent] Agent started. Listening for tasks...");
  await sdk.run(handler);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
