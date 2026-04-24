// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IParlayCore {
    function claimPayout(uint256 tokenId) external;
    function placeBet(
        string calldata assetId,
        uint8 row,
        uint8 column,
        uint64 expiresAt,
        uint256 multiplier,
        uint256 amount
    ) external returns (uint256 tokenId);
}