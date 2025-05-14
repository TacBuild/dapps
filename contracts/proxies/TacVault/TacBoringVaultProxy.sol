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
contract TacBoringVaultProxy is UUPSUpgradeable, OwnableUpgradeable, TacProxyV1Upgradeable {

    ITellerWithMultiAssetSupport public teller;
    IBoringOnChainQueue public boringOnChainQueue;

    struct DepositArguments {
        address depositAsset;
        uint256 depositAmount;
        uint256 minimumMint;
    }

    struct WithdrawArguments {
        address assetOut;
        uint256 amountOfShares;
        uint256 discount;
        uint256 secondsToDeadline;
    }
   

    function initialize(address _teller, address _boringOnChainQueue) public initializer {
        __UUPSUpgradeable_init();
        __Ownable_init(msg.sender);
        teller = ITellerWithMultiAssetSupport(_teller);
        boringOnChainQueue = IBoringOnChainQueue(_boringOnChainQueue);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function deposit(bytes memory tacHeader, bytes memory arguments) public payable _onlyCrossChainLayer{
        DepositArguments memory args = abi.decode(arguments, (DepositArguments));
        TransferHelper.safeApprove(args.depositAsset, address(teller), args.depositAmount);
        teller.deposit(ERC20(args.depositAsset), args.depositAmount, args.minimumMint);
    }

    function withdraw(bytes memory tacHeader, bytes memory arguments) public payable _onlyCrossChainLayer{

    }

    function depostAndStake(bytes memory tacHeader, bytes memory arguments) public payable _onlyCrossChainLayer{

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

    /// @notice Receives ETH
    receive() external payable {}
}