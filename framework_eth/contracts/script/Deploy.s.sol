// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/TaskManager.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // Deploy TaskManager implementation
        TaskManager implementation = new TaskManager();

        // Deploy ERC1967Proxy pointing to the implementation
        bytes memory initData = abi.encodeWithSelector(
            TaskManager.initialize.selector,
            deployer
        );
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            initData
        );

        vm.stopBroadcast();

        // Log the addresses
        console.log("Implementation Address:", address(implementation));
        console.log("Proxy Address:", address(proxy));
        console.log("Owner:", deployer);
    }
}
