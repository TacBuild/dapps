// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IREUL {
    function depositFor(address account, uint256 amount) external returns (bool);
    function withdrawTo(address account, uint256 amount) external returns (bool);
    function underlying() external view returns (address);
    function withdrawToByLockTimestamp(address account, uint256 lockTimestamp, uint256 amount) external returns (bool);
    function withdrawToByLockTimestamps(address account, uint256[] calldata lockTimestamps, uint256 amount) external returns (bool);
}