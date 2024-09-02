// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { TransferHelper } from 'contracts/Helpers/TransferHelper.sol';

import { AppProxy } from "contracts/L2/AppProxy.sol";
import { OutMessage, TokenAmount } from "contracts/L2/Structs.sol";


interface ITwocryptoswapPool {
    /**
     * @notice Adds liquidity to the pool
     * @param amounts An array of two uint256 values representing the amounts of tokens to add
     * @param min_mint_amount Minimum amount of LP tokens to mint
     * @return uint256 Amount of LP tokens minted
     */
    function add_liquidity(
        uint256[2] calldata amounts,
        uint256 min_mint_amount
    ) external returns (uint256);

    function coins(
        uint256 arg0
    ) external returns (address);
}


/**
 * @title CurveLiteTwocryptoswapProxy
 * @dev Proxy contract CurveLite, working with pools contracts directly
 */
contract CurveLiteTwocryptoswapProxy is AppProxy {
    /**
     * @dev Constructor function to initialize the contract with initial state.
     * @param settingsAddress Settings address.
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
        address tokenA  = ITwocryptoswapPool(pool).coins(0);
        address tokenB  = ITwocryptoswapPool(pool).coins(1);


        // grant token approvals
        TransferHelper.safeApprove(tokenA, pool, amounts[0]);
        TransferHelper.safeApprove(tokenB, pool, amounts[1]);

        uint liquidity = ITwocryptoswapPool(pool).add_liquidity(
            [amounts[0],amounts[1]],
            minMintAmount
            );

        // tokens to L2->L1 transfer (burn)
        TokenAmount[] memory tokensToBurn = new TokenAmount[](2);

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

    
}
