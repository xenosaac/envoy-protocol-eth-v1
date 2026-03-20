# The Envoy Protocol for Ethereum V1.0

The protocol for smart contracts to dispatch AI agents — with payment rails that verify the work.

Smart contracts create tasks, AI agents fulfill them, and payment settles trustlessly on-chain. Escrow. Execute. Settle.

> This is the Ethereum implementation of The Envoy Protocol. Multi-chain support (Solana) is on the roadmap.

## Problem

AI agents have no standardized way to get paid for work, and task requestors have no way to verify the work was done. Smart contracts are isolated from the open internet — they can't instruct an AI agent to scrape a webpage, call an API, or run inference.

The Envoy Protocol bridges that gap: a smart contract posts a task with escrowed payment, an agent executes it off-chain, submits verifiable results, and collects payment after a time-lock settlement window.

## How It Works

```
  Smart Contract (TaskManager)              AI Agent (Envoy SDK)
  ─────────────────────────────              ────────────────────
  1. createTask(hash, URI, agent, payment)
       │ ETH/ERC-20 escrowed
       ▼
  2. TaskCreated event ──────────────────▶  3. Listen for events
                                            4. Fetch task data from URI
                                            5. Verify hash matches
                                            6. Execute task
                                            7. submitResult(hash, URI) ──▶ Result stored
                                                                          │
  8. [Optional] dispute() within window ◀──┘     OR
  9. settle() after time-lock expires   ──▶  Payment released to agent
```

## Architecture

```
envoy-protocol/
├── core/                    # Chain-agnostic TypeScript abstractions
│   └── src/
│       ├── types.ts         # Task, TaskResult, TaskHandler, SDKConfig
│       └── sdk.ts           # Abstract BridgeSDK class
│
├── framework_eth/
│   ├── contracts/           # Solidity (Foundry)
│   │   └── src/
│   │       ├── TaskManager.sol        # UUPS + ReentrancyGuard + ERC-20
│   │       └── interfaces/
│   │           └── ITaskManager.sol
│   └── sdk/                 # Ethereum SDK (viem)
│       └── src/
│           ├── EthBridgeSDK.ts        # Extends BridgeSDK
│           └── listener.ts            # Event polling with reconnection
│
├── framework_sol/           # Solana (placeholder)
├── cli/                     # CLI tool
└── templates/               # Agent templates (web-scraper, api-caller, llm-agent)
```

## Quick Start

### Prerequisites

- Node.js >= 18
- pnpm >= 8
- [Foundry](https://getfoundry.sh) (forge, anvil, cast)

### Install

```bash
git clone <repo-url> && cd envoy-protocol
pnpm install
pnpm build
```

### Run Tests

```bash
# Contract tests (38 tests)
cd framework_eth/contracts && forge test -v

# SDK tests (12 tests)
cd framework_eth/sdk && pnpm test
```

### Local Demo

1. Start a local chain:
```bash
anvil
```

2. Deploy the contract:
```bash
cd framework_eth/contracts
DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
```

3. Create a task:
```bash
cast send <PROXY_ADDRESS> \
  "createTask(bytes32,string,bytes32,address,address,uint256)" \
  0x$(echo -n "fetch https://example.com" | xxd -p | tr -d '\n' | head -c 64) \
  "https://example.com/task.json" \
  0x0000000000000000000000000000000000000000000000000000000000000001 \
  <AGENT_ADDRESS> \
  0x0000000000000000000000000000000000000000 \
  0 \
  --value 0.01ether \
  --rpc-url http://localhost:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### Build an Agent

```typescript
import { EthBridgeSDK } from "@on-chain-agent/eth-sdk";
import type { Task, TaskResult, TaskHandler } from "@on-chain-agent/core";

const handler: TaskHandler = {
  async handle(task: Task, taskData: Uint8Array): Promise<TaskResult> {
    // Your agent logic here
    const result = new TextEncoder().encode("done");
    return {
      taskId: task.id,
      resultHash: "0x...", // keccak256 of result
      resultURI: "https://...",
      data: result,
    };
  },
};

const sdk = new EthBridgeSDK({
  rpcUrl: process.env.RPC_URL!,
  contractAddress: process.env.CONTRACT_ADDRESS!,
  privateKey: process.env.AGENT_PRIVATE_KEY!,
  chain: "ethereum",
});

await sdk.run(handler);
```

## Contract Details

- **Pattern:** UUPS Upgradeable Proxy (OpenZeppelin v5)
- **Security:** ReentrancyGuard on `settle()` and `dispute()`
- **Payment:** Native ETH + ERC-20 tokens (fee-on-transfer safe)
- **Settlement:** Time-lock auto-settle (300 blocks / ~1 hour)
- **Task data:** Hash + URI pattern (fixed gas cost regardless of data size)
- **Task types:** `bytes32 taskType` for agent filtering
- **Chain:** Ethereum (Sepolia testnet for v1)

## License

MIT
