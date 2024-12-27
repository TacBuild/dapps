// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IUniswapV2Router02 } from '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import { TransferHelper } from '@uniswap/lib/contracts/libraries/TransferHelper.sol';

import { AppProxy } from "contracts/L2/AppProxy.sol";
import { OutMessage, TokenAmount, TacHeaderV1 } from "tac-l2-ccl/contracts/L2/Structs.sol";
import { UniswapV2Library } from "contracts/proxies/UniswapV2/CompilerVersionAdapters.sol";
import { ICrossChainLayer } from "tac-l2-ccl/contracts/interfaces/ICrossChainLayer.sol";

struct AddLiquidityArguments {
    address tokenA;
    address tokenB;
    uint amountADesired;
    uint amountBDesired;
    uint amountAMin;
    uint amountBMin;
    address to;
    uint deadline;
}

struct RemoveLiquidityArguments {
    address tokenA;
    address tokenB;
    uint liquidity;
    uint amountAMin;
    uint amountBMin;
    address to;
    uint deadline;
}

struct SwapExactTokensForTokensArguments {
    uint amountIn;
    uint amountOutMin;
    address[] path;
    address to;
    uint deadline;
}

struct SwapTokensForExactTokensArguments {
    uint amountOut;
    uint amountInMax;
    address[] path;
    address to;
    uint deadline;
}


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

    function _addLiquidity(
        AddLiquidityArguments memory arguments
    ) internal returns (TokenAmount[] memory) {
        // grant token approvals
        TransferHelper.safeApprove(arguments.tokenA, _appAddress, arguments.amountADesired);
        TransferHelper.safeApprove(arguments.tokenB, _appAddress, arguments.amountBDesired);

        // proxy call
        (uint amountA, uint amountB, uint liquidity) = IUniswapV2Router02(_appAddress).addLiquidity(
            arguments.tokenA,
            arguments.tokenB,
            arguments.amountADesired,
            arguments.amountBDesired,
            arguments.amountAMin,
            arguments.amountBMin,
            arguments.to,
            arguments.deadline
        );

        // bridge remaining tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](3);
        tokensToBridge[0] = TokenAmount(arguments.tokenA, arguments.amountADesired - amountA);
        tokensToBridge[1] = TokenAmount(arguments.tokenB, arguments.amountBDesired - amountB);
        // bridge LP tokens to TON
        address tokenLiquidity = UniswapV2Library.pairFor(IUniswapV2Router02(_appAddress).factory(), arguments.tokenA, arguments.tokenB);
        tokensToBridge[2] = TokenAmount(tokenLiquidity, liquidity);

        return tokensToBridge;
    }

    /**
     * @dev A proxy to IUniswapV2Router02.addLiquidity(...).
     */
    function addLiquidity(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public {

        AddLiquidityArguments memory args = abi.decode(arguments, (AddLiquidityArguments));
        TokenAmount[] memory tokensToBridge = _addLiquidity(args);

        uint i;
        for (; i < tokensToBridge.length;) {
            TransferHelper.safeApprove(tokensToBridge[i].l2Address, getCrossChainLayerAddress(), tokensToBridge[i].amount);
            unchecked {
                i++;
            }
        }

        // CCL TAC->TON callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessage memory message = OutMessage({
            queryId: header.queryId,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });
        sendMessage(message);
    }

    function _removeLiquidity(
        RemoveLiquidityArguments memory arguments
    ) internal returns (TokenAmount[] memory) {

        // grant token approvals
        address tokenLiquidity = UniswapV2Library.pairFor(IUniswapV2Router02(_appAddress).factory(), arguments.tokenA, arguments.tokenB);
        TransferHelper.safeApprove(tokenLiquidity, _appAddress, arguments.liquidity);

        // proxy call
        (uint amountA, uint amountB) = IUniswapV2Router02(_appAddress).removeLiquidity(
            arguments.tokenA,
            arguments.tokenB,
            arguments.liquidity,
            arguments.amountAMin,
            arguments.amountBMin,
            arguments.to,
            arguments.deadline
        );

        // bridge tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](2);
        tokensToBridge[0] = TokenAmount(arguments.tokenA, amountA);
        tokensToBridge[1] = TokenAmount(arguments.tokenB, amountB);

        return tokensToBridge;
    }

    /**
     * @dev A proxy to IUniswapV2Router02.removeLiquidity(...).
     */
    function removeLiquidity(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public {

        RemoveLiquidityArguments memory args = abi.decode(arguments, (RemoveLiquidityArguments));
        TokenAmount[] memory tokensToBridge = _removeLiquidity(args);

        uint i;
        for (; i < tokensToBridge.length;) {
            TransferHelper.safeApprove(tokensToBridge[i].l2Address, getCrossChainLayerAddress(), tokensToBridge[i].amount);
            unchecked {
                i++;
            }
        }

        // CCL TAC->TON callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessage memory message = OutMessage({
            queryId: header.queryId,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });
        sendMessage(message);
    }

    function _swapExactTokensForTokens(
        SwapExactTokensForTokensArguments memory arguments
    ) internal returns (TokenAmount[] memory) {

        // grant token approvals
        TransferHelper.safeApprove(arguments.path[0], _appAddress, arguments.amountIn);

        // proxy call
        (uint[] memory amounts) = IUniswapV2Router02(_appAddress).swapExactTokensForTokens(
            arguments.amountIn,
            arguments.amountOutMin,
            arguments.path,
            arguments.to,
            arguments.deadline
        );

        // bridge tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(arguments.path[arguments.path.length - 1], amounts[amounts.length - 1]);

        return tokensToBridge;
    }

    /**
     * @dev A proxy to IUniswapV2Router02.swapExactTokensForTokens(...).
     */
    function swapExactTokensForTokens(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public {

        SwapExactTokensForTokensArguments memory args = abi.decode(arguments, (SwapExactTokensForTokensArguments));
        TokenAmount[] memory tokensToBridge = _swapExactTokensForTokens(args);

        uint i;
        for (; i < tokensToBridge.length;) {
            TransferHelper.safeApprove(tokensToBridge[i].l2Address, getCrossChainLayerAddress(), tokensToBridge[i].amount);
            unchecked {
                i++;
            }
        }

        // CCL TAC->TON callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessage memory message = OutMessage({
            queryId: header.queryId,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });
        sendMessage(message);
    }

    function _swapTokensForExactTokens(
        SwapTokensForExactTokensArguments memory arguments
    ) internal returns (TokenAmount[] memory) {
        // grant token approvals
        TransferHelper.safeApprove(arguments.path[0], _appAddress, arguments.amountInMax);

        // proxy call
        (uint[] memory amounts) = IUniswapV2Router02(_appAddress).swapTokensForExactTokens(
            arguments.amountOut,
            arguments.amountInMax,
            arguments.path,
            arguments.to,
            arguments.deadline
        );

        // bridge tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](2);
        tokensToBridge[0] = TokenAmount(arguments.path[0], arguments.amountInMax - amounts[0]);
        tokensToBridge[1] = TokenAmount(arguments.path[arguments.path.length - 1], amounts[amounts.length - 1]);

        return tokensToBridge;
    }

    /**
     * @dev A proxy to IUniswapV2Router02.swapTokensForExactTokens(...).
     */
    function swapTokensForExactTokens(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public {

        SwapTokensForExactTokensArguments memory args = abi.decode(arguments, (SwapTokensForExactTokensArguments));
        TokenAmount[] memory tokensToBridge = _swapTokensForExactTokens(args);

        uint i;
        for (; i < tokensToBridge.length;) {
            TransferHelper.safeApprove(tokensToBridge[i].l2Address, getCrossChainLayerAddress(), tokensToBridge[i].amount);
            unchecked {
                i++;
            }
        }

        // CCL TAC->TON callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessage memory message = OutMessage({
            queryId: header.queryId,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });
        sendMessage(message);
    }
}
