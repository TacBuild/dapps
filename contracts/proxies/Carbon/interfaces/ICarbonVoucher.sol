// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface ICarbonVoucher {
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
}