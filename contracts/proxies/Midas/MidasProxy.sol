// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {TacProxyV1Upgradeable} from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import {OutMessageV1, TokenAmount, TacHeaderV1, NFTAmount} from "@tonappchain/evm-ccl/contracts/core/Structs.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IDepositVault } from "contracts/proxies/Midas/interface/IDepositVault.sol";
import { IRedemptionVault } from "contracts/proxies/Midas/interface/IRedemptionVault.sol";
import { IManageableVault } from "contracts/proxies/Midas/interface/IManageableVault.sol";
import {ITacSmartAccount} from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/ITacSmartAccount.sol";
import {ISAFactory} from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/ISAFactory.sol";

/**
 * @title MidasProxy
 * @dev Proxy contract for Midas
 */
contract MidasProxy is TacProxyV1Upgradeable, Ownable2StepUpgradeable, UUPSUpgradeable {

    address internal tacSAFactoryAddress;
    address internal depositVaultAddress;
    address internal redemptionVaultAddress;

    error ZeroAddress();

    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the contract.
     */
    function initialize(address adminAddress, address _tacSAFactoryAddress, address _depositVaultAddress, address _redemptionVaultAddress, address crossChainLayer) public initializer {
        __TacProxyV1Upgradeable_init(crossChainLayer);
        __Ownable_init(adminAddress == address(0) ? msg.sender : adminAddress);
        __UUPSUpgradeable_init();
        __Ownable2Step_init();
        require(_tacSAFactoryAddress != address(0) && _depositVaultAddress != address(0) && _redemptionVaultAddress != address(0) && crossChainLayer != address(0), ZeroAddress());
        tacSAFactoryAddress = _tacSAFactoryAddress;
        depositVaultAddress = _depositVaultAddress;
        redemptionVaultAddress = _redemptionVaultAddress;
    }

    /**
     * @dev Upgrades the contract.
     */
    function _authorizeUpgrade(address) internal override onlyOwner {}

    /**
     * @dev A proxy to depositInstant
     * @param tacHeader TacHeaderV1 struct containing the header information
     * @param arguments arguments data
     */
    function depositInstant(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public _onlyCrossChainLayer {
        (address tokenIn,
        uint256 amountToken,
        uint256 minReceiveAmount,
        bytes32 referrerId) = abi.decode(arguments, (address, uint256, uint256, bytes32));

        // grant token approvals
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = ISAFactory(tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);

        SafeERC20.safeTransfer(IERC20(tokenIn), user, amountToken);

        ITacSmartAccount(user).approve(tokenIn, depositVaultAddress, amountToken);

        ITacSmartAccount(user).execute(
            depositVaultAddress,
            0,
            abi.encodeWithSelector(
                IDepositVault.depositInstant.selector,
                tokenIn, amountToken, minReceiveAmount, referrerId
                )
        );


        address mToken = IManageableVault(depositVaultAddress).mToken();

        uint256 amount = IERC20(mToken).balanceOf(user);


        ITacSmartAccount(user).execute(
            mToken,
            0,
            abi.encodeWithSelector(
                IERC20(mToken).transfer.selector,
                address(this),
                amount
            )
        );


        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(mToken, amount);

        _bridgeTokens(tacHeader, tokensToBridge, "");
    }

    /**
     * @dev A proxy to depositRequest
     * @param tacHeader TacHeaderV1 struct containing the header information
     * @param arguments arguments data
     */
    function depositRequest(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public _onlyCrossChainLayer {
        (address tokenIn,
        uint256 amountToken,
        bytes32 referrerId) = abi.decode(arguments, (address, uint256, bytes32));


        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = ISAFactory(tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);

        // grant token approvals
        SafeERC20.safeTransfer(IERC20(tokenIn), user, amountToken);

        ITacSmartAccount(user).approve(tokenIn, depositVaultAddress, amountToken);

        ITacSmartAccount(user).execute(
            depositVaultAddress,
            0,
            abi.encodeWithSelector(
                IDepositVault.depositRequest.selector,
                tokenIn,
                amountToken,
                referrerId
                )
        );

    }

     /**
     * @dev A proxy to redeemInstant
     * @param tacHeader TacHeaderV1 struct containing the header information
     * @param arguments arguments data
     */
    function redeemInstant(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public _onlyCrossChainLayer {
        (address tokenOut,
        uint256 amountMTokenIn,
        uint256 minReceiveAmount) = abi.decode(arguments, (address, uint256, uint256));
        address mToken = IManageableVault(redemptionVaultAddress).mToken();
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = ISAFactory(tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);

      
        SafeERC20.safeTransfer(IERC20(mToken), user, amountMTokenIn);

        ITacSmartAccount(user).approve(mToken, redemptionVaultAddress, amountMTokenIn);

        ITacSmartAccount(user).execute(
            redemptionVaultAddress,
            0,
            abi.encodeWithSelector(
                IRedemptionVault.redeemInstant.selector,
                tokenOut,
                amountMTokenIn,
                minReceiveAmount
                )
        );

        uint256 amount = IERC20(tokenOut).balanceOf(user);


        ITacSmartAccount(user).execute(
            tokenOut,
            0,
            abi.encodeWithSelector(
                IERC20(tokenOut).transfer.selector,
                address(this),
                amount
            )
        );

        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(tokenOut, amount);

        _bridgeTokens(tacHeader, tokensToBridge, "");
    }

     /**
     * @dev A proxy to redeemRequest
     * @param tacHeader TacHeaderV1 struct containing the header information
     * @param arguments arguments data
     */
    function redeemRequest(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public _onlyCrossChainLayer {
        (address tokenOut,
        uint256 amountMTokenIn) = abi.decode(arguments, (address, uint256));

        address mToken = IManageableVault(redemptionVaultAddress).mToken();

        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);

        (address user,) = ISAFactory(tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);

        // grant token approvals
        SafeERC20.safeTransfer(IERC20(mToken), user, amountMTokenIn);

        ITacSmartAccount(user).approve(mToken, redemptionVaultAddress, amountMTokenIn);

        ITacSmartAccount(user).execute(
            redemptionVaultAddress,
            0,
            abi.encodeWithSelector(
                IRedemptionVault.redeemRequest.selector,
                tokenOut,
                amountMTokenIn
                )
        );

    }

    function claimSA(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public _onlyCrossChainLayer {
    (address asset) = abi.decode(arguments, (address));

    TacHeaderV1 memory header = _decodeTacHeader(tacHeader);

    (address user,) = ISAFactory(tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);

    ITacSmartAccount(user).execute(
        asset,
        0,
        abi.encodeWithSelector(
            IERC20(asset).transfer.selector,
            address(this),
            IERC20(asset).balanceOf(user)
        )
    );

    TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(
            asset,
            IERC20(asset).balanceOf(address(this))
        );

        _bridgeTokens(tacHeader, tokensToBridge, "");
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


