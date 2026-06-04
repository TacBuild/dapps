// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface IZLSmartAccount {
    function execute(address target, uint256 value, bytes calldata data) external returns (bytes memory);
    function approve(address token, address spender, uint256 amount) external;
    function initialize(address _owner) external;
}