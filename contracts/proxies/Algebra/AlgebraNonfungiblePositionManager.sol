// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import { TransferHelper } from 'contracts/helpers/TransferHelper.sol';
import { TacProxyV1Upgradeable } from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import { OutMessageV1, TokenAmount, TacHeaderV1 } from "@tonappchain/evm-ccl/contracts/L2/Structs.sol";
import "contracts/proxies/Algebra/IAlgebraNonfungiblePositionManager.sol";

/**
 * @title AlgebraNonfungiblePositionManagerProxy
 * @dev Proxy contract Algebra, working with NonfungiblePositionManager
 */
contract AlgebraNonfungiblePositionManagerProxy is TacProxyV1Upgradeable, OwnableUpgradeable, UUPSUpgradeable {
    address public constant _ETH_ADDRESS_ = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
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

        // TODO: NFT WORK SEND NFT
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

        // TODO: NFT WORK SEND NFT
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

        (uint256 amount0, uint256 amount1) = INonfungiblePositionManager(_appAddress).decreaseLiquidity(params);

        // TODO: NFT WORK SEND NFT
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

}
