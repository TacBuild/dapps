// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IMetaMorpho {
    function createMetaMorpho(address initialOwner, uint256 initialTimeLock, address asset, string memory name, string memory symbol, bytes32 salt) external returns (address);
}
