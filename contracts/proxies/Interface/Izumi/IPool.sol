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
}
