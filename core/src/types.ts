export type ChainType = "ethereum" | "solana";

export enum TaskStatus {
  Created = 0,
  Submitted = 1,
  Settled = 2,
  Disputed = 3,
}

export interface Task {
  id: string;
  taskHash: string;
  taskURI: string;
  taskType: string;
  payment: bigint;
  paymentToken: string; // address(0) = native, else ERC-20
  creator: string;
  agent: string;
  status: TaskStatus;
  chain: ChainType;
}

export interface TaskResult {
  taskId: string;
  resultHash: string;
  resultURI: string;
  data: Uint8Array;
}

export interface TaskHandler {
  handle(task: Task, taskData: Uint8Array): Promise<TaskResult>;
}

export interface SDKConfig {
  rpcUrl: string;
  contractAddress: string;
  privateKey: string;
  chain: ChainType;
}
