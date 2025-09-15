// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ITacSmartAccount} from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/ITacSmartAccount.sol";
import {ISAFactory} from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/ISAFactory.sol";

import { TransferHelper } from 'contracts/helpers/TransferHelper.sol';
import { TacProxyV1Upgradeable } from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import { OutMessageV1, TokenAmount, NFTAmount, TacHeaderV1 } from "@tonappchain/evm-ccl/contracts/core/Structs.sol";
import { IWTAC } from "@tonappchain/evm-ccl/contracts/interfaces/IWTAC.sol";

import { ITwocryptoswapPool } from "contracts/proxies/CurveLite/ICurveLiteTwocryptoswapPool.sol";



/**
 * @title CurveLiteTwocryptoswapProxy
 * @dev Proxy contract CurveLite, working with twocryptoswap pools contracts directly
 */
contract CurveLiteTwocryptoswapProxy is TacProxyV1Upgradeable, Ownable2StepUpgradeable, UUPSUpgradeable {

    address internal _tacSAFactoryAddress;
    address internal wtacAddress;

    /**
     * @dev Initialize the contract.
     */
    function initialize(address adminAddress, address tacSAFactoryAddress, address crossChainLayer) public initializer {
        __TacProxyV1Upgradeable_init(crossChainLayer);
        __Ownable_init(adminAddress);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        _tacSAFactoryAddress = tacSAFactoryAddress;
    }

    function setWTACAddress(address _wtacAddress) external onlyOwner {
        require(wtacAddress == address(0), "WTAC already inited");
        wtacAddress = _wtacAddress;
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
        (address user, ) = ISAFactory(_tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);

        (address pool, uint256[2] memory amounts, uint256 minMintAmount) =
                abi.decode(arguments, (address, uint256[2], uint256));

        address tokenA = ITwocryptoswapPool(pool).coins(0);
        address tokenB = ITwocryptoswapPool(pool).coins(1);

        if (msg.value > 0) {
            if (tokenA == wtacAddress) {
                require(msg.value == amounts[0], "TAC amount does not match amount for tokenA");
                IWTAC(wtacAddress).deposit{value: msg.value}();
            } else if (tokenB == wtacAddress) {
                require(msg.value == amounts[1], "TAC amount does not match amount for tokenB");
                IWTAC(wtacAddress).deposit{value: msg.value}();
            } else {
                revert("No TAC expected for this pool");
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

        _bridgeTokens(tacHeader, tokensToBridge, new NFTAmount[](0), "", 0);
    }

    /**
     * @dev A proxy to removeLiquidity
     */
    function removeLiquidity(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public _onlyCrossChainLayer {
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, ) = ISAFactory(_tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);

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


        if (tokenA == wtacAddress) {
            IWTAC(wtacAddress).withdraw(tokenAAmount);
            TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
            tokensToBridge[0] = TokenAmount(tokenB, tokenBAmount);
            _bridgeTokens(tacHeader, tokensToBridge, new NFTAmount[](0), "", tokenAAmount);
        } else if (tokenB == wtacAddress) {
            IWTAC(wtacAddress).withdraw(tokenBAmount);
            TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
            tokensToBridge[0] = TokenAmount(tokenA, tokenAAmount);
            _bridgeTokens(tacHeader, tokensToBridge, new NFTAmount[](0), "", tokenBAmount);
        } else {
            TokenAmount[] memory tokensToBridge = new TokenAmount[](2);
            tokensToBridge[0] = TokenAmount(tokenA, tokenAAmount);
            tokensToBridge[1] = TokenAmount(tokenB, tokenBAmount);
            _bridgeTokens(tacHeader, tokensToBridge, new NFTAmount[](0), "", 0);
        } 
    }

    /**
     * @dev A proxy to removeLiquidityOneCoin
     */
    function removeLiquidityOneCoin(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public _onlyCrossChainLayer {
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, ) = ISAFactory(_tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);

        (address pool, uint256 tokenAmount, uint256 i, uint256 minAmount) =
                abi.decode(arguments, (address, uint256, uint256, uint256));
        // claim tokens addresses
        address token = ITwocryptoswapPool(pool).coins(i);
        address tokenLiquidity = pool;

        TransferHelper.safeTransfer(tokenLiquidity, user, tokenAmount);
        ITacSmartAccount(user).execute(
            tokenLiquidity,
            0,
            abi.encodeWithSelector(
                IERC20(tokenLiquidity).approve.selector,
                pool,
                tokenAmount
            )
        );

        ITacSmartAccount(user).execute(
            pool,
            0,
            abi.encodeWithSelector(
                ITwocryptoswapPool.remove_liquidity_one_coin.selector,
                tokenAmount,
                i,
                minAmount
            )
        );

        uint256 returnTokenAmount = IERC20(token).balanceOf(user);

        ITacSmartAccount(user).execute(
            token,
            0,
            abi.encodeWithSelector(
                IERC20(token).transfer.selector,
                address(this),
                returnTokenAmount
            )
        );

        // bridge tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(token, returnTokenAmount);

        if (token == wtacAddress) {
            IWTAC(wtacAddress).withdraw(returnTokenAmount);
            _bridgeTokens(tacHeader, new TokenAmount[](0), new NFTAmount[](0), "", returnTokenAmount);
        } else {
            TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
            tokensToBridge[0] = TokenAmount(token, returnTokenAmount);
            _bridgeTokens(tacHeader, tokensToBridge, new NFTAmount[](0), "", 0);
        }

    }

    /**
     * @dev A proxy to exchange
     */
    function exchange(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public payable _onlyCrossChainLayer {
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, ) = ISAFactory(_tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);

        (address pool, uint256 i, uint256 j, uint256 dx, uint256 min_dy) =
                abi.decode(arguments, (address, uint256, uint256, uint256, uint256));

        address tokenIn = ITwocryptoswapPool(pool).coins(i);
        address tokenOut = ITwocryptoswapPool(pool).coins(j);

        if (msg.value > 0) {
            if (tokenIn == wtacAddress) {
                require(msg.value == dx, "TAC amount does not match amount for tokenIN");
                IWTAC(wtacAddress).deposit{value: msg.value}();
            } else {
                revert("No TAC expected for this pool");
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

        if (tokenOut == wtacAddress) {
            IWTAC(wtacAddress).withdraw(amountOut);
            _bridgeTokens(tacHeader, new TokenAmount[](0), new NFTAmount[](0), "", amountOut);
        } else {
            TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
            tokensToBridge[0] = TokenAmount(tokenOut, amountOut);
            _bridgeTokens(tacHeader, tokensToBridge, new NFTAmount[](0), "", 0);
        }
    }

    /// @dev Bridges all the smart account tokens and NFTs to the cross-chain layer
    function claimSA(
    bytes calldata tacHeader,
    bytes calldata arguments
) public _onlyCrossChainLayer {
    (address asset) = abi.decode(arguments, (address));

    TacHeaderV1 memory header = _decodeTacHeader(tacHeader);

    (address user, ) = ISAFactory(_tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);

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

    _bridgeTokens(tacHeader, tokensToBridge, new NFTAmount[](0), "", 0);
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
        string memory payload,
        uint256 tacAmount
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
        _sendMessageV1(message, tacAmount);
    }

    receive() external payable {}

}
