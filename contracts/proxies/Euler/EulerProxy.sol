// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TransferHelper} from "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import {OutMessageV2, TokenAmount, TacHeaderV1, NFTAmount} from "@tonappchain/evm-ccl/contracts/L2/Structs.sol";
import {ICrossChainLayer} from "@tonappchain/evm-ccl/contracts/interfaces/ICrossChainLayer.sol";
import {TacProxyV1Upgradeable} from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TacSmartAccount} from "../../TacSmartAccounts/TacSmartAccount.sol";
import {TacSAFactory} from "../../TacSmartAccounts/TacSAFactory.sol";
import {ITacSmartAccount} from "../../TacSmartAccounts/Interface/ITacSmartAccount.sol";
import {IEthereumVaultConnector} from "./Interface/IEthereumVaultConnector.sol";

contract EulerProxy is
    TacProxyV1Upgradeable,
    UUPSUpgradeable,
    OwnableUpgradeable
{
    IEthereumVaultConnector public eulerVaultConnector;
    TacSAFactory public tacSAFactory;

    struct SmartAccountActions {
        bool isNeededApprove;
        address[] tokensToApprove;
        uint256[] amountsToApprove;
        address[] toApprove;
        bool isPostActionTransferToSmartAccountNeeded;
        address[] tokensToTransferToSmartAccount;
        uint256[] amountsToTransferToSmartAccount;
    }

    event Call(bytes indexed result);
    event Batch(IEthereumVaultConnector.BatchItem[] indexed items);
    event BatchSimulation(IEthereumVaultConnector.BatchItemResult[] indexed batchItemsResult, IEthereumVaultConnector.StatusCheckResult[] indexed accountsStatusCheckResult, IEthereumVaultConnector.StatusCheckResult[] indexed vaultsStatusCheckResult);
    event SetOperator(bytes19 indexed addressPrefix, address indexed operator, uint256 indexed operatorBitField);
    event SetAccountOperator(address indexed account, address indexed operator, bool indexed authorized);

    /// @notice Initializes the proxy contract
    /// @param _crossChainLayer Address of the cross-chain layer contract
    /// @param _eulerVaultConnector Address of the Euler vault connector contract
    function initialize(
        address _crossChainLayer,
        address _eulerVaultConnector,
        address _tacSAFactory
    ) external initializer {
        __TacProxyV1Upgradeable_init(_crossChainLayer);
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        eulerVaultConnector = IEthereumVaultConnector(_eulerVaultConnector);
        tacSAFactory = TacSAFactory(_tacSAFactory);
    }

    /// @notice Internal function to authorize upgrades
    /// @param newImplementation Address of the new implementation
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    function call(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable {
        (address targetContract, address onBehalfOfAccount, uint256 value, bytes memory data, address[] memory tokens, SmartAccountActions memory smartAccountActions) = abi.decode(arguments, (address, address, uint256, bytes, address[], SmartAccountActions));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, ) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        if (smartAccountActions.isNeededApprove) {
            for (uint256 i = 0; i < smartAccountActions.tokensToApprove.length; i++) {
                ITacSmartAccount(user).approve(smartAccountActions.tokensToApprove[i], smartAccountActions.toApprove[i], smartAccountActions.amountsToApprove[i]);
            }
        }
        ITacSmartAccount(user).execute{value: value}(address(eulerVaultConnector), value, abi.encodeWithSelector(IEthereumVaultConnector.call.selector, targetContract, onBehalfOfAccount, value, data));
        if (smartAccountActions.isPostActionTransferToSmartAccountNeeded) {
            for (uint256 i = 0; i < smartAccountActions.tokensToTransferToSmartAccount.length; i++) {
                TransferHelper.safeTransfer(smartAccountActions.tokensToTransferToSmartAccount[i], user, smartAccountActions.amountsToTransferToSmartAccount[i]);
            }
        }
        if (tokens.length > 0) {
            TokenAmount[] memory tokenAmounts = new TokenAmount[](tokens.length);
            for (uint256 i = 0; i < tokens.length; i++) {
                tokenAmounts[i] = TokenAmount({
                    l2Address: tokens[i],
                    amount: IERC20(tokens[i]).balanceOf(address(this))
                });
            }
            _bridgeTokens(msg.data, tokenAmounts, "");
        }
        // emit Call(result);
    }

    function batch(
        bytes calldata,
        bytes calldata arguments
    ) external payable {
        (IEthereumVaultConnector.BatchItem[] memory items, address[] memory tokens) = abi.decode(arguments, (IEthereumVaultConnector.BatchItem[], address[]));
        eulerVaultConnector.batch(items);
        if (tokens.length > 0) {
            TokenAmount[] memory tokenAmounts = new TokenAmount[](tokens.length);
            for (uint256 i = 0; i < tokens.length; i++) {
                tokenAmounts[i] = TokenAmount({
                    l2Address: tokens[i],
                    amount: IERC20(tokens[i]).balanceOf(address(this))
                });
            }
            _bridgeTokens(msg.data, tokenAmounts, "");
        }
        emit Batch(items);
    }

    function batchSimulation(
        bytes calldata,
        bytes calldata arguments
    ) external payable {
        IEthereumVaultConnector.BatchItem[] memory items = abi.decode(arguments, (IEthereumVaultConnector.BatchItem[]));
        (IEthereumVaultConnector.BatchItemResult[] memory batchItemsResult, IEthereumVaultConnector.StatusCheckResult[] memory accountsStatusCheckResult, IEthereumVaultConnector.StatusCheckResult[] memory vaultsStatusCheckResult) = eulerVaultConnector.batchSimulation(items);
        emit BatchSimulation(batchItemsResult, accountsStatusCheckResult, vaultsStatusCheckResult);
    }

    function setOperator(
        bytes calldata,
        bytes calldata arguments
    ) external payable {
        (bytes19 addressPrefix, address operator, uint256 operatorBitField) = abi.decode(arguments, (bytes19, address, uint256));
        eulerVaultConnector.setOperator(addressPrefix, operator, operatorBitField);
        emit SetOperator(addressPrefix, operator, operatorBitField);
    }

    function setAccountOperator(
        bytes calldata,
        bytes calldata arguments
    ) external payable {
        (address account, address operator, bool authorized) = abi.decode(arguments, (address, address, bool));
        eulerVaultConnector.setAccountOperator(account, operator, authorized);
        emit SetAccountOperator(account, operator, authorized);
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
                tokens[i].l2Address,
                _getCrossChainLayerAddress(),
                tokens[i].amount
            );
        }

        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV2 memory message = OutMessageV2({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: payload,
            tvmProtocolFee: 0,
            tvmExecutorFee: 0,
            tvmValidExecutors: new string[](0),
            toBridge: tokens,
            toBridgeNFT: new NFTAmount[](0)
        });

        _sendMessageV2(message, address(this).balance);
    }

    receive() external payable {}
}
