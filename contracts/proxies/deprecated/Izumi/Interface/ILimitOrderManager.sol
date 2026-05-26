// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ILimitOrderManager {
    struct AddLimOrderParam {
        address tokenX;
        address tokenY;
        uint24 fee;
        int24 pt;
        uint128 amount;
        bool sellXEarnY;
        uint256 deadline;
    }

    struct LimOrder {
    // total amount of earned token by all users at this point 
    // with same direction (sell x or sell y) as of the last update(add/dec)
    uint256 lastAccEarn;
    // initial amount of token on sale
    uint128 amount;
    // remaing amount of token on sale
    uint128 sellingRemain;
    // accumulated decreased token
    uint128 accSellingDec;
    // uncollected decreased token
    uint128 sellingDec;
    // uncollected earned token
    uint128 earn;
    // id of pool in which this liquidity is added
    uint128 poolId;
    // block.timestamp when add a limit order
    uint128 timestamp;
    // point (price) of limit order
    int24 pt;
    // direction of limit order (sellx or sell y)
    bool sellXEarnY;
    // active or not
    bool active;
}

    function decLimOrder(
        uint256 orderIdx,
        uint128 amount,
        uint256 deadline
    ) external returns (uint128 actualDelta);

    function collectLimOrder(
        address recipient,
        uint256 orderIdx,
        uint128 collectDec,
        uint128 collectEarn
    ) external returns (uint128 actualCollectDec, uint128 actualCollectEarn);

    function newLimOrder(
        uint256 idx,
        AddLimOrderParam calldata originAddLimitOrderParam
    ) external payable returns (
        uint128 orderAmount,
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

    function unwrapWETH9(uint256 minAmount, address recipient) external payable returns (uint256 amount);

    function sweepToken(
        address token,
        uint256 minAmount,
        address recipient
    ) external payable;
} 