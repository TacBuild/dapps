// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.2 <0.9.0;

interface ITonToTacProxy {
    struct TransferParams {
        address token;
        uint256 amount;
    }
} 