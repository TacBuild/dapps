// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ILimitOrderManager {
    struct AddLimOrderParam {
        address recipient;
        address tokenX;
        address tokenY;
        uint24 fee;
        int24 pt;
        bool isDesireMode;
        uint128 amount;
        uint256 swapMinAcquired;
        bool sellXEarnY;
        uint256 deadline;
    }

    struct LimOrder {
        uint256 lastAccEarn;
        uint128 initSellingAmount;
        uint128 sellingRemain;
        uint128 earn;
        uint128 poolId;
        uint128 timestamp;
        int24 pt;
        bool sellXEarnY;
        bool active;
    }

    function cancel(
        address recipient,
        uint256 orderIdx,
        uint256 deadline
    ) external;

    function collect(
        address recipient,
        uint256 orderIdx
    ) external returns (uint128 earn);

    function newLimOrder(
        uint256 idx,
        AddLimOrderParam calldata originAddLimitOrderParam
    ) external payable returns (
        uint128 orderAmount,
        uint128 costBeforeSwap,
        uint128 acquireBeforeSwap,
        uint128 acquire
    );

    function getActiveOrder(
        address user,
        uint256 idx
    ) external view returns (LimOrder memory limOrder);

    function poolMetas(uint128 poolId) external view returns (
        address tokenX,
        address tokenY,
        uint24 fee
    );
} 