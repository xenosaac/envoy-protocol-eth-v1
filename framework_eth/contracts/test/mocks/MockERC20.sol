// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Standard ERC20 mock with 6 decimals and a public mint function.
contract MockERC20 is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice ERC20 mock that deducts a 1% fee on every transfer (fee stays in this contract).
contract MockFeeToken is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @dev Override _update to apply 1% fee. The fee amount is burned (sent to address(0) via
    ///      the internal _mint/burn path) or, more simply, just retained in the contract by
    ///      crediting it to address(this).  We keep it simple: fee stays in this contract.
    function _update(address from, address to, uint256 value) internal override {
        // No fee on mint or burn.
        if (from == address(0) || to == address(0)) {
            super._update(from, to, value);
            return;
        }

        uint256 fee = value / 100; // 1 %
        uint256 net = value - fee;

        // Transfer net amount to recipient.
        super._update(from, to, net);
        // Collect fee into this contract.
        super._update(from, address(this), fee);
    }
}
