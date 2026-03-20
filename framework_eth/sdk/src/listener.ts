import type { PublicClient } from "viem";
import { type Task, TaskStatus } from "@on-chain-agent/core";
import { TASK_MANAGER_ABI } from "./abi.js";

export interface EventListenerOptions {
  pollingInterval?: number;
}

export class EventListener {
  private client: PublicClient;
  private contractAddress: `0x${string}`;
  private pollingInterval: number;
  private lastProcessedBlock: bigint;

  constructor(
    client: PublicClient,
    contractAddress: `0x${string}`,
    options: EventListenerOptions = {}
  ) {
    this.client = client;
    this.contractAddress = contractAddress;
    this.pollingInterval = options.pollingInterval ?? 2000;
    this.lastProcessedBlock = 0n;
  }

  async pollEvents(fromBlock: bigint): Promise<Task[]> {
    const currentBlock = await this.client.getBlockNumber();

    if (fromBlock > currentBlock) {
      return [];
    }

    const logs = await this.client.getContractEvents({
      address: this.contractAddress,
      abi: TASK_MANAGER_ABI,
      eventName: "TaskCreated",
      fromBlock,
      toBlock: currentBlock,
    });

    this.lastProcessedBlock = currentBlock;

    return logs.map((log) => {
      const args = log.args as {
        taskId: bigint;
        taskType: `0x${string}`;
        taskHash: `0x${string}`;
        taskURI: string;
        agent: `0x${string}`;
        paymentToken: `0x${string}`;
        payment: bigint;
      };

      const task: Task = {
        id: args.taskId.toString(),
        taskHash: args.taskHash,
        taskURI: args.taskURI,
        taskType: args.taskType,
        payment: args.payment,
        paymentToken: args.paymentToken,
        creator: "0x0000000000000000000000000000000000000000",
        agent: args.agent,
        status: TaskStatus.Created,
        chain: "ethereum",
      };

      return task;
    });
  }

  async *listen(): AsyncGenerator<Task> {
    // Start from the current block if not yet initialized
    if (this.lastProcessedBlock === 0n) {
      try {
        this.lastProcessedBlock = await this.client.getBlockNumber();
      } catch {
        this.lastProcessedBlock = 0n;
      }
    }

    while (true) {
      try {
        const fromBlock = this.lastProcessedBlock + 1n;
        const tasks = await this.pollEvents(fromBlock);

        for (const task of tasks) {
          yield task;
        }
      } catch (error) {
        console.error("EventListener poll error, will retry:", error);
      }

      await new Promise((resolve) =>
        setTimeout(resolve, this.pollingInterval)
      );
    }
  }
}
