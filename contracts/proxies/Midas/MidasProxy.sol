// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import { TransferHelper } from 'contracts/helpers/TransferHelper.sol';
import { TacProxyV1Upgradeable } from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import { OutMessageV2, TokenAmount, TacHeaderV1, NFTAmount } from "@tonappchain/evm-ccl/contracts/L2/Structs.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IDepositVault } from "contracts/proxies/Midas/interface/IDepositVault.sol";
import { IRedemptionVault } from "contracts/proxies/Midas/interface/IRedemptionVault.sol";
import { IManageableVault } from "contracts/proxies/Midas/interface/IManageableVault.sol";
import "hardhat/console.sol";

/**
 * @title MidasProxy
 * @dev Proxy contract for Midas
 */
contract MidasProxy is TacProxyV1Upgradeable, OwnableUpgradeable, UUPSUpgradeable {
    address public constant _ETH_ADDRESS_ = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    address internal _depositVaultAddress;
    address internal _redemptionVaultAddress;
   

    /**
     * @dev Initialize the contract.
     */
    function initialize(address adminAddress, address depositVaultAddress, address redemptionVaultAddress, address crossChainLayer) public initializer {
        __TacProxyV1Upgradeable_init(crossChainLayer);
        __Ownable_init(adminAddress);
        __UUPSUpgradeable_init();
        _depositVaultAddress=depositVaultAddress;
        _redemptionVaultAddress=redemptionVaultAddress;
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
    ) public payable _onlyCrossChainLayer {
        (address tokenIn,
        uint256 amountToken,
        uint256 minReceiveAmount,
        bytes32 referrerId) =
                abi.decode(arguments, (address, uint256, uint256, bytes32));
        
        // grant token approvals

        TransferHelper.safeApprove(tokenIn, _depositVaultAddress, amountToken);

        console.log("depositInstant");
        uint256 tokenAmount = IERC20(tokenIn).balanceOf(address(this));

        console.log("tokenAmount proxy", tokenAmount);


        IDepositVault(_depositVaultAddress).depositInstant(
            tokenIn, amountToken, minReceiveAmount, referrerId
        );

        console.log("M token");

        address mToken = IManageableVault(_depositVaultAddress).mToken();

        console.log(mToken);

        uint256 amountOut = IERC20(mToken).balanceOf(address(this));

        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);

        tokensToBridge[0] = TokenAmount(
            mToken,
            amountOut
        );

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
    ) public payable _onlyCrossChainLayer {
        (address tokenIn,
        uint256 amountToken,
        bytes32 referrerId) = abi.decode(arguments, (address, uint256, bytes32));
        
        // grant token approvals
        TransferHelper.safeApprove(tokenIn, _depositVaultAddress, amountToken);

        uint256 requestId = IDepositVault(_depositVaultAddress).depositRequest(
            tokenIn, amountToken, referrerId
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
    ) public payable _onlyCrossChainLayer {
        (address tokenOut,
        uint256 amountMTokenIn,
        uint256 minReceiveAmount) = abi.decode(arguments, (address, uint256, uint256));
        
        address mToken = IManageableVault(_redemptionVaultAddress).mToken();

        // grant token approvals
        TransferHelper.safeApprove(mToken, _redemptionVaultAddress, amountMTokenIn);

        IRedemptionVault(_redemptionVaultAddress).redeemInstant(
            tokenOut, amountMTokenIn, minReceiveAmount
        );

        uint256 amountOut = IERC20(tokenOut).balanceOf(address(this));

        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);

        tokensToBridge[0] = TokenAmount(
            tokenOut,
            amountOut
        );

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
    ) public payable _onlyCrossChainLayer {
        (address tokenOut,
        uint256 amountMTokenIn) = abi.decode(arguments, (address, uint256));
        
        address mToken = IManageableVault(_redemptionVaultAddress).mToken();

        // grant token approvals
        TransferHelper.safeApprove(mToken, _redemptionVaultAddress, amountMTokenIn);

        IRedemptionVault(_redemptionVaultAddress).redeemRequest(
            tokenOut, amountMTokenIn
        );
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
}
