// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IUniswapV2Router02 } from '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import { TransferHelper } from '@uniswap/lib/contracts/libraries/TransferHelper.sol';

import { AppProxy } from "contracts/L2/AppProxy.sol";
import { OutMessage, TokenAmount, TacHeader } from "tac-l2-ccl/contracts/L2/Structs.sol";
import { UniswapV2Library } from "contracts/proxies/UniswapV2/CompilerVersionAdapters.sol";
import { ICrossChainLayer } from "tac-l2-ccl/contracts/interfaces/ICrossChainLayer.sol";


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
        TacHeader calldata header,
        bytes calldata payload
    ) public {
        (
            address tokenA,
            address tokenB,
            uint amountADesired,
            uint amountBDesired,
            uint amountAMin,
            uint amountBMin,
            address to,
            uint deadline
        ) = abi.decode(payload, (address, address, uint, uint, uint, uint, address, uint));
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

        // bridge remaining tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](2);
        tokensToBridge[0] = TokenAmount(tokenA, amountADesired - amountA);
        tokensToBridge[1] = TokenAmount(tokenB, amountBDesired - amountB);
        // bridge LP tokens to TON
        address tokenLiquidity = UniswapV2Library.pairFor(IUniswapV2Router02(_appAddress).factory(), tokenA, tokenB);
        tokensToBridge[0] = TokenAmount(tokenLiquidity, liquidity);

        TransferHelper.safeApprove(tokenLiquidity, getCrossChainLayerAddress(), liquidity);
        TransferHelper.safeApprove(tokenA, getCrossChainLayerAddress(), amountADesired - amountA);
        TransferHelper.safeApprove(tokenB, getCrossChainLayerAddress(), amountBDesired - amountB);

        // CCL TAC->TON callback
        OutMessage memory message = OutMessage({
            queryId: header.queryId,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });
        sendMessage(message);
    }

    /**
     * @dev A proxy to IUniswapV2Router02.removeLiquidity(...).
     */
    function removeLiquidity(
        TacHeader calldata header,
        bytes calldata payload
    ) public {
        (
            address tokenA,
            address tokenB,
            uint liquidity,
            uint amountAMin,
            uint amountBMin,
            address to,
            uint deadline
        ) = abi.decode(payload, (address, address, uint, uint, uint, address, uint));
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

        // bridge tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](2);
        tokensToBridge[0] = TokenAmount(tokenA, amountA);
        tokensToBridge[1] = TokenAmount(tokenB, amountB);

        TransferHelper.safeApprove(tokenA, getCrossChainLayerAddress(), amountA);
        TransferHelper.safeApprove(tokenB, getCrossChainLayerAddress(), amountB);

        // CCL TAC->TON callback
        OutMessage memory message = OutMessage({
            queryId: header.queryId,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });
        sendMessage(message);
    }

    /**
     * @dev A proxy to IUniswapV2Router02.swapExactTokensForTokens(...).
     */
    function swapExactTokensForTokens(
        TacHeader calldata header,
        bytes calldata payload
    ) public {
        (
            uint amountIn,
            uint amountOutMin,
            address[] memory path,
            address to,
            uint deadline
        ) = abi.decode(payload, (uint, uint, address[], address, uint));
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

        // bridge tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(path[path.length - 1], amounts[amounts.length - 1]);

        TransferHelper.safeApprove(path[path.length - 1], getCrossChainLayerAddress(), amounts[amounts.length - 1]);

        // CCL TAC->TON callback
        OutMessage memory message = OutMessage({
            queryId: header.queryId,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });
        sendMessage(message);
    }

    /**
     * @dev A proxy to IUniswapV2Router02.swapTokensForExactTokens(...).
     */
    function swapTokensForExactTokens(
        TacHeader calldata header,
        bytes calldata payload
    ) public {
        (
            uint amountOut,
            uint amountInMax,
            address[] memory path,
            address to,
            uint deadline
        ) = abi.decode(payload, (uint, uint, address[], address, uint));
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

        // bridge tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](2);
        tokensToBridge[0] = TokenAmount(path[0], amountInMax - amounts[0]);
        tokensToBridge[1] = TokenAmount(path[path.length - 1], amounts[amounts.length - 1]);

        TransferHelper.safeApprove(path[0], getCrossChainLayerAddress(), amountInMax - amounts[0]);
        TransferHelper.safeApprove(path[path.length - 1], getCrossChainLayerAddress(), amounts[amounts.length - 1]);

        // CCL TAC->TON callback
        OutMessage memory message = OutMessage({
            queryId: header.queryId,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });
        sendMessage(message);
    }
}
