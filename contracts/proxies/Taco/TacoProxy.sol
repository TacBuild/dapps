// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IUniswapV2Router02 } from '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import { TransferHelper } from '@uniswap/lib/contracts/libraries/TransferHelper.sol';

import { AppProxy } from "contracts/L2/AppProxy.sol";
import { OutMessage, TokenAmount } from "tac-l2-ccl/contracts/L2/Structs.sol";
import { UniswapV2Library } from "contracts/proxies/UniswapV2/CompilerVersionAdapters.sol";
import { ICrossChainLayer } from "tac-l2-ccl/contracts/interfaces/ICrossChainLayer.sol";

/**
 * @title IDODOV2Proxy01 Interface (from https://github.com/DODOEX/contractV2)
 */
interface IDODOV2 {
    function _BASE_TOKEN_() external view returns (address);
    function _QUOTE_TOKEN_() external view returns (address);
}

/**
 * @title IDODOV2Proxy01 Interface (from https://github.com/DODOEX/contractV2)
 */
interface IDODOV2Proxy01 {
    function createDODOVendingMachine(
        address baseToken,
        address quoteToken,
        uint256 baseInAmount,
        uint256 quoteInAmount,
        uint256 lpFeeRate,
        uint256 i,
        uint256 k,
        bool isOpenTWAP,
        uint256 deadLine
    ) external payable returns (address newVendingMachine, uint256 shares);

    function addDVMLiquidity(
        address dvmAddress,
        uint256 baseInAmount,
        uint256 quoteInAmount,
        uint256 baseMinAmount,
        uint256 quoteMinAmount,
        uint8 flag, //  0 - ERC20, 1 - baseInETH, 2 - quoteInETH
        uint256 deadLine
    )
        external
        payable
        returns (
            uint256 shares,
            uint256 baseAdjustedInAmount,
            uint256 quoteAdjustedInAmount
        );
}


/**
 * @title IDODOFeeRouteProxy Interface (from https://github.com/DODOEX/dodo-route-contract).
 */
interface IDODOFeeRouteProxy {
    function mixSwap(
        address fromToken,
        address toToken,
        uint256 fromTokenAmount,
        uint256 expReturnAmount,
        uint256 minReturnAmount,
        address[] memory mixAdapters,
        address[] memory mixPairs,
        address[] memory assetTo,
        uint256 directions,
        bytes[] memory moreInfos,
        bytes memory feeData,
        uint256 deadLine
    ) external payable returns (uint256);
}


/**
 * @title TacoProxy
 * @dev Proxy contract Taco Protocol, namely DODOV2Proxy02(createDODOVendingMachine, addDVMLiquidity) and DODOFeeRouteProxy
 */
contract TacoProxy is AppProxy {

    address constant _ETH_ADDRESS_ = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /**
     * @dev Constructor function to initialize the contract with initial state.
     * @param appAddress Application address.
     * @param settingsAddress Settings address.
     */
    constructor(address appAddress, address settingsAddress) AppProxy(appAddress, settingsAddress) {
    }

    /**
     * @dev A proxy to DODOV2Proxy02.createDODOVendingMachine.
     */
    function createDODOVendingMachine(
        address baseToken,
        address quoteToken,
        uint256 baseInAmount,
        uint256 quoteInAmount,
        uint256 lpFeeRate,
        uint256 i,
        uint256 k,
        bool isOpenTWAP,
        uint256 deadLine
    ) public payable {
        // grant token approvals
        if (baseToken != _ETH_ADDRESS_) {
            TransferHelper.safeApprove(baseToken, _appAddress, baseInAmount);
        }
        if (quoteToken != _ETH_ADDRESS_) {
            TransferHelper.safeApprove(quoteToken, _appAddress, quoteInAmount);
        }

        // proxy call
        (address newVendingMachine, uint256 shares) = 
            IDODOV2Proxy01(_appAddress).createDODOVendingMachine{value: msg.value}(
                baseToken,
                quoteToken,
                baseInAmount,
                quoteInAmount,
                lpFeeRate,
                i,
                k,
                isOpenTWAP,
                deadLine
            );

        // tokens to L2->L1 transfer (bridge)
        TransferHelper.safeApprove(newVendingMachine, getCrossChainLayerAddress(), shares);
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(newVendingMachine, shares);

        // CCL L2->L1 callback
        OutMessage memory message = OutMessage({
            queryId: 0,
            timestamp: block.timestamp,
            target: "",
            methodName: "",
            arguments: new bytes(0),
            caller: address(this),
            toBridge: tokensToBridge
        });
        sendMessage(message, 0);
    }

    /**
     * @dev A proxy to DODOFeeRouteProxy.mixSwap.
     */
    function addDVMLiquidity(
        address dvmAddress,
        uint256 baseInAmount,
        uint256 quoteInAmount,
        uint256 baseMinAmount,
        uint256 quoteMinAmount,
        uint8 flag, //  0 - ERC20, 1 - baseInETH, 2 - quoteInETH
        uint256 deadLine
    ) public payable {
        // get token addresses from the pool
        address baseToken = IDODOV2(dvmAddress)._BASE_TOKEN_();
        address quoteToken = IDODOV2(dvmAddress)._QUOTE_TOKEN_();

        // grant token approvals
        if (baseToken != _ETH_ADDRESS_) {
            TransferHelper.safeApprove(baseToken, _appAddress, baseInAmount);
        }
        if (quoteToken != _ETH_ADDRESS_) {
            TransferHelper.safeApprove(quoteToken, _appAddress, quoteInAmount);
        }

        // proxy call
        (
            uint256 shares,
            uint256 baseAdjustedInAmount,
            uint256 quoteAdjustedInAmount
        ) = IDODOV2Proxy01(_appAddress).addDVMLiquidity{value: msg.value}(
            dvmAddress,
            baseInAmount,
            quoteInAmount,
            baseMinAmount,
            quoteMinAmount,
            flag, //  0 - ERC20, 1 - baseInETH, 2 - quoteInETH
            deadLine
        );

        // tokens to L2->L1 transfer (bridge)

        TokenAmount[] memory tokensToBridge = new TokenAmount[](3);
        tokensToBridge[0] = TokenAmount(baseToken, baseInAmount - baseAdjustedInAmount);
        tokensToBridge[1] = TokenAmount(quoteToken, quoteMinAmount - quoteAdjustedInAmount);

        TransferHelper.safeApprove(dvmAddress, getCrossChainLayerAddress(), shares);
        tokensToBridge[2] = TokenAmount(dvmAddress, shares);

        // CCL L2->L1 callback
        OutMessage memory message = OutMessage({
            queryId: 0,
            timestamp: block.timestamp,
            target: "",
            methodName: "",
            arguments: new bytes(0),
            caller: address(this),
            toBridge: tokensToBridge
        });
        sendMessage(message);
    }

    /**
     * @dev A proxy to IUniswapV2Router02.swapExactTokensForTokens(...).
     */
    function mixSwap(
        address feeRouteProxy,
        address fromToken,
        address toToken,
        uint256 fromTokenAmount,
        uint256 expReturnAmount,
        uint256 minReturnAmount,
        address[] memory mixAdapters,
        address[] memory mixPairs,
        address[] memory assetTo,
        uint256 directions,
        bytes[] memory moreInfos,
        bytes memory feeData,
        uint256 deadLine
    ) public payable {
        // grant token approvals
        if (fromToken != _ETH_ADDRESS_) {
            TransferHelper.safeApprove(fromToken, feeRouteProxy, fromTokenAmount);
        }

        // proxy call
        uint256 returnAmount = IDODOFeeRouteProxy(feeRouteProxy).mixSwap{value: msg.value}(
            fromToken,
            toToken,
            fromTokenAmount,
            expReturnAmount,
            minReturnAmount,
            mixAdapters,
            mixPairs,
            assetTo,
            directions,
            moreInfos,
            feeData,
            deadLine
        );

        // tokens to L2->L1 transfer (bridge )
        uint256 value;
        TokenAmount[] memory tokensToBridge;
        if (toToken == _ETH_ADDRESS_) {
            tokensToBridge = new TokenAmount[](0);
            value = returnAmount;
        } else {
            tokensToBridge = new TokenAmount[](1);
            tokensToBridge[0] = TokenAmount(toToken, returnAmount);
            value = 0;
        }

        // CCL L2->L1 callback
        OutMessage memory message = OutMessage({
            queryId: 0,
            timestamp: block.timestamp,
            target: "",
            methodName: "",
            arguments: new bytes(0),
            caller: address(this),
            toBridge: tokensToBridge
        });
        sendMessage(message, value);
    }
}
