// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {TacProxyV1Upgradeable} from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import {OutMessageV1, TokenAmount, TacHeaderV1, NFTAmount} from "@tonappchain/evm-ccl/contracts/core/Structs.sol";
import {ITacSmartAccount} from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/ITacSmartAccount.sol";
import {ISAFactory} from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/ISAFactory.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IManager} from "./IManager.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "hardhat/console.sol";

/**
 * @title YieldManagerProxy
 * @dev Proxy contract for Yield Manager
 */
contract YieldManagerProxy is
    TacProxyV1Upgradeable,
    Ownable2StepUpgradeable,
    UUPSUpgradeable,
    IERC721Receiver
{
    address public managerAddress;
    address public yUSD;
    address public tacSAFactoryAddress;

    struct DepositArguments {
        address yToken;
        address asset;
        uint256 amount;
        address receiver;
        address callback;
        bytes callbackData;
        bytes32 referralCode;
    }

    struct WithdrawArguments {
        address yToken;
        address asset;
        uint256 shares;
        address receiver;
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
    ) public payable _onlyCrossChainLayer {
        DepositArguments memory depositArguments = abi.decode(
            arguments,
            (DepositArguments)
        );
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, ) = ISAFactory(tacSAFactoryAddress)
            .getOrCreateSmartAccount(header.tvmCaller);
        // require(
        //     IERC20(depositArguments.asset).balanceOf(address(this)) ==
        //         depositArguments.amount,
        //     "Invalid amount"
        // );
        // console.log(1);
        // SafeERC20.safeTransfer(
        //     IERC20(depositArguments.asset),
        //     user,
        //     depositArguments.amount
        // );
        console.log(2);
        // ITacSmartAccount(user).approve(
        //     depositArguments.asset,
        //     managerAddress,
        //     depositArguments.amount
        // );
        SafeERC20.forceApprove(
            IERC20(depositArguments.asset),
            managerAddress,
            depositArguments.amount
        );
        IManager(managerAddress).deposit(
            depositArguments.yToken,
            depositArguments.asset,
            depositArguments.amount,
            address(this),
            depositArguments.callback,
            depositArguments.callbackData,
            depositArguments.referralCode
        );
        console.log(3);
        console.log("user", user);
        console.log("depositArguments.receiver", depositArguments.receiver);

        // (bool success, bytes memory data) = ITacSmartAccount(user)
        //     .executeUnsafe(
        //         managerAddress,
        //         0,
        //         abi.encodeWithSelector(
        //             IManager.deposit.selector,
        //             depositArguments.yToken,
        //             depositArguments.asset,
        //             depositArguments.amount,
        //             address(this),
        //             depositArguments.callback,
        //             depositArguments.callbackData,
        //             depositArguments.referralCode
        //         )
        //     );
        // console.log(success);
        // console.logBytes(data);
        // console.log(4);
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

        SafeERC20.safeTransfer(IERC20(yUSD), user, withdrawArguments.shares);

        ITacSmartAccount(user).execute(
            yUSD,
            0,
            abi.encodeWithSelector(
                IERC20(yUSD).approve.selector,
                managerAddress,
                withdrawArguments.shares
            )
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
                withdrawArguments.receiver,
                withdrawArguments.callback,
                withdrawArguments.callbackData
            )
        );
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
        SafeERC20.safeTransfer(IERC20(asset), address(this), amount);

        TokenAmount[] memory tokens = new TokenAmount[](1);
        tokens[0] = TokenAmount(asset, amount);
        _bridgeTokens(tacHeader, tokens, "");
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

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
