// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ILucidlyQueue {
    function requestOnChainWithdraw(address assetOut, uint128 amountOfShares, uint16 discount, uint24 secondsToDeadline)
        external
        returns (bytes32 requestId);
}
