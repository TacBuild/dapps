// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {TacProxyV1Upgradeable} from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import {OutMessageV1, TokenAmount, TacHeaderV1, NFTAmount} from "@tonappchain/evm-ccl/contracts/core/Structs.sol";
import {ITacSmartAccount} from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/ITacSmartAccount.sol";
import {ISAFactory} from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/ISAFactory.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IMultiAccount} from "./interface/IMultiAccount.sol";

contract OrbsProxy is TacProxyV1Upgradeable, Ownable2StepUpgradeable, UUPSUpgradeable {

    IMultiAccount public multiAccount;
    ISAFactory public tacSAFactory;
    address public collateralToken;

    event AccountAdded(address indexed account, string name, string tvmCaller);
    event AccountNameEdited(address indexed account, string newName, string tvmCaller);
    event DepositAndAllocatedForAccount(address indexed account, uint256 amount, string tvmCaller);
    event DelegatedAccesses(address indexed account, address indexed target, bytes4[] selector, bool state, string tvmCaller);
    event WithdrawnFromAccount(address indexed account, uint256 amount, string tvmCaller);
    event AccountAddedWithReferral(address indexed account, string name, string tvmCaller);
    event AccountAddedWithReferralAndDepositAndAllocate(address indexed account, string name, string tvmCaller);
    event LinkReferral(address indexed account, address referrer, string tvmCaller);
    constructor() {
        _disableInitializers();
    }
    
    function initialize(address admin, address crossChainLayer, IMultiAccount _multiAccount, ISAFactory _tacSAFactory, address _collateralToken) external initializer {
        __TacProxyV1Upgradeable_init(crossChainLayer);
        __Ownable_init(admin);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        multiAccount = _multiAccount;
        tacSAFactory = _tacSAFactory;
        collateralToken = _collateralToken;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function addAccount(bytes calldata tacHeader, bytes calldata arguments) external _onlyCrossChainLayer {
        string memory name = abi.decode(arguments, (string));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, ) = ISAFactory(tacSAFactory).getOrCreateSmartAccount(header.tvmCaller);
        ITacSmartAccount(user).execute(address(multiAccount), 0, abi.encodeWithSelector(IMultiAccount.addAccount.selector, name));
        emit AccountAdded(user, name, header.tvmCaller);
    }

    function addAccountWithReferral(bytes calldata tacHeader, bytes calldata arguments) external _onlyCrossChainLayer {
        (string memory name, address referrer) = abi.decode(arguments, (string, address));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, ) = ISAFactory(tacSAFactory).getOrCreateSmartAccount(header.tvmCaller);
        ITacSmartAccount(user).execute(address(multiAccount), 0, abi.encodeWithSelector(IMultiAccount.addAccountWithReferral.selector, name, referrer));
        emit AccountAddedWithReferral(user, name, header.tvmCaller);
    }

    function addAccountWithReferralAndDepositAndAllocate(bytes calldata tacHeader, bytes calldata arguments) external _onlyCrossChainLayer {
        (string memory name, address referrer, uint256 amount) = abi.decode(arguments, (string, address, uint256));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, ) = ISAFactory(tacSAFactory).getOrCreateSmartAccount(header.tvmCaller);
        SafeERC20.safeTransfer(IERC20(collateralToken), user, amount);
        ITacSmartAccount(user).approve(collateralToken, address(multiAccount), amount);
        ITacSmartAccount(user).execute(address(multiAccount), 0, abi.encodeWithSelector(IMultiAccount.addAccountWithReferralAndDepositAndAllocate.selector, name, referrer, amount));
        emit AccountAddedWithReferralAndDepositAndAllocate(user, name, header.tvmCaller);
    }

    function linkReferral(bytes calldata tacHeader, bytes calldata arguments) external _onlyCrossChainLayer {
        (address referrer) = abi.decode(arguments, (address));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, ) = ISAFactory(tacSAFactory).getOrCreateSmartAccount(header.tvmCaller);
        ITacSmartAccount(user).execute(address(multiAccount), 0, abi.encodeWithSelector(IMultiAccount.linkReferral.selector, referrer));
        emit LinkReferral(user, referrer, header.tvmCaller);
    }

    function editAccountName(bytes calldata tacHeader, bytes calldata arguments) external _onlyCrossChainLayer {
        (address account, string memory newName) = abi.decode(arguments, (address, string));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, ) = ISAFactory(tacSAFactory).getOrCreateSmartAccount(header.tvmCaller);
        ITacSmartAccount(user).execute(address(multiAccount), 0, abi.encodeWithSelector(IMultiAccount.editAccountName.selector, account, newName));
        emit AccountNameEdited(account, newName, header.tvmCaller);
    }

    function depositAndAllocateForAccount(bytes calldata tacHeader, bytes calldata arguments) external _onlyCrossChainLayer {
        (address account, uint256 amount) = abi.decode(arguments, (address, uint256));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, ) = ISAFactory(tacSAFactory).getOrCreateSmartAccount(header.tvmCaller);
        SafeERC20.safeTransfer(IERC20(collateralToken), user, amount);
        ITacSmartAccount(user).approve(collateralToken, address(multiAccount), amount);
        ITacSmartAccount(user).execute(address(multiAccount), 0, abi.encodeWithSelector(IMultiAccount.depositAndAllocateForAccount.selector, account, amount));
        emit DepositAndAllocatedForAccount(account, amount, header.tvmCaller);
    }

    function depositForAccount(bytes calldata tacHeader, bytes calldata arguments) external _onlyCrossChainLayer {
        (address account, uint256 amount) = abi.decode(arguments, (address, uint256));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, ) = ISAFactory(tacSAFactory).getOrCreateSmartAccount(header.tvmCaller);
        SafeERC20.safeTransfer(IERC20(collateralToken), user, amount);
        ITacSmartAccount(user).approve(collateralToken, address(multiAccount), amount);
        ITacSmartAccount(user).execute(address(multiAccount), 0, abi.encodeWithSelector(IMultiAccount.depositForAccount.selector, account, amount));
    }

    function delegateAccesses(bytes calldata tacHeader, bytes calldata arguments) external _onlyCrossChainLayer {
        (address account, address target, bytes4[] memory selector, bool state) = abi.decode(arguments, (address, address, bytes4[], bool));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, ) = ISAFactory(tacSAFactory).getOrCreateSmartAccount(header.tvmCaller);
        ITacSmartAccount(user).execute(address(multiAccount), 0, abi.encodeWithSelector(IMultiAccount.delegateAccesses.selector, account, target, selector, state));
        emit DelegatedAccesses(account, target, selector, state, header.tvmCaller);
    }

    function withdrawFromAccount(bytes calldata tacHeader, bytes calldata arguments) external _onlyCrossChainLayer {
        (address account, uint256 amount) = abi.decode(arguments, (address, uint256));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, ) = ISAFactory(tacSAFactory).getOrCreateSmartAccount(header.tvmCaller);
        ITacSmartAccount(user).execute(address(multiAccount), 0, abi.encodeWithSelector(IMultiAccount.withdrawFromAccount.selector, account, amount));
        ITacSmartAccount(user).execute(collateralToken, 0, abi.encodeWithSelector(IERC20.transfer.selector, address(this), amount));
        TokenAmount[] memory tokens = new TokenAmount[](1);
        tokens[0] = TokenAmount(collateralToken, amount);
        if (IERC20(collateralToken).balanceOf(address(this)) > 0) {
            _bridgeTokens(tacHeader, tokens, "", 0);
            emit WithdrawnFromAccount(account, amount, header.tvmCaller);
        }
    }

    /// @notice Bridges tokens and NFTs to the cross-chain layer
    /// @param tacHeader TAC header data
    /// @param tokens Array of token amounts to bridge
    /// @param payload Additional payload data
    /// @param nativeAmount Native amount to bridge
    function _bridgeTokens(
        bytes calldata tacHeader,
        TokenAmount[] memory tokens,
        string memory payload,
        uint256 nativeAmount
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
        _sendMessageV1(message, nativeAmount);
    }
}