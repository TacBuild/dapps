// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IFactory {
    function pool(address tokenX, address tokenY, uint24 fee) external view returns (address pool);
}