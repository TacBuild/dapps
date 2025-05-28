// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import { TransferHelper } from 'contracts/helpers/TransferHelper.sol';
import { TacProxyV1Upgradeable } from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import { OutMessageV2, TokenAmount, TacHeaderV1, NFTTokenAmount } from "@tonappchain/evm-ccl/contracts/L2/Structs.sol";
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

        NFTTokenAmount[] memory nftsToBridge = new NFTTokenAmount[](1);
        nftsToBridge[0] = NFTTokenAmount(address(_appAddress), tokenId, 0);

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


        NFTTokenAmount[] memory nftsToBridge = new NFTTokenAmount[](1);
        nftsToBridge[0] = NFTTokenAmount(address(_appAddress), liquidity, 0);
        TokenAmount[] memory tokensToBridge = new TokenAmount[](0);


        _bridgeTokens(tacHeader, tokensToBridge, nftsToBridge, "");
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

        (, , address _token0, address _token1, , , , , , , , ) = INonfungiblePositionManager(_appAddress).positions(params.tokenId);


        (uint256 amount0, uint256 amount1) = INonfungiblePositionManager(_appAddress).decreaseLiquidity(params);

        NFTTokenAmount[] memory nftsToBridge = new NFTTokenAmount[](0);
        TokenAmount[] memory tokensToBridge = new TokenAmount[](2);
        tokensToBridge[0] = TokenAmount(_token0, amount0);
        tokensToBridge[0] = TokenAmount(_token1, amount1);

        _bridgeTokens(tacHeader, tokensToBridge, nftsToBridge, "");
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

        // TODO: NFT WORK SEND NFT
    }

    function _bridgeTokens(
        bytes calldata tacHeader,
        TokenAmount[] memory tokens,
        NFTTokenAmount[] memory nfts,
        string memory payload
    ) private {
        for (uint256 i = 0; i < tokens.length; i++) {
            TransferHelper.safeApprove(
                tokens[i].l2Address,
                _getCrossChainLayerAddress(),
                tokens[i].amount
            );
        }

        for (uint256 i = 0; i < nfts.length; i++) {
            IERC721(nfts[i].l2Address).approve(_getCrossChainLayerAddress(), nfts[i].tokenId);
        }
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV2 memory message = OutMessageV2({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: payload,
            toBridge: tokens,
            toBridgeNFT: nfts
        });

        _sendMessageV2(message, address(this).balance);
    }
}



