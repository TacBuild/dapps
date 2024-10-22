// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { TokenInfo } from "contracts/L2/Structs.sol";


/**
 * @title ITokenCollection
 * @dev A factory interface to deploy and manage new Cross-Chain Layer ERC20 tokens.
 */
interface ITokenCollection {
    /**
    * @dev New Cross-Chain Layer token contract was deployed
    * @param l2Address Token address
    * @param name Token name
    * @param symbol Token symbol
    */
    event TokenCreated(address l2Address, string name, string symbol);

    /**
     * @dev Deploy new Cross-Chain Layer token.
     * @param info CCL token info.
     */
    function deployToken(TokenInfo calldata info) external returns (address);

    /**
     * @dev Returns the address Cross-Chain Layer token by its index.
     * @param tokenIndex Token index.
     */
    function getTokenAddress(uint64 tokenIndex) external view returns (address);

    /**
     * @dev Returns total L1 token deployed on L2.
     */
    function totalTokens() external view returns (uint64);
}
