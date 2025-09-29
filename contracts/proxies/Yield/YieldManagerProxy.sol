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
import {IManager} from "./IManager.sol";

/**
 * @title YieldManagerProxy
 * @dev Proxy contract for Yield Manager
 */
contract YieldManagerProxy is
    TacProxyV1Upgradeable,
    Ownable2StepUpgradeable,
    UUPSUpgradeable
{
    address public managerAddress;
    address public yUSD;
    address public tacSAFactoryAddress;

    error InvalidAmount();

    event Deposit(address indexed user, address indexed yToken, address indexed asset, uint256 amount);
    event Redeem(address indexed user, address indexed yToken, address indexed asset, uint256 amount);
    event ClaimYToken(address indexed user, address indexed yToken, uint256 amount);
    event ClaimAsset(address indexed user, address indexed asset, uint256 amount);

    struct DepositArguments {
        address yToken;
        address asset;
        uint256 amount;
        address callback;
        bytes callbackData;
        bytes32 referralCode;
    }

    struct WithdrawArguments {
        address yToken;
        address asset;
        uint256 shares;
        address callback;
        bytes callbackData;
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _adminAddress,
        address _managerAddress,
        address _yUSD,
        address _tacSAFactoryAddress,
        address _crossChainLayer
    ) public initializer {
        __TacProxyV1Upgradeable_init(_crossChainLayer);
        __Ownable_init(_adminAddress);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        tacSAFactoryAddress = _tacSAFactoryAddress;
        yUSD = _yUSD;
        managerAddress = _managerAddress;
    }

    /**
     * @dev Upgrades the contract.
     */
    function _authorizeUpgrade(address) internal override onlyOwner {}

    /**
     * @dev A proxy to deposit
     * @param tacHeader TacHeaderV1 struct containing the header information
     * @param arguments arguments data
     */
    function deposit(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public _onlyCrossChainLayer {
        DepositArguments memory depositArguments = abi.decode(
            arguments,
            (DepositArguments)
        );
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, ) = ISAFactory(tacSAFactoryAddress)
            .getOrCreateSmartAccount(header.tvmCaller);
        
        SafeERC20.safeTransfer(
            IERC20(depositArguments.asset),
            user,
            depositArguments.amount
        );
        ITacSmartAccount(user).approve(
            depositArguments.asset,
            managerAddress,
            depositArguments.amount
        );

        ITacSmartAccount(user)
            .execute(
                managerAddress,
                0,
                abi.encodeWithSelector(
                    IManager.deposit.selector,
                    depositArguments.yToken,
                    depositArguments.asset,
                    depositArguments.amount,
                    user,
                    depositArguments.callback,
                    depositArguments.callbackData,
                    depositArguments.referralCode
                )
            );
        if (IERC20(depositArguments.asset).balanceOf(user) > 0) {
            ITacSmartAccount(user).execute(
                depositArguments.asset,
                0,
                abi.encodeWithSelector(IERC20.transfer.selector, address(this), IERC20(depositArguments.asset).balanceOf(user))
            );
            TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
            tokensToBridge[0] = TokenAmount(depositArguments.asset, IERC20(depositArguments.asset).balanceOf(user));
            _bridgeTokens(tacHeader, tokensToBridge, "");
        }
        emit Deposit(user, depositArguments.yToken, depositArguments.asset, depositArguments.amount);
    }

    /**
     * @dev A proxy to withdraw
     * @param tacHeader TacHeaderV1 struct containing the header information
     * @param arguments arguments data
     */
    function redeem(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public _onlyCrossChainLayer {
        WithdrawArguments memory withdrawArguments = abi.decode(
            arguments,
            (WithdrawArguments)
        );

        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, ) = ISAFactory(tacSAFactoryAddress)
            .getOrCreateSmartAccount(header.tvmCaller);

        SafeERC20.safeTransfer(IERC20(withdrawArguments.yToken), user, withdrawArguments.shares);

        ITacSmartAccount(user).approve(
            withdrawArguments.yToken,
            managerAddress,
            withdrawArguments.shares
        );

        ITacSmartAccount(user).execute(
            managerAddress,
            0,
            abi.encodeWithSelector(
                IManager.redeem.selector,
                user,
                withdrawArguments.yToken,
                withdrawArguments.asset,
                withdrawArguments.shares,
                user,
                withdrawArguments.callback,
                withdrawArguments.callbackData
            )
        );
        emit Redeem(user, withdrawArguments.yToken, withdrawArguments.asset, withdrawArguments.shares);
    }

    function claimYToken(
        bytes calldata tacHeader,
        bytes calldata
    ) public _onlyCrossChainLayer {
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, ) = ISAFactory(tacSAFactoryAddress)
            .getOrCreateSmartAccount(header.tvmCaller);
        uint256 amount = IERC20(yUSD).balanceOf(user);
        ITacSmartAccount(user).execute(
            yUSD,
            0,
            abi.encodeWithSelector(
                IERC20(yUSD).transfer.selector,
                address(this),
                amount
            )
        );

        TokenAmount[] memory tokens = new TokenAmount[](1);
        tokens[0] = TokenAmount(yUSD, amount);

        _bridgeTokens(tacHeader, tokens, "");
        emit ClaimYToken(user, yUSD, amount);
    }

    function claimAsset(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public _onlyCrossChainLayer {
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        address asset = abi.decode(arguments, (address));
        (address user, ) = ISAFactory(tacSAFactoryAddress)
            .getOrCreateSmartAccount(header.tvmCaller);
        uint256 amount = IERC20(asset).balanceOf(user);
        ITacSmartAccount(user).execute(
            asset,
            0,
            abi.encodeWithSelector(
                IERC20(asset).transfer.selector,
                address(this),
                amount
            )
        );
        TokenAmount[] memory tokens = new TokenAmount[](1);
        tokens[0] = TokenAmount(asset, amount);
        _bridgeTokens(tacHeader, tokens, "");
        emit ClaimAsset(user, asset, amount);
    }

    /// @notice Bridges tokens and NFTs to the cross-chain layer
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
}
