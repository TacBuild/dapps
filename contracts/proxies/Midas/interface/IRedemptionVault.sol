// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./IManageableVault.sol";

interface IRedemptionVault is IManageableVault {
    
    function redeemInstant(
        address tokenOut,
        uint256 amountMTokenIn,
        uint256 minReceiveAmount
    ) external;

    function redeemRequest(address tokenOut, uint256 amountMTokenIn)
        external
        returns (uint256);
}
