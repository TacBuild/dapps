// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {TacSmartAccount} from "../../TacSmartAccounts/TacSmartAccount.sol";
import {TacSAFactory} from "../../TacSmartAccounts/TacSAFactory.sol";
import {ITacSmartAccount} from "../../TacSmartAccounts/Interface/ITacSmartAccount.sol";

import { TransferHelper } from 'contracts/helpers/TransferHelper.sol';
import { TacProxyV1Upgradeable } from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import { OutMessageV1, TokenAmount, NFTAmount, TacHeaderV1 } from "@tonappchain/evm-ccl/contracts/core/Structs.sol";

import { ITwocryptoswapPool } from "contracts/proxies/CurveLite/ICurveLiteTwocryptoswapPool.sol";
import { ITAC } from "contracts/proxies/CurveLite/ITAC.sol";


/**
 * @title CurveLiteTwocryptoswapProxy
 * @dev Proxy contract CurveLite, working with twocryptoswap pools contracts directly
 */
contract CurveLiteTwocryptoswapProxy is TacProxyV1Upgradeable, Ownable2StepUpgradeable, UUPSUpgradeable {

    address internal wtacAddress;
    ITAC wtac;


    address internal _tacSAFactoryAddress;

    /**
     * @dev Initialize the contract.
     */
    function initialize(address adminAddress, address tacSAFactoryAddress, address crossChainLayer, address _wtacAddress) public initializer {
        __TacProxyV1Upgradeable_init(crossChainLayer);
        __Ownable_init(adminAddress);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        wtacAddress = _wtacAddress;
        wtac = ITAC(_wtacAddress);
        _tacSAFactoryAddress = tacSAFactoryAddress;
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
        (address user, ) = TacSAFactory(_tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);

        (address pool, uint256[2] memory amounts, uint256 minMintAmount) =
                abi.decode(arguments, (address, uint256[2], uint256));

        address tokenA = ITwocryptoswapPool(pool).coins(0);
        address tokenB = ITwocryptoswapPool(pool).coins(1);

        if (msg.value > 0) {
            if (tokenA == wtacAddress) {
                require(msg.value == amounts[0], "ETH amount does not match amount for tokenA");
                wtac.deposit{value: msg.value}();
            } else if (tokenB == wtacAddress) {
                require(msg.value == amounts[1], "ETH amount does not match amount for tokenB");
                wtac.deposit{value: msg.value}();
            } else {
                revert("No ETH expected for this pool");
            }
        }

        address tokenLiquidity = pool;

        TransferHelper.safeTransfer(tokenA, user, amounts[0]);
        ITacSmartAccount(user).execute(
            tokenA,
            0,
            abi.encodeWithSelector(
                IERC20(tokenA).approve.selector,
                pool,
                amounts[0]
            )
        );

        TransferHelper.safeTransfer(tokenB, user, amounts[1]);
        ITacSmartAccount(user).execute(
            tokenB,
            0,
            abi.encodeWithSelector(
                IERC20(tokenB).approve.selector,
                pool,
                amounts[1]
            )
        );

        ITacSmartAccount(user).execute(
            pool,
            0,
            abi.encodeWithSelector(
                ITwocryptoswapPool.add_liquidity.selector,
                [amounts[0], amounts[1]],
                minMintAmount
            )
        );

        uint256 liquidity = IERC20(tokenLiquidity).balanceOf(user);

        ITacSmartAccount(user).execute(
            tokenLiquidity,
            0,
            abi.encodeWithSelector(
                IERC20(tokenLiquidity).transfer.selector,
                address(this),
                liquidity
            )
        );

        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(tokenLiquidity, liquidity);

        _bridgeTokens(tacHeader, tokensToBridge, new NFTAmount[](0), "");
    }

    /**
     * @dev A proxy to removeLiquidity
     */
    function removeLiquidity(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public _onlyCrossChainLayer {
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, ) = TacSAFactory(_tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);

        (address pool, uint256 amount, uint256[2] memory min_amounts) =
                abi.decode(arguments, (address, uint256, uint256[2]));

        address tokenA = ITwocryptoswapPool(pool).coins(0);
        address tokenB = ITwocryptoswapPool(pool).coins(1);
        address tokenLiquidity = pool;

        TransferHelper.safeTransfer(tokenLiquidity, user, amount);
        ITacSmartAccount(user).execute(
            tokenLiquidity,
            0,
            abi.encodeWithSelector(
                IERC20(tokenLiquidity).approve.selector,
                pool,
                amount
            )
        );

        ITacSmartAccount(user).execute(
            pool,
            0,
            abi.encodeWithSelector(
                ITwocryptoswapPool.remove_liquidity.selector,
                amount,
                min_amounts
            )
        );

        uint256 tokenAAmount = IERC20(tokenA).balanceOf(user);
        uint256 tokenBAmount = IERC20(tokenB).balanceOf(user);

        ITacSmartAccount(user).execute(
            tokenA,
            0,
            abi.encodeWithSelector(
                IERC20(tokenA).transfer.selector,
                address(this),
                tokenAAmount
            )
        );

        ITacSmartAccount(user).execute(
            tokenB,
            0,
            abi.encodeWithSelector(
                IERC20(tokenB).transfer.selector,
                address(this),
                tokenBAmount
            )
        );

        TokenAmount[] memory tokensToBridge = new TokenAmount[](2);
        tokensToBridge[0] = TokenAmount(tokenA, tokenAAmount);
        tokensToBridge[1] = TokenAmount(tokenB, tokenBAmount);

        _bridgeTokens(tacHeader, tokensToBridge, new NFTAmount[](0), "");
    }

    /**
     * @dev A proxy to removeLiquidityOneCoin
     */
    function removeLiquidityOneCoin(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public _onlyCrossChainLayer {
        (address pool, uint256 token_amount, uint256 i, uint256 min_amount) =
                abi.decode(arguments, (address, uint256, uint256, uint256));
        // claim tokens addresses
        address token = ITwocryptoswapPool(pool).coins(i);
        address tokenLiquidity = pool;

        TransferHelper.safeApprove(tokenLiquidity, pool, token_amount);

        uint256 amount = ITwocryptoswapPool(pool).remove_liquidity_one_coin(
            token_amount,
            i,
            min_amount
        );

        // bridge tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(token, amount);

        address crossChainLayer = _getCrossChainLayerAddress();

        // approve tokens to CCL
        TransferHelper.safeApprove(token, crossChainLayer, amount);

        // CCL TAC->TON callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            tvmProtocolFee: 0,
            tvmExecutorFee: 0,
            tvmValidExecutors: new string[](0),
            toBridge: tokensToBridge,
            toBridgeNFT: new NFTAmount[](0)
        });
        _sendMessageV1(message, 0);
    }

    /**
     * @dev A proxy to exchange
     */
    function exchange(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public payable _onlyCrossChainLayer {
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, ) = TacSAFactory(_tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);

        (address pool, uint256 i, uint256 j, uint256 dx, uint256 min_dy) =
                abi.decode(arguments, (address, uint256, uint256, uint256, uint256));

        address tokenIn = ITwocryptoswapPool(pool).coins(i);
        address tokenOut = ITwocryptoswapPool(pool).coins(j);

        if (msg.value > 0) {
            if (tokenIn == wtacAddress) {
                require(msg.value == dx, "ETH amount does not match amount for tokenIN");
                wtac.deposit{value: msg.value}();
            } else {
                revert("No ETH expected for this pool");
            }
        }

        TransferHelper.safeTransfer(tokenIn, user, dx);
        ITacSmartAccount(user).execute(
            tokenIn,
            0,
            abi.encodeWithSelector(
                IERC20(tokenIn).approve.selector,
                pool,
                dx
            )
        );

        ITacSmartAccount(user).execute(
            pool,
            0,
            abi.encodeWithSelector(
                ITwocryptoswapPool.exchange.selector,
                i,
                j,
                dx,
                min_dy
            )
        );

        uint256 amountOut = IERC20(tokenOut).balanceOf(user);
        ITacSmartAccount(user).execute(
            tokenOut,
            0,
            abi.encodeWithSelector(
                IERC20(tokenOut).transfer.selector,
                address(this),
                amountOut
                )
        );

        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(tokenOut, amountOut);

        _bridgeTokens(tacHeader, tokensToBridge, new NFTAmount[](0), "");
    }

    /// @dev Bridges all the smart account tokens and NFTs to the cross-chain layer
    function claimSA(
    bytes calldata tacHeader,
    bytes calldata arguments
) public _onlyCrossChainLayer {
    (address asset) = abi.decode(arguments, (address));

    TacHeaderV1 memory header = _decodeTacHeader(tacHeader);

    (address user, ) = TacSAFactory(_tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);

    uint256 balance = IERC20(asset).balanceOf(user);

    ITacSmartAccount(user).execute(
        asset,
        0,
        abi.encodeWithSelector(
            IERC20(asset).transfer.selector,
            address(this),
            balance
        )
    );

    TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(
            asset,
            balance
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
