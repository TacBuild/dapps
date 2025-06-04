// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TransferHelper} from "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import {SaHelper} from "../../TacSmartAccounts/SaHelper.sol";
import {IHooks} from "../../TacSmartAccounts/Interface/IHooks.sol";
import {ICrossChainLayer} from "@tonappchain/evm-ccl/contracts/interfaces/ICrossChainLayer.sol";
import {TacProxyV1Upgradeable} from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TacSmartAccount} from "../../TacSmartAccounts/TacSmartAccount.sol";
import {TacSAFactory} from "../../TacSmartAccounts/TacSAFactory.sol";
import {TacSmartAccount} from "../../TacSmartAccounts/TacSmartAccount.sol";
import {IEthereumVaultConnector} from "./Interface/IEthereumVaultConnector.sol";
import {OutMessageV1, TokenAmount, TacHeaderV1, NFTAmount} from "@tonappchain/evm-ccl/contracts/core/Structs.sol";
import "hardhat/console.sol";

contract EulerProxy is
    TacProxyV1Upgradeable,
    UUPSUpgradeable,
    OwnableUpgradeable
{
    IEthereumVaultConnector public eulerVaultConnector;
    TacSAFactory public tacSAFactory;

    struct BridgeBackData {
        address[] tokensToBridge;
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
    ) external payable _onlyCrossChainLayer {
        (IHooks.SaHooks memory hooks, BridgeBackData memory bridgeBackData) = abi.decode(arguments, (IHooks.SaHooks, BridgeBackData));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, bool isNewUser) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        if (isNewUser) {
            _setAuthorization(user, address(this), true);
        }
        console.log("user", user);
        SaHelper.executePreHooks(user, hooks);
        bytes memory result = eulerVaultConnector.call(hooks.mainCallHook.contractAddress, user, hooks.mainCallHook.value, hooks.mainCallHook.data);
        SaHelper.executePostHooks(user, hooks);

        if (bridgeBackData.tokensToBridge.length > 0 && bridgeBackData.tokensToBridge[0] != address(0)) {
            console.log(IERC20(bridgeBackData.tokensToBridge[0]).balanceOf(address(this)));
            TokenAmount[] memory tokenAmounts = new TokenAmount[](bridgeBackData.tokensToBridge.length);
            for (uint256 i = 0; i < bridgeBackData.tokensToBridge.length; i++) {
                tokenAmounts[i] = TokenAmount(
                    bridgeBackData.tokensToBridge[i],
                    IERC20(bridgeBackData.tokensToBridge[i]).balanceOf(address(this))
                );
            }
            _bridgeTokens(tacHeader, tokenAmounts, "");
        }
        emit Call(result);
    }

    function batch(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable _onlyCrossChainLayer {
        (IHooks.SaHooks memory hooks, BridgeBackData memory bridgeBackData) = abi.decode(arguments, (IHooks.SaHooks, BridgeBackData));

        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, bool isNewUser) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        if (isNewUser) {
            _setAuthorization(user, address(this), true);
        }
        SaHelper.executePreHooks(user, hooks);
        IEthereumVaultConnector.BatchItem[] memory items = abi.decode(hooks.mainCallHook.data, (IEthereumVaultConnector.BatchItem[]));
        eulerVaultConnector.batch(items);
        SaHelper.executePostHooks(user, hooks);
        
        if (bridgeBackData.tokensToBridge.length > 0) {
            TokenAmount[] memory tokenAmounts = new TokenAmount[](bridgeBackData.tokensToBridge.length);
            for (uint256 i = 0; i < bridgeBackData.tokensToBridge.length; i++) {
                tokenAmounts[i] = TokenAmount(
                    bridgeBackData.tokensToBridge[i],
                    IERC20(bridgeBackData.tokensToBridge[i]).balanceOf(address(this))
                );
            }
        }
        emit Batch(items);
    }

    function batchSimulation(
        bytes calldata,
        bytes calldata arguments
    ) external payable _onlyCrossChainLayer {
        IEthereumVaultConnector.BatchItem[] memory items = abi.decode(arguments, (IEthereumVaultConnector.BatchItem[]));
        (IEthereumVaultConnector.BatchItemResult[] memory batchItemsResult, IEthereumVaultConnector.StatusCheckResult[] memory accountsStatusCheckResult, IEthereumVaultConnector.StatusCheckResult[] memory vaultsStatusCheckResult) = eulerVaultConnector.batchSimulation(items);
        emit BatchSimulation(batchItemsResult, accountsStatusCheckResult, vaultsStatusCheckResult);
    }

    function setOperator(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable _onlyCrossChainLayer {
        (bytes19 addressPrefix, address operator, uint256 operatorBitField) = abi.decode(arguments, (bytes19, address, uint256));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);    
        (address user, ) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        TacSmartAccount(payable(user)).execute(address(eulerVaultConnector), 0, abi.encodeWithSelector(IEthereumVaultConnector.setOperator.selector, addressPrefix, operator, operatorBitField));
        emit SetOperator(addressPrefix, operator, operatorBitField);
    }

    function setAccountOperator(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable _onlyCrossChainLayer {
        (address account, address operator, bool authorized) = abi.decode(arguments, (address, address, bool));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);    
        (address user, ) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        TacSmartAccount(payable(user)).execute(address(eulerVaultConnector), 0, abi.encodeWithSelector(IEthereumVaultConnector.setAccountOperator.selector, account, operator, authorized));
        emit SetAccountOperator(account, operator, authorized);
    }

    function _setAuthorization(address user, address operator, bool authorized) internal {
        TacSmartAccount(payable(user)).execute(address(eulerVaultConnector), 0, abi.encodeWithSelector(IEthereumVaultConnector.setAccountOperator.selector, user, operator, authorized));
        emit SetAccountOperator(user, operator, authorized);
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

    receive() external payable {}
}
