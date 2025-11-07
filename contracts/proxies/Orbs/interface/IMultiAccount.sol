// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IMultiAccount {
    function addAccount(string memory name) external;
    function editAccountName(address accountAddress, string memory name) external;
    function depositAndAllocateForAccount(address account, uint256 amount) external;
    function delegateAccesses(address account, address target, bytes4[] memory selector, bool state) external;
    function withdrawFromAccount(address account, uint256 amount) external;
    function depositForAccount(address account, uint256 amount) external;
}