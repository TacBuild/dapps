// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title ITricryptoswapPool Interface
 * @notice This interface defines the core functionalities for a three-token liquidity pool in a CurveLite.
 * @dev Provides methods to add and remove liquidity, exchange tokens, and retrieve pool token addresses.
 */
interface ITricryptoswapPool {
    /**
     * @notice Adds liquidity to the pool
     * @param amounts An array of three uint256 values representing the amounts of tokens to add
     * @param min_mint_amount Minimum amount of LP tokens to mint
     * @return uint256 Amount of LP tokens received by the receiver
     */
    function add_liquidity(
        uint256[3] calldata amounts,
        uint256 min_mint_amount
    ) external returns (uint256);
    /**
     * @notice Removes liquidity to the pool
     * @param amount Amount of LP tokens to burn 
     * @param min_amounts Minimum amounts of tokens to withdraw
     * @return uint256[3] Amount of pool tokens received by the receiver
     */
    function remove_liquidity(
        uint256 amount,
        uint256[3] calldata min_amounts
    ) external returns (uint256[3] memory);
    /**
     * @notice Exchange tokens 
     * @param i Index value for the input coin
     * @param j Index value for the output coin
     * @param dx Amount of input coin being swapped in
     * @param min_dy Minimum amount of output coin to receive
     * @return uint256 Amount of tokens at index j received by the receiver
     */
    function exchange(
        uint256 i,
        uint256 j,
        uint256 dx,
        uint256 min_dy
    ) external returns (uint256);
    /**
     * @notice Get token address in pool by index
     * @param arg0 Token index
     * @return address Token address
     */
    function coins(
        uint256 arg0
    ) external view returns (address);
}