// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import { IUniswapV2Router02 } from '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import { TransferHelper } from '@uniswap/lib/contracts/libraries/TransferHelper.sol';

import { TacProxyV1Upgradeable } from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";

import { OutMessageV1, TokenAmount, NFTAmount, TacHeaderV1 } from "@tonappchain/evm-ccl/contracts/core/Structs.sol";
import { UniswapV2Library } from "contracts/proxies/UniswapV2/CompilerVersionAdapters.sol";
import { ICrossChainLayer } from "@tonappchain/evm-ccl/contracts/interfaces/ICrossChainLayer.sol";


/**
 * @title DVM pool interface (from https://github.com/DODOEX/contractV2/blob/main/contracts/DODOVendingMachine/intf/IDVM.sol)
 */
interface IDVM is IERC20 {
    function _BASE_TOKEN_() external view returns (address);
    function _QUOTE_TOKEN_() external view returns (address);
    function _MT_FEE_RATE_MODEL_() external view returns (address);
    function getVaultReserve() external view returns (uint256 baseReserve, uint256 quoteReserve);
    function getMidPrice() external view returns (uint256 midPrice);
    function sellShares(
        uint256 shareAmount,
        address to,
        uint256 baseMinAmount,
        uint256 quoteMinAmount,
        bytes calldata data,
        uint256 deadline
    ) external returns (uint256 baseAmount, uint256 quoteAmount);
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

    function _DODO_APPROVE_PROXY_() external view returns (address);
    function _DODO_APPROVE_() external view returns (address);
    function _WETH_() external view returns (address);

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

struct SellSharesArguments {
    address dvmAddress;
    uint256 shareAmount;
    address to;
    uint256 baseMinAmount;
    uint256 quoteMinAmount;
    bytes data;
    uint256 deadline;
}

/**
 * @title TacoProxy
 * @dev Proxy contract Taco Protocol, namely DODOV2Proxy02(createDODOVendingMachine, addDVMLiquidity) and DODOFeeRouteProxy
 */
contract TacoProxy is TacProxyV1Upgradeable, OwnableUpgradeable, UUPSUpgradeable {

    address public constant _ETH_ADDRESS_ = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    address internal  _approveAddress;
    address internal  _wethAddress;
    address internal _appAddress;
    address internal  _feeRouteProxyAddress;

    /**
     * @dev Initialize the contract.
     */
    function initialize(
        address adminAddress,
        address appAddress,
        address feeRouteProxyAddress,
        address crossChainLayer) public initializer {
        __TacProxyV1Upgradeable_init(crossChainLayer);
        __Ownable_init(adminAddress);
        __UUPSUpgradeable_init();

        _appAddress = appAddress;
        _approveAddress = IDODOV2Proxy01(IDODOV2Proxy01(appAddress)._DODO_APPROVE_PROXY_())._DODO_APPROVE_();
        _wethAddress = IDODOV2Proxy01(appAddress)._WETH_();
        _feeRouteProxyAddress = feeRouteProxyAddress;
    }

    receive() external payable {}

    /**
     * @dev Upgrades the contract.
     */
    function _authorizeUpgrade(address) internal override onlyOwner {}

    /**
     * @dev Returns the application address.
     * @return address The application address.
     */
    function getAppAddress() external view returns (address) {
        return _appAddress;
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
    ) public payable _onlyCrossChainLayer {

        // decode arguments
        CreateDODOVendingMachineArguments memory args = abi.decode(arguments, (CreateDODOVendingMachineArguments));

        // call dApp
        (address newVendingMachine, uint256 shares) = _createDODOVendingMachine(args);

        // tokens to EVM->TVM transfer (bridge)
        TransferHelper.safeApprove(newVendingMachine, _getCrossChainLayerAddress(), shares);
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(newVendingMachine, shares);

        // CCL EVM->TVM callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            tvmProtocolFee: 0,
            tvmExecutorFee: 0,
            tvmValidExecutors: new string[](0),
            toBridge: tokensToBridge,
            toBridgeNFT: new NFTAmount[](0)
        });
        _sendMessageV1(message, 0);
    }

    function _addDVMLiquidity(
        AddDVMLiquidityArguments memory arguments
    ) internal returns (uint256 shares, uint256 baseAdjustedInAmount, uint256 quoteAdjustedInAmount) {
        // get token addresses from the pool
        address baseToken = IDVM(arguments.dvmAddress)._BASE_TOKEN_();
        address quoteToken = IDVM(arguments.dvmAddress)._QUOTE_TOKEN_();

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
    ) public payable _onlyCrossChainLayer {
        // decode arguments
        AddDVMLiquidityArguments memory args = abi.decode(arguments, (AddDVMLiquidityArguments));

        // call dApp
        (uint256 shares, uint256 baseAdjustedInAmount, uint256 quoteAdjustedInAmount) = _addDVMLiquidity(args);

        // approve share to CCL
        TransferHelper.safeApprove(args.dvmAddress, _getCrossChainLayerAddress(), shares);

        // tokens to EVM->TVM transfer (bridge)
        address baseToken = IDVM(args.dvmAddress)._BASE_TOKEN_();
        address quoteToken = IDVM(args.dvmAddress)._QUOTE_TOKEN_();
        uint256 t = (baseToken == _ETH_ADDRESS_ ? 0 : 1) + (quoteToken == _ETH_ADDRESS_ ? 0 : 1) + 1;
        TokenAmount[] memory tokensToBridge = new TokenAmount[](t);
        uint256 value = 0;
        uint256 i = 0;

        if (baseToken == _ETH_ADDRESS_) {
            value += args.baseInAmount - baseAdjustedInAmount;
        } else {
            tokensToBridge[i] = TokenAmount(baseToken, args.baseInAmount - baseAdjustedInAmount);
            TransferHelper.safeApprove(baseToken, _getCrossChainLayerAddress(), args.baseInAmount - baseAdjustedInAmount);
            unchecked {
                i++;
            }
        }
        if (quoteToken == _ETH_ADDRESS_) {
            value += args.quoteInAmount - quoteAdjustedInAmount;
        } else {
            tokensToBridge[i] = TokenAmount(quoteToken, args.quoteInAmount - quoteAdjustedInAmount);
            TransferHelper.safeApprove(quoteToken, _getCrossChainLayerAddress(), args.quoteInAmount - quoteAdjustedInAmount);
            unchecked {
                i++;
            }
        }
        tokensToBridge[i] = TokenAmount(args.dvmAddress, shares);

        // CCL EVM->TVM callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            tvmProtocolFee: 0,
            tvmExecutorFee: 0,
            tvmValidExecutors: new string[](0),
            toBridge: tokensToBridge,
            toBridgeNFT: new NFTAmount[](0)
        });
        _sendMessageV1(message, value);
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
    ) public payable _onlyCrossChainLayer {
        // decode arguments
        MixSwapArguments memory args = abi.decode(arguments, (MixSwapArguments));

        // call dApp
        (uint256 returnAmount) = _mixSwap(args);

        // tokens to EVM->TVM transfer (bridge)
        uint256 value;
        TokenAmount[] memory tokensToBridge;
        if (args.toToken == _ETH_ADDRESS_) {
            tokensToBridge = new TokenAmount[](0);
            value = returnAmount;
        } else {
            tokensToBridge = new TokenAmount[](1);
            tokensToBridge[0] = TokenAmount(args.toToken, returnAmount);
            TransferHelper.safeApprove(args.toToken, _getCrossChainLayerAddress(), returnAmount);
            value = 0;
        }

        // CCL EVM->TVM callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            tvmProtocolFee: 0,
            tvmExecutorFee: 0,
            tvmValidExecutors: new string[](0),
            toBridge: tokensToBridge,
            toBridgeNFT: new NFTAmount[](0)
        });
        _sendMessageV1(message, value);
    }

    function _sellShares(
        SellSharesArguments memory arguments
    ) internal returns (uint256 baseAmount, uint256 quoteAmount) {
        // grant token approvals
        TransferHelper.safeApprove(arguments.dvmAddress, arguments.dvmAddress, arguments.shareAmount);

        // call dApp
        (baseAmount, quoteAmount) = IDVM(arguments.dvmAddress).sellShares(
            arguments.shareAmount,
            arguments.to,   // use DODO ETH helper to auto convert WETH to TAC
            arguments.baseMinAmount,
            arguments.quoteMinAmount,
            arguments.data,
            arguments.deadline
        );
    }

    /**
     * @dev A proxy to IDVM.sellShares for removing liquidity from DVM pools.
     */
    function sellShares(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public _onlyCrossChainLayer {
        // decode arguments
        SellSharesArguments memory args = abi.decode(arguments, (SellSharesArguments));

        // call dApp
        (uint256 baseAmount, uint256 quoteAmount) = _sellShares(args);

        // get token addresses from the pool
        address baseToken = IDVM(args.dvmAddress)._BASE_TOKEN_();
        address quoteToken = IDVM(args.dvmAddress)._QUOTE_TOKEN_();

        // check need to unwrap TAC
        // see: https://github.com/DODOEX/contractV2/blob/main/contracts/DODOVendingMachine/impl/DVMFunding.sol#L95
        bool isBaseNative = (baseToken == _wethAddress) && (args.data.length > 0);
        bool isQuoteNative = (quoteToken == _wethAddress) && (args.data.length > 0);

        // tokens to EVM->TVM transfer (bridge)
        TokenAmount[] memory tokensToBridge = new TokenAmount[]((isBaseNative ? 0 : 1) + (isQuoteNative ? 0 : 1));
        uint256 value = 0;
        uint256 i = 0;

        if (isBaseNative) {
            value += baseAmount;
        } else {
            tokensToBridge[i] = TokenAmount(baseToken, baseAmount);
            TransferHelper.safeApprove(baseToken, _getCrossChainLayerAddress(), baseAmount);
            unchecked {
                i++;
            }
        }

        if (isQuoteNative) {
            value += quoteAmount;
        } else {
            tokensToBridge[i] = TokenAmount(quoteToken, quoteAmount);
            TransferHelper.safeApprove(quoteToken, _getCrossChainLayerAddress(), quoteAmount);
            unchecked {
                i++;
            }
        }

        // CCL EVM->TVM callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            tvmProtocolFee: 0,
            tvmExecutorFee: 0,
            tvmValidExecutors: new string[](0),
            toBridge: tokensToBridge,
            toBridgeNFT: new NFTAmount[](0)
        });
        _sendMessageV1(message, value);
    }
}
