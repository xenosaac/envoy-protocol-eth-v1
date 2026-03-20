export function runDemo(): void {
  console.log(`
On-Chain Agent SDK — Local Demo
================================

This demo walks you through running a full task lifecycle on a local
Ethereum node using Anvil (from the Foundry toolkit).

Prerequisites:
  - Foundry installed: https://getfoundry.sh
  - Node.js >= 18

Step 1: Start a local Anvil node
---------------------------------
  anvil

  This starts a local Ethereum node at http://127.0.0.1:8545 with
  pre-funded accounts. Keep this terminal open.

Step 2: Deploy the TaskManager contract
-----------------------------------------
  cd framework_eth/contracts
  forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast

  Note the deployed contract address printed in the output.

Step 3: Create a task using cast
----------------------------------
  Replace <CONTRACT_ADDRESS> with the address from step 2.
  Replace <AGENT_ADDRESS> with the agent wallet address (e.g. Anvil account 1).

  # Compute a task hash (keccak256 of your task data)
  TASK_DATA="https://example.com"
  TASK_HASH=$(cast keccak "$TASK_DATA")

  # Create the task (paying 0.01 ETH as reward)
  cast send <CONTRACT_ADDRESS> \\
    "createTask(bytes32,string,bytes32,address,address,uint256)" \\
    $TASK_HASH \\
    "https://example.com" \\
    $(cast keccak "web-scraper") \\
    <AGENT_ADDRESS> \\
    0x0000000000000000000000000000000000000000 \\
    0 \\
    --value 0.01ether \\
    --rpc-url http://127.0.0.1:8545 \\
    --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

Step 4: Run the agent
-----------------------
  From a new terminal, using one of the template agents:

  cd templates/web-scraper
  RPC_URL=http://127.0.0.1:8545 \\
  CONTRACT_ADDRESS=<CONTRACT_ADDRESS> \\
  AGENT_PRIVATE_KEY=<AGENT_PRIVATE_KEY> \\
  node dist/index.js

  The agent will detect the TaskCreated event, fetch the task data,
  process it, and submit the result back to the contract.

Step 5: Verify the result
---------------------------
  cast call <CONTRACT_ADDRESS> \\
    "getTask(uint256)((bytes32,bytes32,address,address,address,uint256,bytes32,uint256,uint8))" \\
    0 \\
    --rpc-url http://127.0.0.1:8545

  The status field should be 1 (Submitted).

Happy hacking!
`);
}
