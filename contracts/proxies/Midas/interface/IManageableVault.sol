// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IManageableVault {
   
    /**
     * @notice The mToken contract address.
     * @return The address of the mToken contract.
     */
    function mToken() external view returns (address);
}
