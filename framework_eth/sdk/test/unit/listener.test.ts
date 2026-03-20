import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventListener } from "../../src/listener.js";
import { TaskStatus } from "@on-chain-agent/core";
import type { PublicClient } from "viem";

function makeClient(overrides: Partial<PublicClient> = {}): PublicClient {
  return {
    getBlockNumber: vi.fn().mockResolvedValue(100n),
    getContractEvents: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as PublicClient;
}

const CONTRACT = "0x1234567890123456789012345678901234567890" as `0x${string}`;

describe("EventListener.pollEvents", () => {
  it("converts TaskCreated events to Task objects", async () => {
    const log = {
      args: {
        taskId: 42n,
        taskType: "0xaabbccdd" as `0x${string}`,
        taskHash: "0xdeadbeef" as `0x${string}`,
        taskURI: "https://example.com/task/42",
        agent: "0xAgentAddress000000000000000000000000000" as `0x${string}`,
        paymentToken: "0x0000000000000000000000000000000000000000" as `0x${string}`,
        payment: 1000n,
      },
    };

    const client = makeClient({
      getBlockNumber: vi.fn().mockResolvedValue(10n),
      getContractEvents: vi.fn().mockResolvedValue([log]),
    });

    const listener = new EventListener(client, CONTRACT);
    const tasks = await listener.pollEvents(1n);

    expect(tasks).toHaveLength(1);
    const task = tasks[0];
    expect(task.id).toBe("42");
    expect(task.taskHash).toBe("0xdeadbeef");
    expect(task.taskURI).toBe("https://example.com/task/42");
    expect(task.taskType).toBe("0xaabbccdd");
    expect(task.payment).toBe(1000n);
    expect(task.paymentToken).toBe("0x0000000000000000000000000000000000000000");
    expect(task.agent).toBe("0xAgentAddress000000000000000000000000000");
    expect(task.creator).toBe("0x0000000000000000000000000000000000000000");
    expect(task.status).toBe(TaskStatus.Created);
    expect(task.chain).toBe("ethereum");
  });

  it("advances lastProcessedBlock after polling", async () => {
    const getBlockNumber = vi.fn().mockResolvedValue(50n);
    const client = makeClient({ getBlockNumber });

    const listener = new EventListener(client, CONTRACT);

    // Access private field for assertion
    const getLastBlock = () =>
      (listener as unknown as { lastProcessedBlock: bigint }).lastProcessedBlock;

    expect(getLastBlock()).toBe(0n);
    await listener.pollEvents(1n);
    expect(getLastBlock()).toBe(50n);
  });

  it("returns empty array when no events exist", async () => {
    const client = makeClient({
      getBlockNumber: vi.fn().mockResolvedValue(20n),
      getContractEvents: vi.fn().mockResolvedValue([]),
    });

    const listener = new EventListener(client, CONTRACT);
    const tasks = await listener.pollEvents(1n);

    expect(tasks).toEqual([]);
  });

  it("returns empty array when fromBlock is ahead of currentBlock", async () => {
    const client = makeClient({
      getBlockNumber: vi.fn().mockResolvedValue(5n),
      getContractEvents: vi.fn().mockResolvedValue([]),
    });

    const listener = new EventListener(client, CONTRACT);
    // fromBlock (10) > currentBlock (5)
    const tasks = await listener.pollEvents(10n);

    expect(tasks).toEqual([]);
    // getContractEvents should not be called since we return early
    expect(client.getContractEvents).not.toHaveBeenCalled();
  });

  it("resumes polling from lastProcessedBlock on subsequent calls", async () => {
    const getContractEvents = vi.fn().mockResolvedValue([]);
    const getBlockNumber = vi
      .fn()
      .mockResolvedValueOnce(30n)
      .mockResolvedValueOnce(60n);

    const client = makeClient({ getBlockNumber, getContractEvents });
    const listener = new EventListener(client, CONTRACT);

    // First poll: fromBlock=1, currentBlock=30 => lastProcessedBlock becomes 30
    await listener.pollEvents(1n);

    const lastBlock = (listener as unknown as { lastProcessedBlock: bigint })
      .lastProcessedBlock;
    expect(lastBlock).toBe(30n);

    // Second poll using lastProcessedBlock+1 as fromBlock, currentBlock=60
    await listener.pollEvents(lastBlock + 1n);

    // Second call to getContractEvents should use fromBlock=31
    const secondCallArgs = getContractEvents.mock.calls[1][0];
    expect(secondCallArgs.fromBlock).toBe(31n);
    expect(secondCallArgs.toBlock).toBe(60n);

    const updatedLastBlock = (
      listener as unknown as { lastProcessedBlock: bigint }
    ).lastProcessedBlock;
    expect(updatedLastBlock).toBe(60n);
  });
});
