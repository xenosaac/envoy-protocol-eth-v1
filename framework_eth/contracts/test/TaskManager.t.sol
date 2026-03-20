// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/TaskManager.sol";
import "../src/interfaces/ITaskManager.sol";
import "./mocks/MockERC20.sol";

/// @dev Minimal V2 implementation used for upgrade tests.
contract TaskManagerV2 is TaskManager {
    function version() external pure returns (string memory) {
        return "v2";
    }
}

contract TaskManagerTest is Test {
    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    TaskManager internal impl;
    TaskManager internal tm;          // proxy cast to TaskManager
    ERC1967Proxy internal proxy;

    MockERC20    internal token;
    MockFeeToken internal feeToken;

    address internal owner   = makeAddr("owner");
    address internal creator = makeAddr("creator");
    address internal agent   = makeAddr("agent");
    address internal stranger = makeAddr("stranger");

    // Convenience constants
    bytes32 internal constant TASK_HASH = keccak256("task");
    bytes32 internal constant TASK_TYPE = keccak256("type");
    bytes32 internal constant RESULT_HASH = keccak256("result");
    string  internal constant TASK_URI   = "ipfs://task";
    string  internal constant RESULT_URI = "ipfs://result";
    uint256 internal constant ETH_PAYMENT  = 1 ether;
    uint256 internal constant TOKEN_AMOUNT = 1_000e6;

    // -------------------------------------------------------------------------
    // setUp
    // -------------------------------------------------------------------------

    function setUp() public {
        // Deploy implementation and proxy.
        impl = new TaskManager();
        bytes memory initData = abi.encodeCall(TaskManager.initialize, (owner));
        proxy = new ERC1967Proxy(address(impl), initData);
        tm = TaskManager(payable(address(proxy)));

        // Deploy tokens and fund creator.
        token    = new MockERC20("Mock USDC", "MUSDC");
        feeToken = new MockFeeToken("Fee Token", "FEE");

        token.mint(creator, 100_000e6);
        feeToken.mint(creator, 100_000e6);

        // Fund accounts with ETH.
        vm.deal(creator, 100 ether);
        vm.deal(agent,   10 ether);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    /// @dev Creator approves and creates an ETH task. Returns taskId.
    function _createEthTask() internal returns (uint256 taskId) {
        vm.prank(creator);
        taskId = tm.createTask{value: ETH_PAYMENT}(
            TASK_HASH, TASK_URI, TASK_TYPE, agent, address(0), 0
        );
    }

    /// @dev Creator approves and creates a token task. Returns taskId.
    function _createTokenTask() internal returns (uint256 taskId) {
        vm.startPrank(creator);
        token.approve(address(tm), TOKEN_AMOUNT);
        taskId = tm.createTask(
            TASK_HASH, TASK_URI, TASK_TYPE, agent, address(token), TOKEN_AMOUNT
        );
        vm.stopPrank();
    }

    /// @dev Agent submits a result for taskId.
    function _submitResult(uint256 taskId) internal {
        vm.prank(agent);
        tm.submitResult(taskId, RESULT_HASH, RESULT_URI);
    }

    // =========================================================================
    // createTask — ETH
    // =========================================================================

    function test_createTask_ETH_happyPath() public {
        uint256 taskId = _createEthTask();

        assertEq(taskId, 1);

        ITaskManager.TaskInfo memory info = tm.getTask(taskId);
        assertEq(info.creator,      creator);
        assertEq(info.agent,        agent);
        assertEq(info.paymentToken, address(0));
        assertEq(info.payment,      ETH_PAYMENT);
        assertEq(info.taskHash,     TASK_HASH);
        assertEq(info.taskType,     TASK_TYPE);
        assertEq(uint8(info.status), uint8(ITaskManager.TaskStatus.Created));
        assertEq(address(tm).balance, ETH_PAYMENT);
    }

    function test_createTask_ETH_zeroPaymentReverts() public {
        vm.prank(creator);
        vm.expectRevert("No payment");
        tm.createTask{value: 0}(TASK_HASH, TASK_URI, TASK_TYPE, agent, address(0), 0);
    }

    function test_createTask_ETH_zeroAgentReverts() public {
        vm.prank(creator);
        vm.expectRevert("Invalid agent");
        tm.createTask{value: ETH_PAYMENT}(TASK_HASH, TASK_URI, TASK_TYPE, address(0), address(0), 0);
    }

    function test_createTask_ETH_nonzeroTokenAmountReverts() public {
        vm.prank(creator);
        vm.expectRevert("tokenAmount must be 0 for ETH");
        tm.createTask{value: ETH_PAYMENT}(TASK_HASH, TASK_URI, TASK_TYPE, agent, address(0), 1);
    }

    function test_createTask_ETH_idIncrements() public {
        uint256 id1 = _createEthTask();
        uint256 id2 = _createEthTask();
        uint256 id3 = _createEthTask();

        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(id3, 3);
    }

    function test_createTask_ETH_emitsEvent() public {
        vm.expectEmit(true, true, false, true, address(tm));
        emit ITaskManager.TaskCreated(1, TASK_TYPE, TASK_HASH, TASK_URI, agent, address(0), ETH_PAYMENT);

        vm.prank(creator);
        tm.createTask{value: ETH_PAYMENT}(TASK_HASH, TASK_URI, TASK_TYPE, agent, address(0), 0);
    }

    // =========================================================================
    // createTask — ERC-20
    // =========================================================================

    function test_createTask_Token_happyPath() public {
        uint256 taskId = _createTokenTask();

        assertEq(taskId, 1);

        ITaskManager.TaskInfo memory info = tm.getTask(taskId);
        assertEq(info.paymentToken, address(token));
        assertEq(info.payment,      TOKEN_AMOUNT);
        assertEq(token.balanceOf(address(tm)), TOKEN_AMOUNT);
    }

    function test_createTask_Token_feeOnTransferRecordsActualAmount() public {
        uint256 sendAmount = 1_000e6;
        uint256 expectedNet = sendAmount - sendAmount / 100; // 1 % fee

        vm.startPrank(creator);
        feeToken.approve(address(tm), sendAmount);
        uint256 taskId = tm.createTask(
            TASK_HASH, TASK_URI, TASK_TYPE, agent, address(feeToken), sendAmount
        );
        vm.stopPrank();

        ITaskManager.TaskInfo memory info = tm.getTask(taskId);
        assertEq(info.payment, expectedNet, "payment should reflect post-fee balance");
    }

    function test_createTask_Token_ethSentWithTokenReverts() public {
        vm.startPrank(creator);
        token.approve(address(tm), TOKEN_AMOUNT);
        vm.expectRevert("ETH sent with token payment");
        tm.createTask{value: 0.1 ether}(
            TASK_HASH, TASK_URI, TASK_TYPE, agent, address(token), TOKEN_AMOUNT
        );
        vm.stopPrank();
    }

    function test_createTask_Token_zeroAmountReverts() public {
        vm.startPrank(creator);
        token.approve(address(tm), TOKEN_AMOUNT);
        vm.expectRevert("No payment");
        tm.createTask(TASK_HASH, TASK_URI, TASK_TYPE, agent, address(token), 0);
        vm.stopPrank();
    }

    // =========================================================================
    // submitResult
    // =========================================================================

    function test_submitResult_happyPath() public {
        uint256 taskId = _createEthTask();
        uint256 blockBefore = block.number;

        vm.prank(agent);
        tm.submitResult(taskId, RESULT_HASH, RESULT_URI);

        ITaskManager.TaskInfo memory info = tm.getTask(taskId);
        assertEq(info.resultHash,  RESULT_HASH);
        assertEq(info.submittedAt, blockBefore);
        assertEq(uint8(info.status), uint8(ITaskManager.TaskStatus.Submitted));
    }

    function test_submitResult_emitsEvent() public {
        uint256 taskId = _createEthTask();

        vm.expectEmit(true, false, false, true, address(tm));
        emit ITaskManager.ResultSubmitted(taskId, RESULT_HASH, RESULT_URI);

        vm.prank(agent);
        tm.submitResult(taskId, RESULT_HASH, RESULT_URI);
    }

    function test_submitResult_unauthorizedReverts() public {
        uint256 taskId = _createEthTask();

        vm.prank(stranger);
        vm.expectRevert("Unauthorized");
        tm.submitResult(taskId, RESULT_HASH, RESULT_URI);
    }

    function test_submitResult_invalidTaskReverts() public {
        vm.prank(agent);
        vm.expectRevert("Task not found");
        tm.submitResult(999, RESULT_HASH, RESULT_URI);
    }

    function test_submitResult_doubleSubmitReverts() public {
        uint256 taskId = _createEthTask();
        _submitResult(taskId);

        vm.prank(agent);
        vm.expectRevert("Invalid status");
        tm.submitResult(taskId, RESULT_HASH, RESULT_URI);
    }

    // =========================================================================
    // dispute
    // =========================================================================

    function test_dispute_ETH_happyPath() public {
        uint256 taskId = _createEthTask();
        _submitResult(taskId);

        uint256 creatorBefore = creator.balance;

        vm.prank(creator);
        tm.dispute(taskId);

        ITaskManager.TaskInfo memory info = tm.getTask(taskId);
        assertEq(uint8(info.status), uint8(ITaskManager.TaskStatus.Disputed));
        assertEq(creator.balance, creatorBefore + ETH_PAYMENT);
        assertEq(address(tm).balance, 0);
    }

    function test_dispute_ETH_emitsEvent() public {
        uint256 taskId = _createEthTask();
        _submitResult(taskId);

        vm.expectEmit(true, false, false, false, address(tm));
        emit ITaskManager.TaskDisputed(taskId);

        vm.prank(creator);
        tm.dispute(taskId);
    }

    function test_dispute_Token_refund() public {
        uint256 taskId = _createTokenTask();
        _submitResult(taskId);

        uint256 creatorBefore = token.balanceOf(creator);

        vm.prank(creator);
        tm.dispute(taskId);

        ITaskManager.TaskInfo memory info = tm.getTask(taskId);
        assertEq(uint8(info.status), uint8(ITaskManager.TaskStatus.Disputed));
        assertEq(token.balanceOf(creator), creatorBefore + TOKEN_AMOUNT);
    }

    function test_dispute_unauthorizedReverts() public {
        uint256 taskId = _createEthTask();
        _submitResult(taskId);

        vm.prank(stranger);
        vm.expectRevert("Unauthorized");
        tm.dispute(taskId);
    }

    function test_dispute_afterWindowReverts() public {
        uint256 taskId = _createEthTask();
        _submitResult(taskId);

        // Roll past the time-lock window.
        vm.roll(block.number + tm.getTimeLockBlocks() + 1);

        vm.prank(creator);
        vm.expectRevert("Dispute window closed");
        tm.dispute(taskId);
    }

    function test_dispute_noResultReverts() public {
        uint256 taskId = _createEthTask();

        vm.prank(creator);
        vm.expectRevert("Invalid status");
        tm.dispute(taskId);
    }

    function test_dispute_alreadyDisputedReverts() public {
        uint256 taskId = _createEthTask();
        _submitResult(taskId);

        vm.prank(creator);
        tm.dispute(taskId);

        vm.prank(creator);
        vm.expectRevert("Invalid status");
        tm.dispute(taskId);
    }

    // =========================================================================
    // settle
    // =========================================================================

    function test_settle_ETH_happyPath() public {
        uint256 taskId = _createEthTask();
        _submitResult(taskId);

        // Roll past the time-lock.
        vm.roll(block.number + tm.getTimeLockBlocks() + 1);

        uint256 agentBefore = agent.balance;

        tm.settle(taskId);

        ITaskManager.TaskInfo memory info = tm.getTask(taskId);
        assertEq(uint8(info.status), uint8(ITaskManager.TaskStatus.Settled));
        assertEq(agent.balance, agentBefore + ETH_PAYMENT);
        assertEq(address(tm).balance, 0);
    }

    function test_settle_ETH_emitsEvent() public {
        uint256 taskId = _createEthTask();
        _submitResult(taskId);

        vm.roll(block.number + tm.getTimeLockBlocks() + 1);

        vm.expectEmit(true, false, false, false, address(tm));
        emit ITaskManager.TaskSettled(taskId);

        tm.settle(taskId);
    }

    function test_settle_Token_happyPath() public {
        uint256 taskId = _createTokenTask();
        _submitResult(taskId);

        vm.roll(block.number + tm.getTimeLockBlocks() + 1);

        uint256 agentBefore = token.balanceOf(agent);

        tm.settle(taskId);

        assertEq(token.balanceOf(agent), agentBefore + TOKEN_AMOUNT);
    }

    function test_settle_beforeTimelockReverts() public {
        uint256 taskId = _createEthTask();
        _submitResult(taskId);

        // Still within the time-lock window — roll to exactly the boundary.
        vm.roll(block.number + tm.getTimeLockBlocks());

        vm.expectRevert("Time lock active");
        tm.settle(taskId);
    }

    function test_settle_alreadySettledReverts() public {
        uint256 taskId = _createEthTask();
        _submitResult(taskId);

        vm.roll(block.number + tm.getTimeLockBlocks() + 1);
        tm.settle(taskId);

        vm.expectRevert("Invalid status");
        tm.settle(taskId);
    }

    function test_settle_disputedTaskReverts() public {
        uint256 taskId = _createEthTask();
        _submitResult(taskId);

        vm.prank(creator);
        tm.dispute(taskId);

        vm.roll(block.number + tm.getTimeLockBlocks() + 1);

        vm.expectRevert("Invalid status");
        tm.settle(taskId);
    }

    function test_settle_noResultReverts() public {
        uint256 taskId = _createEthTask();

        vm.roll(block.number + tm.getTimeLockBlocks() + 1);

        vm.expectRevert("Invalid status");
        tm.settle(taskId);
    }

    // =========================================================================
    // State machine transitions
    // =========================================================================

    function test_stateMachine_createdToSubmittedToSettled() public {
        uint256 taskId = _createEthTask();

        ITaskManager.TaskInfo memory info = tm.getTask(taskId);
        assertEq(uint8(info.status), uint8(ITaskManager.TaskStatus.Created));

        _submitResult(taskId);
        info = tm.getTask(taskId);
        assertEq(uint8(info.status), uint8(ITaskManager.TaskStatus.Submitted));

        vm.roll(block.number + tm.getTimeLockBlocks() + 1);
        tm.settle(taskId);
        info = tm.getTask(taskId);
        assertEq(uint8(info.status), uint8(ITaskManager.TaskStatus.Settled));
    }

    function test_stateMachine_createdToSubmittedToDisputed() public {
        uint256 taskId = _createEthTask();
        _submitResult(taskId);

        vm.prank(creator);
        tm.dispute(taskId);

        ITaskManager.TaskInfo memory info = tm.getTask(taskId);
        assertEq(uint8(info.status), uint8(ITaskManager.TaskStatus.Disputed));
    }

    function test_stateMachine_cannotSettleFromCreated() public {
        uint256 taskId = _createEthTask();
        vm.roll(block.number + tm.getTimeLockBlocks() + 1);

        vm.expectRevert("Invalid status");
        tm.settle(taskId);
    }

    function test_stateMachine_cannotDisputeFromCreated() public {
        uint256 taskId = _createEthTask();

        vm.prank(creator);
        vm.expectRevert("Invalid status");
        tm.dispute(taskId);
    }

    function test_stateMachine_cannotDisputeFromSettled() public {
        uint256 taskId = _createEthTask();
        _submitResult(taskId);

        vm.roll(block.number + tm.getTimeLockBlocks() + 1);
        tm.settle(taskId);

        vm.prank(creator);
        vm.expectRevert("Invalid status");
        tm.dispute(taskId);
    }

    // =========================================================================
    // UUPS upgrades
    // =========================================================================

    function test_upgrade_ownerCanUpgrade() public {
        TaskManagerV2 implV2 = new TaskManagerV2();

        vm.prank(owner);
        tm.upgradeToAndCall(address(implV2), "");

        // After upgrade the proxy code points to V2; cast and call new function.
        TaskManagerV2 tmV2 = TaskManagerV2(payable(address(proxy)));
        assertEq(tmV2.version(), "v2");
    }

    function test_upgrade_nonOwnerReverts() public {
        TaskManagerV2 implV2 = new TaskManagerV2();

        vm.prank(stranger);
        vm.expectRevert();
        tm.upgradeToAndCall(address(implV2), "");
    }

    function test_upgrade_statePreservedAfterUpgrade() public {
        // Create a task before upgrade.
        uint256 taskId = _createEthTask();

        TaskManagerV2 implV2 = new TaskManagerV2();
        vm.prank(owner);
        tm.upgradeToAndCall(address(implV2), "");

        // State should still be accessible.
        ITaskManager.TaskInfo memory info = tm.getTask(taskId);
        assertEq(info.creator,  creator);
        assertEq(info.payment,  ETH_PAYMENT);
        assertEq(uint8(info.status), uint8(ITaskManager.TaskStatus.Created));
    }

    // =========================================================================
    // getTimeLockBlocks
    // =========================================================================

    function test_getTimeLockBlocks_returnsConstant() public view {
        assertEq(tm.getTimeLockBlocks(), 300);
    }
}
