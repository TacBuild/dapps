// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
// TON USER --> connecting with our DAPP --> send tx using the tac-sdk to the CCL --> the Zerolend Proxy on TAC_TURIN --> Zerolend on TAC_TURIN
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// Standard Proxy Imports

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
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
// Pool Imports
import {IPool, DataTypes} from "./interfaces/IPool.sol";


struct SupplyArguments {
    address asset;
    uint256 amount;
    address onBehalfOf;
    uint16 referralCode;
}

struct WithdrawArguments {
    address asset;
    uint256 amount;
    address to;
}

struct BorrowArguments {
    address asset;
    uint256 amount;
    uint256 interestRateMode;
    uint16 referralCode;
    address onBehalfOf;
}

struct RepayArguments {
    address asset;
    uint256 amount;
    uint256 interestRateMode;
    address onBehalfOf;
}

/**
 * @title ZerolendPoolProxy
 * @dev Proxy contract for interacting with the Pool contract.
 * This contract handles supply, withdraw, borrow, and repay operations.
 */
contract ZerolendPoolProxy is
    TacProxyV1Upgradeable,
    UUPSUpgradeable,
    OwnableUpgradeable {
    using SafeERC20 for IERC20;

    address public _appAddress;
    address public _tacSAFactoryAddress;



    function initialize(address deployer, address appAddress,address tacSAFactoryAddress, address _crossChainLayer) public initializer {
        __TacProxyV1Upgradeable_init(_crossChainLayer);
        __Ownable_init(deployer);
        __UUPSUpgradeable_init();
        _tacSAFactoryAddress = tacSAFactoryAddress;
        _appAddress = appAddress;
    }

    /// @notice Internal function to authorize upgrades
    /// @param newImplementation Address of the new implementation
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    /**
     * @dev External function to handle the supply operation via cross-chain layer.
     * @param tacHeader The TAC header for cross-chain communication.
     * @param arguments The encoded supply arguments.
     */
    function supply(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable _onlyCrossChainLayer {
        SupplyArguments memory args = abi.decode(arguments, (SupplyArguments));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);

        // Get or create the Smart Account
        (address user, bool isNewAccount) = TacSAFactory(_tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);

        TransferHelper.safeTransfer(args.asset, user, args.amount);

        ITacSmartAccount(user).execute(
            args.asset,
            0,
            abi.encodeWithSelector(
                IERC20(args.asset).approve.selector,
                _appAddress,
                args.amount
            )
        );


        ITacSmartAccount(user).execute(
            _appAddress,
            0,
            abi.encodeWithSelector(
                IPool.supply.selector,
                args.asset,
                args.amount,
                user,
                args.referralCode
                )
        );
    }

    /**
     * @dev External function to handle the withdraw operation via cross-chain layer.
     * @param tacHeader The TAC header for cross-chain communication.
     * @param arguments The encoded withdraw arguments.
     */
    function withdraw(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable _onlyCrossChainLayer {
        WithdrawArguments memory args = abi.decode(
            arguments,
            (WithdrawArguments)
        );
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);

        (address user, bool isNewAccount) = TacSAFactory(_tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);


        //Approve the Pool to pull the ATokens from smart account
        ITacSmartAccount(user).execute(
            args.asset,
            0,
            abi.encodeWithSelector(
                IERC20(args.asset).approve.selector,
                _appAddress,
                args.amount
            )
        );

        ITacSmartAccount(user).execute(
            _appAddress,
            0,
            abi.encodeWithSelector(
                IPool.withdraw.selector,
                args.asset,
                args.amount,
                address(this)
                )
        );

        uint256 withdrawnAmount = IERC20(args.asset).balanceOf(address(this));

        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(
            args.asset,
            withdrawnAmount
        );


        NFTAmount[] memory nftsToBridge = new NFTAmount[](0);

        _bridgeTokens(tacHeader, tokensToBridge, nftsToBridge, "");
    }

    /**
     * @dev External function to handle the borrow operation via cross-chain layer.
     * @param tacHeader The TAC header for cross-chain communication.
     * @param arguments The encoded borrow arguments.
     */
    function borrow(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable _onlyCrossChainLayer {
        BorrowArguments memory args = abi.decode(arguments, (BorrowArguments));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);

        // Get or create the Smart Account
        (address user, bool isNewAccount) = TacSAFactory(_tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);


        ITacSmartAccount(user).execute(
            _appAddress,
            0,
            abi.encodeWithSelector(
                IPool.borrow.selector,
                args.asset,
                args.amount,
                args.interestRateMode,
                args.referralCode,
                user
                )
        );


        ITacSmartAccount(user).execute(
            args.asset,
            0,
            abi.encodeWithSelector(
                IERC20(args.asset).transfer.selector,
                address(this),
                args.amount
            )
        );


        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(
            args.asset,
            args.amount
        );

        NFTAmount[] memory nftsToBridge = new NFTAmount[](0);

        _bridgeTokens(tacHeader, tokensToBridge, nftsToBridge, "");
    }

    /**
     * @dev External function to handle the repay operation via cross-chain layer.
     * @param tacHeader The TAC header for cross-chain communication.
     * @param arguments The encoded repay arguments.
     */
    function repay(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable _onlyCrossChainLayer {
        RepayArguments memory args = abi.decode(arguments, (RepayArguments));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        // Get or create the Smart Account

        (address user, bool isNewAccount) = TacSAFactory(_tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);

        TransferHelper.safeTransfer(args.asset, user, args.amount);

        ITacSmartAccount(user).execute(
            args.asset,
            0,
            abi.encodeWithSelector(
                IERC20(args.asset).approve.selector,
                _appAddress,
                args.amount
            )
        );


        ITacSmartAccount(user).execute(
            args.asset,
            0,
            abi.encodeWithSelector(
                IPool(_appAddress).repay.selector,
                args.asset,
                args.amount,
                args.interestRateMode,
                user
            )
        );
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