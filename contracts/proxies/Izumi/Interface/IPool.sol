// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IPool {
    event NewPool(
        address indexed tokenX,
        address indexed tokenY,
        uint24 indexed fee,
        uint24 pointDelta,
        address pool
    );

    struct State {
    // a 96 fixpoing number describe the sqrt value of current price(tokenX/tokenY)
    uint160 sqrtPrice_96;
    // The current point of the pool, 1.0001 ^ currentPoint = price
    int24 currentPoint;
    // The index of the last oracle observation that was written,
    uint16 observationCurrentIndex;
    // The current maximum number of observations stored in the pool,
    uint16 observationQueueLen;
    // The next maximum number of observations, to be updated when the observation.
    uint16 observationNextQueueLen;
    // whether the pool is locked (only used for checking reentrance)
    bool locked;
    // total liquidity on the currentPoint (currX * sqrtPrice + currY / sqrtPrice)
    uint128 liquidity;
    // liquidity of tokenX, liquidity of tokenY is liquidity - liquidityX
    uint128 liquidityX;
}

    function newPool(
        address tokenX,
        address tokenY,
        uint24 fee,
        int24 currentPoint
    ) external returns (address addr);

    function pool(
        address tokenX,
        address tokenY,
        uint24 fee
    ) external view returns (address);

    function fee2pointDelta(uint24 fee) external view returns (int24);

    function state() external view returns (State memory);


}
