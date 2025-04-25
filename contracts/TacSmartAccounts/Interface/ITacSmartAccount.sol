// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ITacSmartAccount {
    function execute(address target, uint256 value, bytes calldata data) external payable;
    function approve(address token, address spender, uint256 amount) external;
}
