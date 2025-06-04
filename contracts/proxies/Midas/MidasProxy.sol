// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import { TransferHelper } from 'contracts/helpers/TransferHelper.sol';
import {TacProxyV1Upgradeable} from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import {OutMessageV1, TokenAmount, TacHeaderV1, NFTAmount} from "@tonappchain/evm-ccl/contracts/core/Structs.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import { IDepositVault } from "contracts/proxies/Midas/interface/IDepositVault.sol";
import { IRedemptionVault } from "contracts/proxies/Midas/interface/IRedemptionVault.sol";
import { IManageableVault } from "contracts/proxies/Midas/interface/IManageableVault.sol";

import {TacSmartAccount} from "../../TacSmartAccounts/TacSmartAccount.sol";
import {TacSAFactory} from "../../TacSmartAccounts/TacSAFactory.sol";
import {ITacSmartAccount} from "../../TacSmartAccounts/Interface/ITacSmartAccount.sol";

/**
 * @title MidasProxy
 * @dev Proxy contract for Midas
 */
contract MidasProxy is TacProxyV1Upgradeable, OwnableUpgradeable, UUPSUpgradeable {
    address internal _tacSAFactoryAddress;
    address internal _depositVaultAddress;
    address internal _redemptionVaultAddress;


    /**
     * @dev Initialize the contract.
     */
    function initialize(address adminAddress, address tacSAFactoryAddress, address depositVaultAddress, address redemptionVaultAddress, address crossChainLayer) public initializer {
        __TacProxyV1Upgradeable_init(crossChainLayer);
        __Ownable_init(adminAddress);
        __UUPSUpgradeable_init();
        _tacSAFactoryAddress = tacSAFactoryAddress;
        _depositVaultAddress = depositVaultAddress;
        _redemptionVaultAddress = redemptionVaultAddress;
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
        (address user, bool isNewAccount) = TacSAFactory(_tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);

        TransferHelper.safeTransfer(tokenIn, user, amountToken);

        ITacSmartAccount(user).execute(
            tokenIn,
            0,
            abi.encodeWithSelector(
                IERC20(tokenIn).approve.selector,
                _depositVaultAddress,
                amountToken
            )
        );

        ITacSmartAccount(user).execute(
            _depositVaultAddress,
            0,
            abi.encodeWithSelector(
                IDepositVault.depositInstant.selector,
                tokenIn, amountToken, minReceiveAmount, referrerId
                )
        );


        address mToken = IManageableVault(_depositVaultAddress).mToken();

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

        _bridgeTokens(tacHeader, tokensToBridge, new NFTAmount[](0), "");
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
        (address user, bool isNewAccount) = TacSAFactory(_tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);

        require(tokenIn != address(0), "Invalid token address");
        require(amountToken > 0, "Invalid amount");
        require(IERC20(tokenIn).balanceOf(address(this)) >= amountToken, "Insufficient balance for transfer");


        // grant token approvals
        TransferHelper.safeTransfer(tokenIn, user, amountToken);

        ITacSmartAccount(user).execute(
            tokenIn,
            0,
            abi.encodeWithSelector(
                IERC20(tokenIn).approve.selector,
                _depositVaultAddress,
                amountToken
            )
        );

        ITacSmartAccount(user).execute(
            _depositVaultAddress,
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
        address mToken = IManageableVault(_redemptionVaultAddress).mToken();
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, bool isNewAccount) = TacSAFactory(_tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);

      
        TransferHelper.safeTransfer(mToken, user, amountMTokenIn);

        ITacSmartAccount(user).execute(
            mToken,
            0,
            abi.encodeWithSelector(
                IERC20(mToken).approve.selector,
                _redemptionVaultAddress,
                amountMTokenIn
            )
        );

        ITacSmartAccount(user).execute(
            _redemptionVaultAddress,
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

        _bridgeTokens(tacHeader, tokensToBridge, new NFTAmount[](0), "");
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

        address mToken = IManageableVault(_redemptionVaultAddress).mToken();

        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);

        (address user, bool isNewAccount) = TacSAFactory(_tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);

        // grant token approvals
        TransferHelper.safeTransfer(mToken, user, amountMTokenIn);

        ITacSmartAccount(user).execute(
            mToken,
            0,
            abi.encodeWithSelector(
                IERC20(mToken).approve.selector,
                _redemptionVaultAddress,
                amountMTokenIn
            )
        );

        ITacSmartAccount(user).execute(
            _redemptionVaultAddress,
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

    (address user, bool isNewAccount) = TacSAFactory(_tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);

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

        _bridgeTokens(tacHeader, tokensToBridge, new NFTAmount[](0), "");
}



    /// @notice Bridges tokens and NFTs to the cross-chain layer
    /// @param tacHeader TAC header data
    /// @param tokens Array of token amounts to bridge
    /// @param nfts Array of NFT amounts to bridge
    /// @param payload Additional payload data
    function _bridgeTokens(
        bytes calldata tacHeader,
        TokenAmount[] memory tokens,
        NFTAmount[] memory nfts,
        string memory payload
    ) private {
        for (uint256 i = 0; i < tokens.length; i++) {
            TransferHelper.safeApprove(
                tokens[i].evmAddress,
                _getCrossChainLayerAddress(),
                tokens[i].amount
            );
        }

        for (uint256 i = 0; i < nfts.length; i++) {
            IERC721(nfts[i].evmAddress).approve(_getCrossChainLayerAddress(), nfts[i].tokenId);
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
            toBridgeNFT: nfts
        });
        _sendMessageV1(message, address(this).balance);
    }
}


