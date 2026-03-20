import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { BridgeSDK, type SDKConfig, type Task } from "@on-chain-agent/core";
import { TASK_MANAGER_ABI } from "./abi.js";
import { EventListener } from "./listener.js";

export class EthBridgeSDK extends BridgeSDK {
  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private contractAddress: `0x${string}`;

  constructor(config: SDKConfig) {
    super(config);

    this.contractAddress = config.contractAddress as `0x${string}`;

    this.publicClient = createPublicClient({
      chain: mainnet,
      transport: http(config.rpcUrl),
    });

    const account = privateKeyToAccount(config.privateKey as `0x${string}`);

    this.walletClient = createWalletClient({
      account,
      chain: mainnet,
      transport: http(config.rpcUrl),
    });
  }

  async *listen(): AsyncIterable<Task> {
    const listener = new EventListener(this.publicClient, this.contractAddress);
    yield* listener.listen();
  }

  async fetchTaskData(taskURI: string, taskHash: string): Promise<Uint8Array> {
    const response = await fetch(taskURI);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch task data from ${taskURI}: ${response.statusText}`
      );
    }

    const buffer = await response.arrayBuffer();
    const data = new Uint8Array(buffer);

    // Compute keccak256 hash of fetched data and verify it matches taskHash
    const computedHash = keccak256(data);
    if (computedHash.toLowerCase() !== taskHash.toLowerCase()) {
      throw new Error(
        `Task data hash mismatch. Expected ${taskHash}, got ${computedHash}`
      );
    }

    return data;
  }

  async submitResult(
    taskId: string,
    resultHash: string,
    resultURI: string
  ): Promise<string> {
    const [account] = await this.walletClient.getAddresses();
    const txHash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi: TASK_MANAGER_ABI,
      functionName: "submitResult",
      args: [BigInt(taskId), resultHash as `0x${string}`, resultURI],
      account: account!,
      chain: mainnet,
    });

    return txHash;
  }

  async settle(taskId: string): Promise<string> {
    const [account] = await this.walletClient.getAddresses();
    const txHash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi: TASK_MANAGER_ABI,
      functionName: "settle",
      args: [BigInt(taskId)],
      account: account!,
      chain: mainnet,
    });

    return txHash;
  }
}
