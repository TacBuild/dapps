// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ISwap {
    struct SwapAmountParams {
        bytes path;
        address recipient;
        uint128 amount;
        uint256 minAcquired;
        uint256 deadline;
    }

    struct SwapDesireParams {
        bytes path;
        address recipient;
        uint128 desire;
        uint256 maxPayed;
        uint256 deadline;
    }

    struct SwapParams {
        address tokenX;
        address tokenY;
        uint24 fee;
        int24 boundaryPt;
        address recipient;
        uint128 amount;
        uint256 maxPayed;
        uint256 minAcquired;
        uint256 deadline;
    }

    function swapAmount(SwapAmountParams calldata params) external payable returns (uint256 cost, uint256 acquire);
    
    function swapY2X(SwapParams calldata swapParams) external payable;
    
    function swapY2XDesireX(SwapParams calldata swapParams) external payable;
    
    function swapX2Y(SwapParams calldata swapParams) external payable;
    
    function swapX2YDesireY(SwapParams calldata swapParams) external payable;
    
    function swapDesire(SwapDesireParams calldata params) external payable returns (uint256 cost, uint256 acquire);
    
    function multicall(bytes[] calldata data) external payable returns (bytes[] memory results);
} 