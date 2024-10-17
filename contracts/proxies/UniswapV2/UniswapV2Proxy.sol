// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IUniswapV2Router02 } from '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import { TransferHelper } from '@uniswap/lib/contracts/libraries/TransferHelper.sol';

import { AppProxy } from "contracts/L2/AppProxy.sol";
import { OutMessage, TokenAmount } from "contracts/L2/Structs.sol";
import { UniswapV2Library } from "contracts/proxies/UniswapV2/CompilerVersionAdapters.sol";
import { ICrossChainLayer } from "contracts/interfaces/ICrossChainLayer.sol";


/**
 * @title UniswapV2Proxy
 * @dev Proxy contract UniswapV2, namely UniswapV2Router02
 */
contract UniswapV2Proxy is AppProxy {
    /**
     * @dev Constructor function to initialize the contract with initial state.
     * @param appAddress Application address.
     * @param settingsAddress Settings address.
     */
    constructor(address appAddress, address settingsAddress) AppProxy(appAddress, settingsAddress) {
    }

    /**
     * @dev A proxy to IUniswapV2Router02.addLiquidity(...).
     */
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) public {
        // grant token approvals
        TransferHelper.safeApprove(tokenA, _appAddress, amountADesired);
        TransferHelper.safeApprove(tokenB, _appAddress, amountBDesired);

        // proxy call
        (uint amountA, uint amountB, uint liquidity) = IUniswapV2Router02(_appAddress).addLiquidity(
            tokenA,
            tokenB,
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin,
            to,
            deadline
        );

        // tokens to L2->L1 transfer (burn)
        TokenAmount[] memory tokensToBurn = new TokenAmount[](2);
        tokensToBurn[0] = TokenAmount(tokenA, amountADesired - amountA);
        tokensToBurn[1] = TokenAmount(tokenB, amountBDesired - amountB);

        // tokens to L2->L1 transfer (lock)
        address tokenLiquidity = UniswapV2Library.pairFor(IUniswapV2Router02(_appAddress).factory(), tokenA, tokenB);
        TransferHelper.safeApprove(tokenLiquidity, getCrossChainLayerAddress(), liquidity);
        TokenAmount[] memory tokensToLock = new TokenAmount[](1);
        tokensToLock[0] = TokenAmount(tokenLiquidity, liquidity);

        // CCL L2->L1 callback
        OutMessage memory message = OutMessage({
            queryId: 0,
            operationId: 0,
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
     * @dev A proxy to IUniswapV2Router02.removeLiquidity(...).
     */
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) public {
        // grant token approvals
        address tokenLiquidity = UniswapV2Library.pairFor(IUniswapV2Router02(_appAddress).factory(), tokenA, tokenB);
        TransferHelper.safeApprove(tokenLiquidity, _appAddress, liquidity);

        // proxy call
        (uint amountA, uint amountB) = IUniswapV2Router02(_appAddress).removeLiquidity(
            tokenA,
            tokenB,
            liquidity,
            amountAMin,
            amountBMin,
            to,
            deadline
        );

        // tokens to L2->L1 transfer (burn)
        TokenAmount[] memory tokensToBurn = new TokenAmount[](2);
        tokensToBurn[0] = TokenAmount(tokenA, amountA);
        tokensToBurn[1] = TokenAmount(tokenB, amountB);

        // tokens to L2->L1 transfer (lock)
        TokenAmount[] memory tokensToLock = new TokenAmount[](0);

        // CCL L2->L1 callback
        OutMessage memory message = OutMessage({
            queryId: 0,
            operationId: 0,
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
     * @dev A proxy to IUniswapV2Router02.swapExactTokensForTokens(...).
     */
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) public {
        // grant token approvals
        TransferHelper.safeApprove(path[0], _appAddress, amountIn);

        // proxy call
        (uint[] memory amounts) = IUniswapV2Router02(_appAddress).swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            to,
            deadline
        );

        // tokens to L2->L1 transfer (burn)
        TokenAmount[] memory tokensToBurn = new TokenAmount[](1);
        tokensToBurn[0] = TokenAmount(path[path.length - 1], amounts[amounts.length - 1]);

        // tokens to L2->L1 transfer (lock)
        TokenAmount[] memory tokensToLock = new TokenAmount[](0);

        // CCL L2->L1 callback
        OutMessage memory message = OutMessage({
            queryId: 0,
            operationId: 0,
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
     * @dev A proxy to IUniswapV2Router02.swapTokensForExactTokens(...).
     */
    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) public {
        // grant token approvals
        TransferHelper.safeApprove(path[0], _appAddress, amountInMax);

        // proxy call
        (uint[] memory amounts) = IUniswapV2Router02(_appAddress).swapTokensForExactTokens(
            amountOut,
            amountInMax,
            path,
            to,
            deadline
        );

        // tokens to L2->L1 transfer (burn)
        TokenAmount[] memory tokensToBurn = new TokenAmount[](2);
        tokensToBurn[0] = TokenAmount(path[0], amountInMax - amounts[0]);
        tokensToBurn[1] = TokenAmount(path[path.length - 1], amounts[amounts.length - 1]);

        // tokens to L2->L1 transfer (lock)
        TokenAmount[] memory tokensToLock = new TokenAmount[](0);

        // CCL L2->L1 callback
        OutMessage memory message = OutMessage({
            queryId: 0,
            operationId: 0,
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
