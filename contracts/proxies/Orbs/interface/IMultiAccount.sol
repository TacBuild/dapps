// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IMultiAccount {
    function addAccount(string memory name) external;
    function addAccountWithReferral(string memory name, address referrer) external;
    function addAccountWithReferralAndDepositAndAllocate(string memory name, address referrer, uint256 amount) external;
    function editAccountName(address accountAddress, string memory name) external;
    function depositAndAllocateForAccount(address account, uint256 amount) external;
    function delegateAccesses(address account, address target, bytes4[] memory selector, bool state) external;
    function withdrawFromAccount(address account, uint256 amount) external;
    function depositForAccount(address account, uint256 amount) external;
    function linkReferral(address referrer) external;
    event AddAccount(address user, address account, string name);
    event DepositForAccount(address user, address account, uint256 amount);
    event AllocateForAccount(address user, address account, uint256 amount);
}