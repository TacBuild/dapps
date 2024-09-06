// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { TokenInfo, TokenAmount } from "contracts/L2/Structs.sol";


/**
 * @title ICrossChainLayerTokenManager
 * @dev A factory interface to deploy and manage new Cross-Chain Layer ERC20 tokens.
 */
interface ICrossChainLayerTokenManager {
    /**
    * @dev New CrossChainLayerToken contract was deployed
    * @param tokenAddress Token address
    * @param name Token name
    * @param symbol Token symbol
    */
    event TokenCreated(address tokenAddress, string name, string symbol);

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
