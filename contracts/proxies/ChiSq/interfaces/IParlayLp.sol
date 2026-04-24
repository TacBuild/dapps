// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IParlayLp {
    function addLiquidity(uint256 amount) external;
    function withdrawLiquidity(uint256 amount) external;
}