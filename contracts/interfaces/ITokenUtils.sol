// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;


/**
 * @title ITokenUtils
 * @dev An interface to message and Merkle tree utilitary functions
 */
interface ITokenUtils {
    /**
     * @dev Shoows the token axists or not.
     * @param tokenAddress L2 token address.
     */
    function exists(address tokenAddress) external view returns (bool);

    /**
     * @dev Get address of Cross-Chain Layer token.
     * @param l1Address Correspondent L1 token address.
     * @param settingsAddress Settings address.
     * @param creatorAddress The address of token collection.
     */
    function computeAddress(
        string memory l1Address,
        address settingsAddress,
        address creatorAddress
    ) external pure returns (address);
}
