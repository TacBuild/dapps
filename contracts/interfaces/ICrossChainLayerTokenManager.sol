// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { TokenInfo, TokenAmount } from "contracts/L2/Structs.sol";


/**
 * @title ICrossChainLayerTokenManager
 * @dev A factory interface to deploy and manage new Cross-Chain Layer ERC20 tokens.
 */
interface ICrossChainLayerTokenManager {
    /**
     * @dev Returns current status of Cross-Chain Layer token.
     * @param tokenAddress Token address.
     */
    function getTokenInfo(address tokenAddress) external view returns (TokenInfo memory);

    /**
     * @dev Returns total L1 token deployed on L2.
     */
    function totalTokens() external view returns (uint64);
}
