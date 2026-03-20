export const TASK_MANAGER_ABI = [
  // Functions
  {
    name: "createTask",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "taskHash", type: "bytes32" },
      { name: "taskURI", type: "string" },
      { name: "taskType", type: "bytes32" },
      { name: "agent", type: "address" },
      { name: "paymentToken", type: "address" },
      { name: "tokenAmount", type: "uint256" },
    ],
    outputs: [{ name: "taskId", type: "uint256" }],
  },
  {
    name: "submitResult",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "taskId", type: "uint256" },
      { name: "resultHash", type: "bytes32" },
      { name: "resultURI", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "dispute",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "taskId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "settle",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "taskId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "getTask",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "taskId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "taskHash", type: "bytes32" },
          { name: "taskType", type: "bytes32" },
          { name: "creator", type: "address" },
          { name: "agent", type: "address" },
          { name: "paymentToken", type: "address" },
          { name: "payment", type: "uint256" },
          { name: "resultHash", type: "bytes32" },
          { name: "submittedAt", type: "uint256" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
  },
  {
    name: "getTimeLockBlocks",
    type: "function",
    stateMutability: "pure",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "TIME_LOCK_BLOCKS",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  // Events
  {
    name: "TaskCreated",
    type: "event",
    inputs: [
      { name: "taskId", type: "uint256", indexed: true },
      { name: "taskType", type: "bytes32", indexed: true },
      { name: "taskHash", type: "bytes32", indexed: false },
      { name: "taskURI", type: "string", indexed: false },
      { name: "agent", type: "address", indexed: false },
      { name: "paymentToken", type: "address", indexed: false },
      { name: "payment", type: "uint256", indexed: false },
    ],
  },
  {
    name: "ResultSubmitted",
    type: "event",
    inputs: [
      { name: "taskId", type: "uint256", indexed: true },
      { name: "resultHash", type: "bytes32", indexed: false },
      { name: "resultURI", type: "string", indexed: false },
    ],
  },
  {
    name: "TaskSettled",
    type: "event",
    inputs: [{ name: "taskId", type: "uint256", indexed: true }],
  },
  {
    name: "TaskDisputed",
    type: "event",
    inputs: [{ name: "taskId", type: "uint256", indexed: true }],
  },
] as const;
