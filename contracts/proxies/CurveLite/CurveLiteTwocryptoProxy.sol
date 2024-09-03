// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { TransferHelper } from 'contracts/helpers/TransferHelper.sol';
import { AppProxy } from "contracts/L2/AppProxy.sol";
import { OutMessage, TokenAmount } from "contracts/L2/Structs.sol";

/**
 * @title ITwocryptoswapPool Interface
 * @notice This interface defines the core functionalities for a two-token liquidity pool in a CurveLite.
 * @dev Provides methods to add and remove liquidity, exchange tokens, and retrieve pool token addresses.
 */
interface ITwocryptoswapPool {
    /**
     * @notice Adds liquidity to the pool
     * @param amounts An array of two uint256 values representing the amounts of tokens to add
     * @param min_mint_amount Minimum amount of LP tokens to mint
     * @return uint256 Amount of LP tokens received by the receiver
     */
    function add_liquidity(
        uint256[2] calldata amounts,
        uint256 min_mint_amount
    ) external returns (uint256);
    /**
     * @notice Removes liquidity to the pool
     * @param amount Amount of LP tokens to burn 
     * @param min_amounts Minimum amounts of tokens to withdraw
     * @return uint256[2] Amount of pool tokens received by the receiver
     */
    function remove_liquidity(
        uint256 amount,
        uint256[2] calldata min_amounts
    ) external returns (uint256[2] calldata);
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
    ) external returns (address);
}


/**
 * @title CurveLiteTwocryptoswapProxy
 * @dev Proxy contract CurveLite, working with twocryptoswap pools contracts directly
 */
contract CurveLiteTwocryptoswapProxy is AppProxy {
    /**
     * @dev Constructor function to initialize the contract with initial state. 
     * @param settingsAddress Settings address.
     * The decentralized application (dApp) operates as a dynamic pool
     * The initial parameter, appAddress, of the AppProxy is not required. Consequently, we assign an empty address to it.
     */
    constructor(address settingsAddress) AppProxy(address(0), settingsAddress) {
    }

    /**
     * @dev A proxy to addLiquidity
     */
    function addLiquidity(
        address pool,
        uint256[2] calldata amounts,
        uint256 minMintAmount
    ) public {
        // claim tokens addresses
        address tokenA = ITwocryptoswapPool(pool).coins(0);
        address tokenB = ITwocryptoswapPool(pool).coins(1);

        // grant token approvals
        TransferHelper.safeApprove(tokenA, pool, amounts[0]);
        TransferHelper.safeApprove(tokenB, pool, amounts[1]);

        uint liquidity = ITwocryptoswapPool(pool).add_liquidity(
            [amounts[0],amounts[1]],
            minMintAmount
        );

        // tokens to L2->L1 transfer (burn)
        TokenAmount[] memory tokensToBurn = new TokenAmount[](0);

        // tokens to L2->L1 transfer (lock)
        address tokenLiquidity = pool;
        TransferHelper.safeApprove(tokenLiquidity, getCrossChainLayerAddress(), liquidity);
        TokenAmount[] memory tokensToLock = new TokenAmount[](1);
        tokensToLock[0] = TokenAmount(tokenLiquidity, liquidity);

        // CCL L2->L1 callback
        OutMessage memory message = OutMessage({
            queryId: 0,
            timestamp: block.timestamp,
            target: "",
            methodName: "",
            arguments: new bytes(0),
            caller: address(this),
            burn: tokensToBurn,
            lock: tokensToLock
        });
        sendMessage(message);
    }

    /**
     * @dev A proxy to removeLiquidity
     */
    function removeLiquidity(
        address pool,
        uint256 amount,
        uint256[2] calldata min_amounts
        
    ) public {
        // claim tokens addresses
        address tokenA = ITwocryptoswapPool(pool).coins(0);
        address tokenB = ITwocryptoswapPool(pool).coins(1);
        address tokenLiquidity = pool;

        TransferHelper.safeApprove(tokenLiquidity, pool, amount);

        uint256[2] memory amounts = ITwocryptoswapPool(pool).remove_liquidity(
            amount,
            min_amounts
        );

        // tokens to L2->L1 transfer (burn)
        TokenAmount[] memory tokensToBurn = new TokenAmount[](2);
        tokensToBurn[0] = TokenAmount(tokenA, amounts[0]);
        tokensToBurn[1] = TokenAmount(tokenB, amounts[1]);

        // tokens to L2->L1 transfer (lock)
        TokenAmount[] memory tokensToLock = new TokenAmount[](0);

        // CCL L2->L1 callback
        OutMessage memory message = OutMessage({
            queryId: 0,
            timestamp: block.timestamp,
            target: "",
            methodName: "",
            arguments: new bytes(0),
            caller: address(this),
            burn: tokensToBurn,
            lock: tokensToLock
        });
        sendMessage(message);
    }

    /**
     * @dev A proxy to exchange
     */
    function exchange(
        address pool,
        uint256 i,
        uint256 j,
        uint256 dx,
        uint256 min_dy
        
    ) public {
        // claim tokens addresses
        address tokenIn = ITwocryptoswapPool(pool).coins(i);
        address tokenOut = ITwocryptoswapPool(pool).coins(j);

        // grant token approvals
        TransferHelper.safeApprove(tokenIn, pool, dx);

        uint256 amountOut = ITwocryptoswapPool(pool).exchange(
            i,
            j,
            dx,
            min_dy
        );

        // tokens to L2->L1 transfer (burn)
        TokenAmount[] memory tokensToBurn = new TokenAmount[](0);
        

        // tokens to L2->L1 transfer (lock)
        TokenAmount[] memory tokensToLock = new TokenAmount[](0);

        // CCL L2->L1 callback
        OutMessage memory message = OutMessage({
            queryId: 0,
            timestamp: block.timestamp,
            target: "",
            methodName: "",
            arguments: new bytes(0),
            caller: address(this),
            burn: tokensToBurn,
            lock: tokensToLock
        });
        sendMessage(message);
    }
    
}
