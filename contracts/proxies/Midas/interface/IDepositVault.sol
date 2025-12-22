// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./IManageableVault.sol";



/**
 * @title IDepositVault
 */
interface IDepositVault is IManageableVault {

    function depositInstant(
        address tokenIn,
        uint256 amountToken,
        uint256 minReceiveAmount,
        bytes32 referrerId
    ) external;

    function depositRequest(
        address tokenIn,
        uint256 amountToken,
        bytes32 referrerId
    ) external returns (uint256);

}
