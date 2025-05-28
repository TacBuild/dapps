// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import { TransferHelper } from '@uniswap/lib/contracts/libraries/TransferHelper.sol';
import { TacProxyV1Upgradeable } from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import { OutMessageV1, TokenAmount, TacHeaderV1, NFTAmount } from "@tonappchain/evm-ccl/contracts/core/Structs.sol";
import "contracts/proxies/Algebra/IAlgebraNonfungiblePositionManager.sol";



/**
 * @title AlgebraNonfungiblePositionManagerProxy
 * @dev Proxy contract Algebra, working with NonfungiblePositionManager
 */
contract AlgebraNonfungiblePositionManagerProxy is TacProxyV1Upgradeable, OwnableUpgradeable, UUPSUpgradeable {
    address internal _appAddress;

    /**
     * @dev Initialize the contract.
     */
    function initialize(address adminAddress, address appAddress, address crossChainLayer) public initializer {
        __TacProxyV1Upgradeable_init(crossChainLayer);
        __Ownable_init(adminAddress);
        __UUPSUpgradeable_init();
        _appAddress = appAddress;
    }

    /**
     * @dev Upgrades the contract.
     */
    function _authorizeUpgrade(address) internal override onlyOwner {}


    /**
     * @dev A proxy to mint
     * @param tacHeader TacHeaderV1 struct containing the header information
     * @param arguments arguments data
     */
    function mint(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public _onlyCrossChainLayer {
        (MintParams memory params) = abi.decode(arguments, (MintParams));

        TransferHelper.safeApprove(params.token0, _appAddress, params.amount0Desired);
        TransferHelper.safeApprove(params.token1, _appAddress, params.amount1Desired);

        (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1) = INonfungiblePositionManager(_appAddress).mint(params);

        (, , address _token0, address _token1, , , , , , , , ) = INonfungiblePositionManager(_appAddress).positions(tokenId);


        uint256 tokenXBalance = IERC20(_token0).balanceOf(address(this));
        uint256 tokenYBalance = IERC20(_token1).balanceOf(address(this));
        TokenAmount[] memory tokensToBridge;
        if (tokenXBalance > 0 && tokenYBalance > 0) {
            tokensToBridge = new TokenAmount[](2);
            tokensToBridge[0] = TokenAmount(_token0, tokenXBalance);
            tokensToBridge[1] = TokenAmount(_token1, tokenYBalance);
        } else if (tokenXBalance > 0 || tokenYBalance > 0) {
            tokensToBridge = new TokenAmount[](1);
            if (tokenXBalance > 0) {
                tokensToBridge[0] = TokenAmount(_token0, tokenXBalance);
            } else {
                tokensToBridge[0] = TokenAmount(_token1, tokenYBalance);
            }
        }

        NFTAmount[] memory nftsToBridge = new NFTAmount[](1);
        nftsToBridge[0] = NFTAmount(address(_appAddress), tokenId, 0);

        _bridgeTokens(tacHeader, tokensToBridge, nftsToBridge, "");
    }

    /**
     * @dev A proxy to increaseLiquidity
     * @param tacHeader TacHeaderV1 struct containing the header information
     * @param arguments arguments data
     */
    function increaseLiquidity(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public _onlyCrossChainLayer {
        (IncreaseLiquidityParams memory params) = abi.decode(arguments, (IncreaseLiquidityParams));

        (, , address _token0, address _token1, , , , , , , , ) = INonfungiblePositionManager(_appAddress).positions(params.tokenId);

        TransferHelper.safeApprove(_token0, _appAddress, params.amount0Desired);
        TransferHelper.safeApprove(_token1, _appAddress, params.amount1Desired);

        (uint128 liquidity, uint256 amount0, uint256 amount1) = INonfungiblePositionManager(_appAddress).increaseLiquidity(params);


        NFTAmount[] memory nftsToBridge = new NFTAmount[](1);
        nftsToBridge[0] = NFTAmount(address(_appAddress), params.tokenId, 0);

        _bridgeTokens(tacHeader, new TokenAmount[](0), nftsToBridge, "");
    }

    /**
     * @dev A proxy to decreaseLiquidity
     * @param tacHeader TacHeaderV1 struct containing the header information
     * @param arguments arguments data
     */
    function decreaseLiquidity(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public _onlyCrossChainLayer {
        (DecreaseLiquidityParams memory params) = abi.decode(arguments, (DecreaseLiquidityParams));

        (, , address token0, address token1, , , , , , , , ) = INonfungiblePositionManager(_appAddress).positions(params.tokenId);


        (uint256 amount0, uint256 amount1) = INonfungiblePositionManager(_appAddress).decreaseLiquidity(params);


        TokenAmount[] memory tokensToBridge = new TokenAmount[](2);
        tokensToBridge[0] = TokenAmount(token0, amount0);
        tokensToBridge[1] = TokenAmount(token1, amount1);

        _bridgeTokens(tacHeader, tokensToBridge, new NFTAmount[](0), "");
    }

    /**
     * @dev A proxy to burn
     * @param tacHeader TacHeaderV1 struct containing the header information
     * @param arguments arguments data
     */
    function burn(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public _onlyCrossChainLayer {
        (uint256 tokenId) = abi.decode(arguments, (uint256));

        INonfungiblePositionManager(_appAddress).burn(tokenId);
    }

    /**
     * @dev A proxy to collect
     * @param tacHeader TacHeaderV1 struct containing the header information
     * @param arguments arguments data
     */
    function collect(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public _onlyCrossChainLayer {
        (CollectParams memory params) = abi.decode(arguments, (CollectParams));

        (uint256 amount0, uint256 amount1) = INonfungiblePositionManager(_appAddress).collect(params);


        (, , address token0, address token1, , , , , , , , ) = INonfungiblePositionManager(_appAddress).positions(params.tokenId);

        TokenAmount[] memory tokensToBridge = new TokenAmount[](2);
        tokensToBridge[0] = TokenAmount(token0, amount0);
        tokensToBridge[1] = TokenAmount(token1, amount1);

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



