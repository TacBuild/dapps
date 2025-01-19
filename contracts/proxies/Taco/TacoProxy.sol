// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IUniswapV2Router02 } from '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import { TransferHelper } from '@uniswap/lib/contracts/libraries/TransferHelper.sol';

import { AppProxy } from "contracts/L2/AppProxy.sol";
import { OutMessage, TokenAmount, TacHeaderV1 } from "tac-l2-ccl/contracts/L2/Structs.sol";
import { UniswapV2Library } from "contracts/proxies/UniswapV2/CompilerVersionAdapters.sol";
import { ICrossChainLayer } from "tac-l2-ccl/contracts/interfaces/ICrossChainLayer.sol";

/**
 * @title IDODOV2Proxy01 Interface (from https://github.com/DODOEX/contractV2)
 */
interface IDODOV2 {
    function _DODO_APPROVE_PROXY_() external view returns (address);
    function _DODO_APPROVE_() external view returns (address);
    function _BASE_TOKEN_() external view returns (address);
    function _QUOTE_TOKEN_() external view returns (address);
    function _WETH_() external view returns (address);
}

/**
 * @title IDVMFactory Interface (from https://github.com/DODOEX/contractV2)
 */
interface IDVMFactory {
    function getDODOPool(address baseToken, address quoteToken) 
        external view returns (address[] memory machines);
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
 * @title IDODOApprove Interface (from https://github.com/DODOEX/dodo-route-contract).
 */
interface IDODOApprove {
    function claimTokens(address token,address who,address dest,uint256 amount) external;
    function getDODOProxy() external view returns (address);
}

struct CreateDODOVendingMachineArguments {
    address baseToken;
    address quoteToken;
    uint256 baseInAmount;
    uint256 quoteInAmount;
    uint256 lpFeeRate;
    uint256 i;
    uint256 k;
    bool isOpenTWAP;
    uint256 deadLine;
}

struct AddDVMLiquidityArguments {
    address dvmAddress;
    uint256 baseInAmount;
    uint256 quoteInAmount;
    uint256 baseMinAmount;
    uint256 quoteMinAmount;
    uint8 flag; //  0 - ERC20, 1 - baseInETH, 2 - quoteInETH
    uint256 deadLine;
}

struct MixSwapArguments {

    address fromToken;
    address toToken;
    uint256 fromTokenAmount;
    uint256 expReturnAmount;
    uint256 minReturnAmount;
    address[] mixAdapters;
    address[] mixPairs;
    address[] assetTo;
    uint256 directions;
    bytes[] moreInfos;
    bytes feeData;
    uint256 deadLine;
}

/**
 * @title TacoProxy
 * @dev Proxy contract Taco Protocol, namely DODOV2Proxy02(createDODOVendingMachine, addDVMLiquidity) and DODOFeeRouteProxy
 */
contract TacoProxy is AppProxy {

    address public constant _ETH_ADDRESS_ = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    address internal immutable _approveAddress;
    address internal immutable _wethAddress;
    address internal immutable _feeRouteProxyAddress;

    /**
     * @dev Constructor function to initialize the contract with initial state.
     * @param appAddress Application address.
     * @param settingsAddress Settings address.
     */
    constructor(address appAddress, address feeRouteProxyAddress, address settingsAddress) AppProxy(appAddress, settingsAddress) {
        address approveProxy = IDODOV2(appAddress)._DODO_APPROVE_PROXY_();
        _approveAddress = IDODOV2(approveProxy)._DODO_APPROVE_();
        _wethAddress = IDODOV2(appAddress)._WETH_();
        _feeRouteProxyAddress = feeRouteProxyAddress;
    }

    function _createDODOVendingMachine(
        CreateDODOVendingMachineArguments memory arguments
    ) internal returns (address newVendingMachine, uint256 shares) {
        // grant token approvals
        if (arguments.baseToken == _ETH_ADDRESS_) {
            TransferHelper.safeApprove(_wethAddress, _approveAddress, arguments.baseInAmount);
        } else {
            TransferHelper.safeApprove(arguments.baseToken, _approveAddress, arguments.baseInAmount);
        }
        if (arguments.quoteToken == _ETH_ADDRESS_) {
            TransferHelper.safeApprove(_wethAddress, _approveAddress, arguments.quoteInAmount);
        } else {
            TransferHelper.safeApprove(arguments.quoteToken, _approveAddress, arguments.quoteInAmount);
        }

        // proxy call
        (newVendingMachine, shares) = 
            IDODOV2Proxy01(_appAddress).createDODOVendingMachine{value: msg.value}(
                arguments.baseToken,
                arguments.quoteToken,
                arguments.baseInAmount,
                arguments.quoteInAmount,
                arguments.lpFeeRate,
                arguments.i,
                arguments.k,
                arguments.isOpenTWAP,
                arguments.deadLine
            );
    }

    /**
     * @dev A proxy to DODOV2Proxy02.createDODOVendingMachine.
     */
    function createDODOVendingMachine(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public payable {
        // decode arguments
        CreateDODOVendingMachineArguments memory args = abi.decode(arguments, (CreateDODOVendingMachineArguments));

        // call dApp
        (address newVendingMachine, uint256 shares) = _createDODOVendingMachine(args);

        // tokens to L2->L1 transfer (bridge)
        TransferHelper.safeApprove(newVendingMachine, getCrossChainLayerAddress(), shares);
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(newVendingMachine, shares);

        // CCL L2->L1 callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessage memory message = OutMessage({
            queryId: header.queryId,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });
        sendMessage(message, 0);
    }

    function _addDVMLiquidity(
        AddDVMLiquidityArguments memory arguments
    ) internal returns (uint256 shares, uint256 baseAdjustedInAmount, uint256 quoteAdjustedInAmount) {
        // get token addresses from the pool
        address baseToken = IDODOV2(arguments.dvmAddress)._BASE_TOKEN_();
        address quoteToken = IDODOV2(arguments.dvmAddress)._QUOTE_TOKEN_();

        // grant token approvals
        if (baseToken == _ETH_ADDRESS_) {
            TransferHelper.safeApprove(_wethAddress, _approveAddress, arguments.baseInAmount);
        } else {
            TransferHelper.safeApprove(baseToken, _approveAddress, arguments.baseInAmount);
        }
        if (quoteToken == _ETH_ADDRESS_) {
            TransferHelper.safeApprove(_wethAddress, _approveAddress, arguments.quoteInAmount);
        } else {
            TransferHelper.safeApprove(quoteToken, _approveAddress, arguments.quoteInAmount);
        }

        // proxy call
        (
            shares,
            baseAdjustedInAmount,
            quoteAdjustedInAmount
        ) = IDODOV2Proxy01(_appAddress).addDVMLiquidity{value: msg.value}(
            arguments.dvmAddress,
            arguments.baseInAmount,
            arguments.quoteInAmount,
            arguments.baseMinAmount,
            arguments.quoteMinAmount,
            arguments.flag, //  0 - ERC20, 1 - baseInETH, 2 - quoteInETH
            arguments.deadLine
        );
    }

    /**
     * @dev A proxy to DODOFeeRouteProxy.mixSwap.
     */
    function addDVMLiquidity(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public payable {
        // decode arguments
        AddDVMLiquidityArguments memory args = abi.decode(arguments, (AddDVMLiquidityArguments));

        // call dApp
        (uint256 shares, uint256 baseAdjustedInAmount, uint256 quoteAdjustedInAmount) = _addDVMLiquidity(args);

        // approve share to CCL
        TransferHelper.safeApprove(args.dvmAddress, getCrossChainLayerAddress(), shares);
    
        // tokens to L2->L1 transfer (bridge)
        address baseToken = IDODOV2(args.dvmAddress)._BASE_TOKEN_();
        address quoteToken = IDODOV2(args.dvmAddress)._QUOTE_TOKEN_();
        uint256 t = (baseToken == _ETH_ADDRESS_ ? 0 : 1) + (quoteToken == _ETH_ADDRESS_ ? 0 : 1) + 1;
        TokenAmount[] memory tokensToBridge = new TokenAmount[](t);
        uint256 value = 0;
        uint256 i = 0;

        if (baseToken == _ETH_ADDRESS_) {
            value += args.baseInAmount - baseAdjustedInAmount;
        } else {
            tokensToBridge[i] = TokenAmount(baseToken, args.baseInAmount - baseAdjustedInAmount);
            unchecked {
                i++;
            }
        }
        if (quoteToken == _ETH_ADDRESS_) {
            value += args.quoteInAmount - quoteAdjustedInAmount;
        } else {
            tokensToBridge[i] = TokenAmount(quoteToken,args. quoteInAmount - quoteAdjustedInAmount);
            unchecked {
                i++;
            }
        }
        tokensToBridge[i] = TokenAmount(args.dvmAddress, shares);

        // CCL L2->L1 callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessage memory message = OutMessage({
            queryId: header.queryId,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });
        sendMessage(message, value);
    }

    function _mixSwap(
        MixSwapArguments memory arguments
    ) internal returns (uint256 returnAmount) {

        // grant token approvals
        if (arguments.fromToken != _ETH_ADDRESS_) {
            TransferHelper.safeApprove(arguments.fromToken, _approveAddress, arguments.fromTokenAmount);
        } else {
            TransferHelper.safeApprove(_wethAddress, _approveAddress, arguments.fromTokenAmount);
        }

        // proxy call
        returnAmount = IDODOFeeRouteProxy(_feeRouteProxyAddress).mixSwap{value: msg.value}(
            arguments.fromToken,
            arguments.toToken,
            arguments.fromTokenAmount,
            arguments.expReturnAmount,
            arguments.minReturnAmount,
            arguments.mixAdapters,
            arguments.mixPairs,
            arguments.assetTo,
            arguments.directions,
            arguments.moreInfos,
            arguments.feeData,
            arguments.deadLine
        );
    }

    /**
     * @dev A proxy to IUniswapV2Router02.swapExactTokensForTokens(...).
     */
    function mixSwap(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public payable {
        // decode arguments
        MixSwapArguments memory args = abi.decode(arguments, (MixSwapArguments));
        
        // call dApp
        (uint256 returnAmount) = _mixSwap(args);

        // tokens to L2->L1 transfer (bridge )
        uint256 value;
        TokenAmount[] memory tokensToBridge;
        if (args.toToken == _ETH_ADDRESS_) {
            tokensToBridge = new TokenAmount[](0);
            value = returnAmount;
        } else {
            tokensToBridge = new TokenAmount[](1);
            tokensToBridge[0] = TokenAmount(args.toToken, returnAmount);
            value = 0;
        }

        // CCL L2->L1 callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessage memory message = OutMessage({
            queryId: header.queryId,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });
        sendMessage(message, value);
    }
}
