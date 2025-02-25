// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import { TransferHelper } from 'contracts/helpers/TransferHelper.sol';
import { TacProxyV1Upgradeable } from "tac-l2-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import { OutMessageV1, TokenAmount, TacHeaderV1 } from "tac-l2-ccl/contracts/L2/Structs.sol";
/**
 * @title IStableswapPool Interface
 * @notice This interface defines the core functionalities for a stable liquidity pool in a CurveLite.
 * @dev Provides methods to add and remove liquidity, exchange tokens, and retrieve pool token addresses.
 */
interface IStableswapPool {
    /**
     * @notice Adds liquidity to the pool
     * @param amounts An array of two uint256 values representing the amounts of tokens to add
     * @param min_mint_amount Minimum amount of LP tokens to mint
     * @return uint256 Amount of LP tokens received by the receiver
     */
    function add_liquidity(
        uint256[2] calldata amounts,
        uint256 min_mint_amount
    ) external returns (uint256);

    /**
     * @notice Removes liquidity to the pool
     * @param burn_amount Amount of LP tokens to burn 
     * @param min_amounts Minimum amounts of tokens to withdraw
     * @return uint256[2] Amount of pool tokens received by the receiver
     */
    function remove_liquidity(
        uint256 burn_amount,
        uint256[2] calldata min_amounts
    ) external returns (uint256[2] memory);

    /**
     * @notice Exchange tokens 
     * @param i Index value for the input coin
     * @param j Index value for the output coin
     * @param dx Amount of input coin being swapped in
     * @param min_dy Minimum amount of output coin to receive
     * @return uint256 Amount of tokens at index j received by the receiver
     */
    function exchange(
        uint256 i,
        uint256 j,
        uint256 dx,
        uint256 min_dy
    ) external returns (uint256);

    /**
     * @notice Get token address in pool by index
     * @param arg0 Token index
     * @return address Token address
     */
    function coins(
        uint256 arg0
    ) external view returns (address);
}


/**
 * @title CurveLiteStableswapProxy
 * @dev Proxy contract CurveLite, working with Stableswap pools contracts directly
 */
contract CurveLiteStableswapProxy is TacProxyV1Upgradeable, OwnableUpgradeable, UUPSUpgradeable {
    /**
     * @dev Initialize the contract.
     */
    function initialize(address adminAddress, address crossChainLayer) public initializer {
        __Ownable_init(adminAddress);
        __UUPSUpgradeable_init();
        __TacProxyV1Upgradeable_init(crossChainLayer);
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
    ) public {
        (address pool, uint256[2] memory amounts, uint256 minMintAmount) =
                abi.decode(arguments, (address, uint256[2], uint256));
        // claim tokens addresses
        address tokenA = IStableswapPool(pool).coins(0);
        address tokenB = IStableswapPool(pool).coins(1);

        // grant token approvals
        TransferHelper.safeApprove(tokenA, pool, amounts[0]);
        TransferHelper.safeApprove(tokenB, pool, amounts[1]);

        uint liquidity = IStableswapPool(pool).add_liquidity(
            [amounts[0],amounts[1]],
            minMintAmount
        );

        // bridge LP tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(pool, liquidity);

        TransferHelper.safeApprove(pool, _getCrossChainLayerAddress(), liquidity);

        // CCL TAC->TON callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });
        _sendMessageV1(message, 0);
    }

    /**
     * @dev A proxy to removeLiquidity
     */
    function removeLiquidity(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public {
        (address pool, uint256 amount, uint256[2] memory min_amounts) =
                abi.decode(arguments, (address, uint256, uint256[2]));
        // claim tokens addresses
        address tokenA = IStableswapPool(pool).coins(0);
        address tokenB = IStableswapPool(pool).coins(1);
        address tokenLiquidity = pool;

        TransferHelper.safeApprove(tokenLiquidity, pool, amount);

        uint256[2] memory amounts = IStableswapPool(pool).remove_liquidity(
            amount,
            min_amounts
        );

        // bridge tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](2);
        tokensToBridge[0] = TokenAmount(tokenA, amounts[0]);
        tokensToBridge[1] = TokenAmount(tokenB, amounts[1]);

        address crossChainLayer = _getCrossChainLayerAddress();

        // approve tokens to CCL
        TransferHelper.safeApprove(tokenA, crossChainLayer, amounts[0]);
        TransferHelper.safeApprove(tokenB, crossChainLayer, amounts[1]);

        // CCL TAC->TON callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });
        _sendMessageV1(message, 0);
    }

    /**
     * @dev A proxy to exchange
     */
    function exchange(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public {
        (address pool, uint256 i, uint256 j, uint256 dx, uint256 min_dy) =
                abi.decode(arguments, (address, uint256, uint256, uint256, uint256));
        // claim tokens addresses
        address tokenIn = IStableswapPool(pool).coins(i);
        address tokenOut = IStableswapPool(pool).coins(j);

        // grant token approvals
        TransferHelper.safeApprove(tokenIn, pool, dx);

        uint256 amountOut = IStableswapPool(pool).exchange(
            i,
            j,
            dx,
            min_dy
        );

        // bridge tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(tokenOut, amountOut);

        TransferHelper.safeApprove(tokenOut, _getCrossChainLayerAddress(), amountOut);

        // CCL TAC->TON callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });
        _sendMessageV1(message, 0);
    }
}
