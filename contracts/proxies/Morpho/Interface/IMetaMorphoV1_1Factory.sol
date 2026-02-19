// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IMetaMorphoV1_1Factory {
    function createMetaMorpho(address initialOwner, uint256 initialTimeLock, address asset, string memory name, string memory symbol, bytes32 salt) external returns (address);
    function isMetaMorpho(address vault) external view returns (bool);
}
