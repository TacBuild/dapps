// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { TacProxyV1Upgradeable } from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import { OutMessageV1, TokenAmount, NFTAmount, TacHeaderV1 } from "@tonappchain/evm-ccl/contracts/core/Structs.sol";
import { IStableswapPool } from "contracts/proxies/CurveLite/ICurveLiteStableswapPool.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ITacSmartAccount } from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/ITacSmartAccount.sol";
import { ISAFactory } from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/ISAFactory.sol";
import "hardhat/console.sol";

/**
 * @title CurveLiteStableswapProxy
 * @dev Proxy contract CurveLite, working with Stableswap pools contracts directly
 */
contract CurveLiteStableswapProxy is TacProxyV1Upgradeable, Ownable2StepUpgradeable, UUPSUpgradeable {
    ISAFactory internal _smartAccountFactory;

    address internal constant _ETH_ADDRESS_ = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    error ValueAndAmountInMismatch();
    error ETHTransferFailed();

    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the contract.
     */
    function initialize(address adminAddress, address crossChainLayer, address smartAccountFactory) public initializer {
        __TacProxyV1Upgradeable_init(crossChainLayer);
        __Ownable_init(adminAddress);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        _smartAccountFactory = ISAFactory(smartAccountFactory);
    }

    /**
     * @dev Upgrades the contract.
     */
    function _authorizeUpgrade(address) internal override onlyOwner {}

    /**
     * @dev A proxy to addLiquidity
     */
    function addLiquidity(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public payable _onlyCrossChainLayer {
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = _smartAccountFactory.getOrCreateSmartAccount(header.tvmCaller);

        (address pool, uint256[2] memory amounts, uint256 minMintAmount) =
                abi.decode(arguments, (address, uint256[2], uint256));
        
        address tokenA = IStableswapPool(pool).coins(0);
        address tokenB = IStableswapPool(pool).coins(1);
        console.log("tokenA", tokenA);
        console.log("tokenB", tokenB);
        console.log("user", user);
        SafeERC20.safeTransfer(IERC20(tokenA), user, amounts[0]);
        SafeERC20.safeTransfer(IERC20(tokenB), user, amounts[1]);
        ITacSmartAccount(payable(user)).approve(tokenA, pool, amounts[0]);
        ITacSmartAccount(payable(user)).approve(tokenB, pool, amounts[1]);
        console.log("1");

        bytes memory data = abi.encodeWithSelector(IStableswapPool.add_liquidity.selector, [amounts[0],amounts[1]], minMintAmount);
        console.log("2");
        bytes memory outData = ITacSmartAccount(payable(user)).execute(pool, 0, data);
        console.log("3");
        (uint liquidity) = abi.decode(outData, (uint));
        console.log("4");

        ITacSmartAccount(payable(user)).execute(pool, 0, abi.encodeWithSelector(IERC20.transfer.selector, address(this), liquidity));

        // bridge LP tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(pool, liquidity);

        _bridgeTokens(tacHeader, tokensToBridge, "", 0);
    }

    /**
     * @dev A proxy to removeLiquidity
     */
    function removeLiquidity(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public _onlyCrossChainLayer {
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = _smartAccountFactory.getOrCreateSmartAccount(header.tvmCaller);

        (address pool, uint256 amount, uint256[2] memory min_amounts) =
                abi.decode(arguments, (address, uint256, uint256[2]));
        // claim tokens addresses
        address tokenA = IStableswapPool(pool).coins(0);
        address tokenB = IStableswapPool(pool).coins(1);

        SafeERC20.safeTransfer(IERC20(pool), user, amount);
        // ITacSmartAccount(payable(user)).approve(pool, pool, amount);

        bytes memory data = abi.encodeWithSelector(IStableswapPool.remove_liquidity.selector, amount, min_amounts, address(this));
        bytes memory outData = ITacSmartAccount(payable(user)).execute(pool, 0, data);
        (uint256[2] memory amounts) = abi.decode(outData, (uint256[2]));

        ITacSmartAccount(payable(user)).execute(tokenA, 0, abi.encodeWithSelector(IERC20.transfer.selector, address(this), amounts[0]));
        ITacSmartAccount(payable(user)).execute(tokenB, 0, abi.encodeWithSelector(IERC20.transfer.selector, address(this), amounts[1]));

        // bridge tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](2);
        tokensToBridge[0] = TokenAmount(tokenA, amounts[0]);
        tokensToBridge[1] = TokenAmount(tokenB, amounts[1]);

        _bridgeTokens(tacHeader, tokensToBridge, "", 0);
    }

    /**
     * @dev A proxy to exchange
     */
    function exchange(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public _onlyCrossChainLayer {
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = _smartAccountFactory.getOrCreateSmartAccount(header.tvmCaller);

        (address pool, uint256 i, uint256 j, uint256 dx, uint256 min_dy) =
                abi.decode(arguments, (address, uint256, uint256, uint256, uint256));
        // claim tokens addresses
        address tokenIn = IStableswapPool(pool).coins(i);
        address tokenOut = IStableswapPool(pool).coins(j);

        SafeERC20.safeTransfer(IERC20(tokenIn), user, dx);
        ITacSmartAccount(payable(user)).approve(tokenIn, pool, dx);

        bytes memory outData = ITacSmartAccount(payable(user)).execute(pool, 0, abi.encodeWithSelector(IStableswapPool.exchange.selector, i, j, dx, min_dy, address(this)));

        // bridge tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(tokenOut, abi.decode(outData, (uint256)));

        _bridgeTokens(tacHeader, tokensToBridge, "", 0);
    }


    /// @notice Bridges tokens to the cross-chain layer
    /// @param tacHeader TAC header data
    /// @param tokens Array of token amounts to bridge
    /// @param payload Additional payload data
    function _bridgeTokens(
        bytes calldata tacHeader,
        TokenAmount[] memory tokens,
        string memory payload,
        uint256 nativeTacAmount
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

        _sendMessageV1(message, nativeTacAmount);
    }
}
