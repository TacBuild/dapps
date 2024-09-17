// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;


/**
 * @title ITokenUtils
 * @dev An interface to message and Merkle tree utilitary functions
 */
interface ITokenUtils {
    /**
     * @dev Get address of Cross-Chain Layer token.
     * @param name ERC20 token name.
     * @param symbol ERC20 token symbol.
     * @param decimals ERC20 token decimals override.
     * @param l1Address Correspondent L1 token address.
     * @param l1AdditionalAddress Correspondent L1 additional (jetton) token address.
     * @param settingsAddress Settings address.
     * @param creatorAddress The address of token collection.
     */
    function computeAddress(
        string memory name,
        string memory symbol,
        uint8 decimals,
        string memory l1Address,
        string memory l1AdditionalAddress,
        address settingsAddress,
        address creatorAddress
    ) external pure returns (address);
}
