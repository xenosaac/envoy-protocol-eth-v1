import fs from "fs";
import path from "path";

export async function initProject(name: string): Promise<void> {
  const projectDir = path.resolve(process.cwd(), name);

  if (fs.existsSync(projectDir)) {
    console.error(`Directory "${name}" already exists.`);
    process.exit(1);
  }

  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(path.join(projectDir, "src"), { recursive: true });

  // package.json
  const packageJson = {
    name,
    version: "0.1.0",
    description: "An on-chain agent built with the On-Chain Agent SDK",
    type: "module",
    main: "./dist/index.js",
    scripts: {
      build: "tsc",
      start: "node dist/index.js",
      clean: "rm -rf dist",
    },
    dependencies: {
      "@on-chain-agent/core": "^0.1.0",
      "@on-chain-agent/eth-sdk": "^0.1.0",
    },
    devDependencies: {
      typescript: "^5.4.0",
    },
  };

  fs.writeFileSync(
    path.join(projectDir, "package.json"),
    JSON.stringify(packageJson, null, 2) + "\n"
  );

  // tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      outDir: "./dist",
      rootDir: "./src",
    },
    include: ["src"],
  };

  fs.writeFileSync(
    path.join(projectDir, "tsconfig.json"),
    JSON.stringify(tsconfig, null, 2) + "\n"
  );

  // .env.example
  const envExample = [
    "# Ethereum RPC URL (e.g. http://127.0.0.1:8545 for local anvil)",
    "RPC_URL=http://127.0.0.1:8545",
    "",
    "# Address of the deployed TaskManager contract",
    "CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000",
    "",
    "# Private key of the agent wallet (no 0x prefix required)",
    "AGENT_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  ].join("\n");

  fs.writeFileSync(path.join(projectDir, ".env.example"), envExample + "\n");

  // src/agent.ts — minimal TaskHandler implementation
  const agentTs = `import { type Task, type TaskHandler, type TaskResult } from "@on-chain-agent/core";
import { EthBridgeSDK } from "@on-chain-agent/eth-sdk";
import { keccak256, toBytes } from "viem";

class MyAgent implements TaskHandler {
  async handle(task: Task, taskData: Uint8Array): Promise<TaskResult> {
    // Decode task data as a UTF-8 string
    const input = new TextDecoder().decode(taskData);
    console.log(\`Handling task \${task.id}: \${input}\`);

    // TODO: implement your agent logic here
    const output = \`Processed: \${input}\`;

    const resultBytes = toBytes(output);
    const resultHash = keccak256(resultBytes);

    return {
      taskId: task.id,
      resultHash,
      resultURI: \`data:text/plain;base64,\${Buffer.from(resultBytes).toString("base64")}\`,
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

  const handler = new MyAgent();

  console.log("Agent started. Listening for tasks...");
  await sdk.run(handler);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
`;

  fs.writeFileSync(path.join(projectDir, "src", "agent.ts"), agentTs);

  console.log(`
Project "${name}" created successfully!

Next steps:
  cd ${name}
  cp .env.example .env
  # Edit .env with your RPC URL, contract address, and private key
  npm install
  npm run build
  npm start
`);
}
