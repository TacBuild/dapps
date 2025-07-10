// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IREUL {
    function depositFor(address account, uint256 amount) external returns (bool);
    function withdrawTo(address account, uint256 amount) external returns (bool);
    function underlying() external view returns (address);
    function withdrawToByLockTimestamp(address account, uint256 lockTimestamp, bool allowRemainderLoss) external returns (bool);
    function withdrawToByLockTimestamps(address account, uint256[] memory lockTimestamps, bool allowRemainderLoss) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function getLockedAmounts(address account) external view returns (uint256[] memory, uint256[] memory);
    function getWithdrawAmountsByLockTimestamp(address account, uint256 lockTimestamp)
        external
        view
        returns (uint256 accountAmount, uint256 reminderAmount);
}