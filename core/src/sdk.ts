import type { Task, TaskResult, TaskHandler, SDKConfig } from "./types.js";

export abstract class BridgeSDK {
  protected config: SDKConfig;

  constructor(config: SDKConfig) {
    this.config = config;
  }

  abstract listen(): AsyncIterable<Task>;

  abstract fetchTaskData(taskURI: string, taskHash: string): Promise<Uint8Array>;

  abstract submitResult(
    taskId: string,
    resultHash: string,
    resultURI: string
  ): Promise<string>;

  abstract settle(taskId: string): Promise<string>;

  async run(handler: TaskHandler): Promise<void> {
    for await (const task of this.listen()) {
      try {
        const taskData = await this.fetchTaskData(task.taskURI, task.taskHash);
        const result = await handler.handle(task, taskData);
        await this.submitResult(task.id, result.resultHash, result.resultURI);
      } catch (error) {
        console.error(`Failed to handle task ${task.id}:`, error);
      }
    }
  }
}
