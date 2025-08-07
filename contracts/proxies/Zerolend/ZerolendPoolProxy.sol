// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OutMessageV1, TokenAmount, TacHeaderV1, NFTAmount} from "@tonappchain/evm-ccl/contracts/core/Structs.sol";
import {ICrossChainLayer} from "@tonappchain/evm-ccl/contracts/interfaces/ICrossChainLayer.sol";
import {TacProxyV1Upgradeable} from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {ITacSmartAccount} from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/ITacSmartAccount.sol";
import {ISAFactory} from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/ISAFactory.sol";
import {IPool, DataTypes} from "./interfaces/IPool.sol";


struct SupplyArguments {
    address asset;
    uint256 amount;
    uint16 referralCode;
}

struct WithdrawArguments {
    address asset;
    uint256 amount;
}

struct BorrowArguments {
    address asset;
    uint256 amount;
    uint256 interestRateMode;
    uint16 referralCode;
}

struct RepayArguments {
    address asset;
    uint256 amount;
    uint256 interestRateMode;
}

/**
 * @title ZerolendPoolProxy
 * @dev Proxy contract for interacting with the Pool contract.
 * This contract handles supply, withdraw, borrow, and repay operations.
 */
contract ZerolendPoolProxy is
    TacProxyV1Upgradeable,
    UUPSUpgradeable,
    Ownable2StepUpgradeable {
    using SafeERC20 for IERC20;

    address public appAddress;
    address public tacSAFactoryAddress;
    

    constructor() {
        _disableInitializers();
    }


    function initialize(address deployer, address _appAddress, address _tacSAFactoryAddress, address _crossChainLayer) public initializer {
        __TacProxyV1Upgradeable_init(_crossChainLayer);
        __Ownable_init(deployer);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        tacSAFactoryAddress = _tacSAFactoryAddress;
        appAddress = _appAddress;
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
    ) external _onlyCrossChainLayer {
        SupplyArguments memory args = abi.decode(arguments, (SupplyArguments));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);

        (address user, ) = ISAFactory(tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);
        SafeERC20.safeTransfer(IERC20 (args.asset), user, args.amount);
        ITacSmartAccount(user).approve(args.asset, appAddress, args.amount);
        
        ITacSmartAccount(user).execute(
            appAddress,
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
    ) external _onlyCrossChainLayer {
        WithdrawArguments memory args = abi.decode(arguments,(WithdrawArguments));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);

        (address user, ) = ISAFactory(tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);

        ITacSmartAccount(user).execute(
            appAddress,
            0,
            abi.encodeWithSelector(
                IPool.withdraw.selector,
                args.asset,
                args.amount,
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

        _bridgeTokens(tacHeader, tokensToBridge, "", 0);
    }

    /**
     * @dev External function to handle the borrow operation via cross-chain layer.
     * @param tacHeader The TAC header for cross-chain communication.
     * @param arguments The encoded borrow arguments.
     */
    function borrow(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer {
        BorrowArguments memory args = abi.decode(arguments, (BorrowArguments));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);

        (address user, ) = ISAFactory(tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);

        ITacSmartAccount(user).execute(
            appAddress,
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

        _bridgeTokens(tacHeader, tokensToBridge, "", 0);
    }

    /**
     * @dev External function to handle the repay operation via cross-chain layer.
     * @param tacHeader The TAC header for cross-chain communication.
     * @param arguments The encoded repay arguments.
     */
    function repay(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer {
        RepayArguments memory args = abi.decode(arguments, (RepayArguments));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);

        (address user, ) = ISAFactory(tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);

        SafeERC20.safeTransfer(IERC20 (args.asset), user, args.amount);
        ITacSmartAccount(user).approve(args.asset, appAddress, args.amount);
       

        ITacSmartAccount(user).execute(
            appAddress,
            0,
            abi.encodeWithSelector(
                IPool.repay.selector,
                args.asset,
                args.amount,
                args.interestRateMode,
                user
            )
        );
    }

    /**
     * @dev External function to handle the setUserUseReserveAsCollateral operation.
     * @param tacHeader The TAC header for cross-chain communication.
     * @param arguments The encoded setUserUseReserveAsCollateral arguments.
     */
    function setUserUseReserveAsCollateral(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer {
        (address asset, bool useAsCollateral) = abi.decode(
            arguments,
            (address, bool)
        );
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);

        (address user, ) = ISAFactory(tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);

        ITacSmartAccount(user).execute(
            appAddress,
            0,
            abi.encodeWithSelector(
                IPool(appAddress).setUserUseReserveAsCollateral.selector,
                asset,
                useAsCollateral
            )
        );
    }

    function claimSA(
    bytes calldata tacHeader,
    bytes calldata arguments
    ) public _onlyCrossChainLayer {
        (address asset) = abi.decode(arguments, (address));

        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);

        (address user, ) = ISAFactory(tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);

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

        _bridgeTokens(tacHeader, tokensToBridge, "", 0);
    }

    /// @notice Bridges tokens and NFTs to the cross-chain layer
    /// @param tacHeader TAC header data
    /// @param tokens Array of token amounts to bridge
    /// @param payload Additional payload data
    function _bridgeTokens(
        bytes calldata tacHeader,
        TokenAmount[] memory tokens,
        string memory payload,
        uint256 tacAmount
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

        _sendMessageV1(message, tacAmount);
    }
}