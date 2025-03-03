// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IPool {
    function newPool(
        address tokenX,
        address tokenY,
        uint24 fee,
        int24 currentPoint
    ) external returns (address);
}
