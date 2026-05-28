// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SaHelper} from "./lib/HookLib.sol";
import {IHooks} from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/IHooks.sol";
import {ICrossChainLayer} from "@tonappchain/evm-ccl/contracts/interfaces/ICrossChainLayer.sol";
import {TacProxyV1Upgradeable} from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ISAFactory} from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/ISAFactory.sol";
import {ITacSmartAccount} from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/ITacSmartAccount.sol";
import {IEthereumVaultConnector} from "./Interface/IEthereumVaultConnector.sol";
import {OutMessageV1, TokenAmount, TacHeaderV1, NFTAmount} from "@tonappchain/evm-ccl/contracts/core/Structs.sol";
import "hardhat/console.sol";

contract EulerProxy is
    TacProxyV1Upgradeable,
    UUPSUpgradeable,
    Ownable2StepUpgradeable
{

    IEthereumVaultConnector public eulerVaultConnector;
    ISAFactory public tacSAFactory;
    uint256 public constant MAX_BRIDGE_TOKENS = 10;

    struct BridgeBackData {
        address[] tokensToBridge;
    }

    struct CallArguments {
        address targetContract;
        address onBehalfOfAccount;
        uint256 value;
        bytes data;
    }

    event Call(bytes indexed result);
    event Batch(bytes indexed result);
    event BatchSimulation(IEthereumVaultConnector.BatchItemResult[] indexed batchItemsResult, IEthereumVaultConnector.StatusCheckResult[] indexed accountsStatusCheckResult, IEthereumVaultConnector.StatusCheckResult[] indexed vaultsStatusCheckResult);
    event SetOperator(bytes19 indexed addressPrefix, address indexed operator, uint256 indexed operatorBitField);
    event SetAccountOperator(address indexed account, address indexed operator, bool indexed authorized);

    error BridgeMaxLengthReached();
    error TokenAddressIsZero();

    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the proxy contract
    /// @param _crossChainLayer Address of the cross-chain layer contract
    /// @param _eulerVaultConnector Address of the Euler vault connector contract
    function initialize(
        address _crossChainLayer,
        address _eulerVaultConnector,
        address _tacSAFactory,
        address _owner
    ) external initializer {
        __TacProxyV1Upgradeable_init(_crossChainLayer);
        __Ownable_init(_owner == address(0) ? msg.sender : _owner);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        eulerVaultConnector = IEthereumVaultConnector(_eulerVaultConnector);
        tacSAFactory = ISAFactory(_tacSAFactory);
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
        (IHooks.SaHooks memory hooks, BridgeBackData memory bridgeBackData, CallArguments memory callArguments) = abi.decode(arguments, (IHooks.SaHooks, BridgeBackData, CallArguments));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        
        SaHelper.executePreHooks(user, hooks);
        bytes memory result = ITacSmartAccount(payable(user)).execute(address(eulerVaultConnector), msg.value, abi.encodeWithSelector(IEthereumVaultConnector.call.selector, callArguments.targetContract, callArguments.onBehalfOfAccount, callArguments.value, callArguments.data));
        SaHelper.executePostHooks(user, hooks);
        if (bridgeBackData.tokensToBridge.length > 0) {
            _constructBridgeAndBridge(bridgeBackData, tacHeader);
        }
        emit Call(result);
    }

    function batch(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable _onlyCrossChainLayer {
        (IHooks.SaHooks memory hooks, BridgeBackData memory bridgeBackData, IEthereumVaultConnector.BatchItem[] memory items) = abi.decode(arguments, (IHooks.SaHooks, BridgeBackData, IEthereumVaultConnector.BatchItem[]));

        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, ) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);

        SaHelper.executePreHooks(user, hooks);
        (bool sucess, bytes memory returnData) = ITacSmartAccount(payable(user)).executeUnsafe(address(eulerVaultConnector), msg.value, abi.encodeWithSelector(IEthereumVaultConnector.batch.selector, items));
        console.log("sucess", sucess);
        console.logBytes(returnData);
        require(sucess, "Batch failed");
        bytes memory result = returnData;
        SaHelper.executePostHooks(user, hooks);
        if (bridgeBackData.tokensToBridge.length > 0) {
            _constructBridgeAndBridge(bridgeBackData, tacHeader);
        }
        emit Batch(result);
    }

    function setOperator(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer {
        (bytes19 addressPrefix, address operator, uint256 operatorBitField) = abi.decode(arguments, (bytes19, address, uint256));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);    
        (address user, ) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        ITacSmartAccount(payable(user)).execute(address(eulerVaultConnector), 0, abi.encodeWithSelector(IEthereumVaultConnector.setOperator.selector, addressPrefix, operator, operatorBitField));
        emit SetOperator(addressPrefix, operator, operatorBitField);
    }

    function setAccountOperator(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer {
        (address account, address operator, bool authorized) = abi.decode(arguments, (address, address, bool));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);    
        (address user, ) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        ITacSmartAccount(payable(user)).execute(address(eulerVaultConnector), 0, abi.encodeWithSelector(IEthereumVaultConnector.setAccountOperator.selector, account, operator, authorized));
        emit SetAccountOperator(account, operator, authorized);
    }

    function _constructBridgeAndBridge(BridgeBackData memory bridgeBackData, bytes calldata tacHeader) internal {
        require(bridgeBackData.tokensToBridge.length <= MAX_BRIDGE_TOKENS, BridgeMaxLengthReached());
        TokenAmount[] memory tokenAmounts = new TokenAmount[](bridgeBackData.tokensToBridge.length);
        for (uint256 i = 0; i < bridgeBackData.tokensToBridge.length; i++) {
            require(bridgeBackData.tokensToBridge[i] != address(0), TokenAddressIsZero());
            tokenAmounts[i] = TokenAmount(
                bridgeBackData.tokensToBridge[i],
                IERC20(bridgeBackData.tokensToBridge[i]).balanceOf(address(this))
            );
        }
        _bridgeTokens(tacHeader, tokenAmounts, "");
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
            SafeERC20.forceApprove(
                IERC20(tokens[i].evmAddress),
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
