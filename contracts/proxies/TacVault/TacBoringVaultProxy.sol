// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TransferHelper} from "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import {OutMessageV1, TokenAmount, TacHeaderV1, NFTAmount} from "@tonappchain/evm-ccl/contracts/core/Structs.sol";
import {ICrossChainLayer} from "@tonappchain/evm-ccl/contracts/interfaces/ICrossChainLayer.sol";
import {TacProxyV1Upgradeable} from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TacSmartAccount} from "../../TacSmartAccounts/TacSmartAccount.sol";
import {TacSAFactory} from "../../TacSmartAccounts/TacSAFactory.sol";
import {ITacSmartAccount} from "../../TacSmartAccounts/Interface/ITacSmartAccount.sol";
import {ITellerWithMultiAssetSupport} from "./interface/ITellerWithMultiAssetSupport.sol";
import {IBoringOnChainQueue} from "./interface/IBoringOnChainQueue.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IBoringVault} from "./interface/IBoringVault.sol";
contract TacBoringVaultProxy is UUPSUpgradeable, OwnableUpgradeable, TacProxyV1Upgradeable {

    address public constant NATIVE_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    ITellerWithMultiAssetSupport public teller;
    IBoringOnChainQueue public boringOnChainQueue;
    IBoringVault public boringVault;
    TacSAFactory public tacSAFactory;
    struct DepositArguments {
        address depositAsset;
        uint256 depositAmount;
        uint256 minimumMint;
    }

    struct WithdrawArguments {
        address assetOut;
        uint128 amountOfShares;
        uint16 discount;
        uint24 secondsToDeadline;
    }

    struct WithdrawFundsArguments {
        address asset;
    }

    error ExecutionFailed(bytes returnData);
    error DepositAmountMismatch(uint256 expected, uint256 actual);
    error TransferFailed();

    event SaExecutedInteraction(address sa, address target, bytes data);
    event WithdrawRequest(bytes32 requestId);
    
    function initialize(address _crossChainLayer, address _teller, address _boringOnChainQueue, address _boringVault, address _tacSAFactory) public initializer {
        __UUPSUpgradeable_init();
        __Ownable_init(msg.sender);
        __TacProxyV1Upgradeable_init(_crossChainLayer);
        teller = ITellerWithMultiAssetSupport(_teller);
        boringOnChainQueue = IBoringOnChainQueue(_boringOnChainQueue);
        tacSAFactory = TacSAFactory(_tacSAFactory);
        boringVault = IBoringVault(_boringVault);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function deposit(bytes calldata tacHeader, bytes calldata arguments) public payable _onlyCrossChainLayer{
        DepositArguments memory args = abi.decode(arguments, (DepositArguments));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);

        if(args.depositAsset != NATIVE_ADDRESS){
            TransferHelper.safeTransfer(args.depositAsset, user, args.depositAmount);
            TacSmartAccount(payable(user)).approve(args.depositAsset, address(boringVault), args.depositAmount);
        } else {
            require(msg.value == args.depositAmount, DepositAmountMismatch(args.depositAmount, msg.value));
            (bool success,) = payable(user).call{value: msg.value}("");
            require(success, TransferFailed());
        }
        
        bytes memory data = abi.encodeWithSelector(ITellerWithMultiAssetSupport.deposit.selector, args.depositAsset, args.depositAmount, args.minimumMint);
        _saExecution(user, address(teller), msg.value, data);
        data = abi.encodeWithSelector(IERC20.transfer.selector, address(this), boringVault.balanceOf(address(user)));
        _saExecution(user, address(boringVault), 0, data);

        TokenAmount[] memory tokens = new TokenAmount[](1);
        tokens[0] = TokenAmount({
            evmAddress: address(boringVault),
            amount: boringVault.balanceOf(address(this))
        });
        _bridgeTokens(tacHeader, tokens, "");
    }

    function withdrawRequest(bytes calldata tacHeader, bytes calldata arguments) public _onlyCrossChainLayer{
        WithdrawArguments memory args = abi.decode(arguments, (WithdrawArguments));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        TransferHelper.safeTransfer(address(boringVault), user, args.amountOfShares);
        bytes memory data = abi.encodeWithSelector(IBoringOnChainQueue.requestOnChainWithdraw.selector, args.assetOut, args.amountOfShares, args.discount, args.secondsToDeadline);
        TacSmartAccount(payable(user)).approve(address(boringVault), address(boringOnChainQueue), args.amountOfShares);
        (, bytes memory returnData) = _saExecution(user, address(boringOnChainQueue), 0, data);
        bytes32 requestId = abi.decode(returnData, (bytes32));
        emit WithdrawRequest(requestId);
    }

    function withdrawFunds(bytes calldata tacHeader, bytes calldata arguments) public _onlyCrossChainLayer{
        WithdrawFundsArguments memory args = abi.decode(arguments, (WithdrawFundsArguments));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);

        bytes memory data = abi.encodeWithSelector(IERC20.transfer.selector, address(this), IERC20(args.asset).balanceOf(address(user)));
        _saExecution(user, address(args.asset), 0, data);
        TokenAmount[] memory tokens = new TokenAmount[](1);
        tokens[0] = TokenAmount({
            evmAddress: address(args.asset),
            amount: IERC20(args.asset).balanceOf(address(this))
        });
        _bridgeTokens(tacHeader, tokens, "");
    }

    /// @notice Bridges tokens to the cross-chain layer
    /// @param tacHeader TAC header data
    /// @param tokens Array of token amounts to bridge
    /// @param payload Additional payload data
    function _bridgeTokens(
        bytes calldata tacHeader,
        TokenAmount[] memory tokens,
        string memory payload
    ) private {
        for (uint256 i = 0; i < tokens.length; i++) {
            TransferHelper.safeApprove(
                tokens[i].evmAddress,
                _getCrossChainLayerAddress(),
                tokens[i].amount
            );
        }

        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: payload,
            tvmProtocolFee: 0,
            tvmExecutorFee: 0,
            tvmValidExecutors: new string[](0),
            toBridge: tokens,
            toBridgeNFT: new NFTAmount[](0)
        });

        _sendMessageV1(message, address(this).balance);
    }

    function _saExecution(address sa, address target, uint256 value, bytes memory data) internal returns(bool success, bytes memory returnData) {
        (success, returnData) = TacSmartAccount(payable(sa)).executeUnsafe(target, value, data);
        require(success, ExecutionFailed(returnData));
        emit SaExecutedInteraction(sa, target, data);   
    }

    /// @notice Receives ETH
    receive() external payable {}
}