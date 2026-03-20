import { describe, it, expect, vi, beforeEach } from "vitest";
import { keccak256 } from "viem";

// ---------------------------------------------------------------------------
// Mock viem at module level before the SDK is imported
// ---------------------------------------------------------------------------
const mockGetAddresses = vi.fn().mockResolvedValue(["0xAgentAddr"]);
const mockWriteContract = vi.fn().mockResolvedValue("0xTxHash");
const mockGetBlockNumber = vi.fn().mockResolvedValue(0n);
const mockGetContractEvents = vi.fn().mockResolvedValue([]);

vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      getBlockNumber: mockGetBlockNumber,
      getContractEvents: mockGetContractEvents,
    })),
    createWalletClient: vi.fn(() => ({
      getAddresses: mockGetAddresses,
      writeContract: mockWriteContract,
    })),
    http: vi.fn(() => "mock-transport"),
  };
});

vi.mock("viem/accounts", () => ({
  privateKeyToAccount: vi.fn(() => ({ address: "0xAgentAddr" })),
}));

// Import AFTER mocks are set up
import { EthBridgeSDK } from "../../src/EthBridgeSDK.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const TEST_CONFIG = {
  rpcUrl: "https://mainnet.example.com",
  contractAddress: "0x1234567890123456789012345678901234567890",
  privateKey:
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  chain: "ethereum" as const,
};

function makeSdk() {
  return new EthBridgeSDK(TEST_CONFIG);
}

// ---------------------------------------------------------------------------
// fetchTaskData
// ---------------------------------------------------------------------------
describe("EthBridgeSDK.fetchTaskData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAddresses.mockResolvedValue(["0xAgentAddr"]);
    mockWriteContract.mockResolvedValue("0xTxHash");
  });

  it("returns data when keccak256 hash matches", async () => {
    const data = new TextEncoder().encode("hello world");
    const correctHash = keccak256(data);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      statusText: "OK",
      arrayBuffer: vi.fn().mockResolvedValue(data.buffer),
    });

    const sdk = makeSdk();
    const result = await sdk.fetchTaskData("https://example.com/task", correctHash);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result).toEqual(data);
  });

  it("throws when hash does not match", async () => {
    const data = new TextEncoder().encode("real data");
    const wrongHash = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      statusText: "OK",
      arrayBuffer: vi.fn().mockResolvedValue(data.buffer),
    });

    const sdk = makeSdk();
    await expect(
      sdk.fetchTaskData("https://example.com/task", wrongHash)
    ).rejects.toThrow("Task data hash mismatch");
  });

  it("throws when fetch fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Not Found",
    });

    const sdk = makeSdk();
    await expect(
      sdk.fetchTaskData("https://example.com/missing", "0xabc")
    ).rejects.toThrow("Failed to fetch task data");
  });
});

// ---------------------------------------------------------------------------
// submitResult
// ---------------------------------------------------------------------------
describe("EthBridgeSDK.submitResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAddresses.mockResolvedValue(["0xAgentAddr"]);
    mockWriteContract.mockResolvedValue("0xSubmitTxHash");
  });

  it("calls writeContract with correct arguments", async () => {
    const sdk = makeSdk();
    const txHash = await sdk.submitResult(
      "7",
      "0xresulthash000000000000000000000000000000000000000000000000000000",
      "https://example.com/result"
    );

    expect(txHash).toBe("0xSubmitTxHash");
    expect(mockWriteContract).toHaveBeenCalledOnce();

    const args = mockWriteContract.mock.calls[0][0];
    expect(args.address).toBe(TEST_CONFIG.contractAddress);
    expect(args.functionName).toBe("submitResult");
    expect(args.args[0]).toBe(7n); // taskId as BigInt
    expect(args.args[1]).toBe(
      "0xresulthash000000000000000000000000000000000000000000000000000000"
    );
    expect(args.args[2]).toBe("https://example.com/result");
  });

  it("returns the transaction hash from writeContract", async () => {
    mockWriteContract.mockResolvedValue("0xDeadBeef");
    const sdk = makeSdk();
    const result = await sdk.submitResult("1", "0xhash", "https://uri");
    expect(result).toBe("0xDeadBeef");
  });
});

// ---------------------------------------------------------------------------
// settle
// ---------------------------------------------------------------------------
describe("EthBridgeSDK.settle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAddresses.mockResolvedValue(["0xAgentAddr"]);
    mockWriteContract.mockResolvedValue("0xSettleTxHash");
  });

  it("calls writeContract with correct arguments", async () => {
    const sdk = makeSdk();
    const txHash = await sdk.settle("42");

    expect(txHash).toBe("0xSettleTxHash");
    expect(mockWriteContract).toHaveBeenCalledOnce();

    const args = mockWriteContract.mock.calls[0][0];
    expect(args.address).toBe(TEST_CONFIG.contractAddress);
    expect(args.functionName).toBe("settle");
    expect(args.args[0]).toBe(42n); // taskId as BigInt
  });

  it("returns the transaction hash from writeContract", async () => {
    mockWriteContract.mockResolvedValue("0xCafeBabe");
    const sdk = makeSdk();
    const result = await sdk.settle("99");
    expect(result).toBe("0xCafeBabe");
  });
});
