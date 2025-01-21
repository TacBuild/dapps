// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { TransferHelper } from 'contracts/helpers/TransferHelper.sol';
import { AppProxy } from "contracts/L2/AppProxy.sol";
import { OutMessage, TokenAmount, TacHeaderV1 } from "tac-l2-ccl/contracts/L2/Structs.sol";

/**
 * @title ITricryptoswapPool Interface
 * @notice This interface defines the core functionalities for a three-token liquidity pool in a CurveLite.
 * @dev Provides methods to add and remove liquidity, exchange tokens, and retrieve pool token addresses.
 */
interface ITricryptoswapPool {
    /**
     * @notice Adds liquidity to the pool
     * @param amounts An array of three uint256 values representing the amounts of tokens to add
     * @param min_mint_amount Minimum amount of LP tokens to mint
     * @return uint256 Amount of LP tokens received by the receiver
     */
    function add_liquidity(
        uint256[3] calldata amounts,
        uint256 min_mint_amount
    ) external returns (uint256);
    /**
     * @notice Removes liquidity to the pool
     * @param amount Amount of LP tokens to burn 
     * @param min_amounts Minimum amounts of tokens to withdraw
     * @return uint256[3] Amount of pool tokens received by the receiver
     */
    function remove_liquidity(
        uint256 amount,
        uint256[3] calldata min_amounts
    ) external returns (uint256[3] calldata);
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
    ) external returns (address);
}


/**
 * @title CurveLiteTricryptoswapProxy
 * @dev Proxy contract CurveLite, working with tricryptoswap pools contracts directly
 */
contract CurveLiteTricryptoswapProxy is AppProxy {
    /**
     * @dev Constructor function to initialize the contract with initial state. 
     * @param settingsAddress Settings address.
     * The decentralized application (dApp) operates as a dynamic pool
     * The initial parameter, appAddress, of the AppProxy is not required. Consequently, we assign an empty address to it.
     */
    constructor(address settingsAddress) AppProxy(address(0), settingsAddress) {
    }

    /**
     * @dev A proxy to addLiquidity
     * @param tacHeader TacHeaderV1 struct containing the header information
     * @param arguments arguments data
     */
    function addLiquidity(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public {
        (address pool, uint256[3] memory amounts, uint256 minMintAmount) =
                abi.decode(arguments, (address, uint256[3], uint256));
        // claim tokens addresses
        address tokenA = ITricryptoswapPool(pool).coins(0);
        address tokenB = ITricryptoswapPool(pool).coins(1);
        address tokenC = ITricryptoswapPool(pool).coins(2);
        // grant token approvals
        TransferHelper.safeApprove(tokenA, pool, amounts[0]);
        TransferHelper.safeApprove(tokenB, pool, amounts[1]);
        TransferHelper.safeApprove(tokenC, pool, amounts[2]);

        uint liquidity = ITricryptoswapPool(pool).add_liquidity(
            [amounts[0], amounts[1], amounts[2]],
            minMintAmount
        );

        // bridge LP tokens to TON
        address tokenLiquidity = pool;
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(tokenLiquidity, liquidity);

        // approve LP tokens to CCL
        TransferHelper.safeApprove(tokenLiquidity, getCrossChainLayerAddress(), liquidity);

        // CCL TAC->TON callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessage memory message = OutMessage({
            queryId: header.queryId,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });
        sendMessage(message, 0);
    }

    /**
     * @dev A proxy to removeLiquidity
     */
    function removeLiquidity(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public {
        (address pool, uint256 amount, uint256[3] memory min_amounts) =
                abi.decode(arguments, (address, uint256, uint256[3]));
        // claim tokens addresses
        address tokenA = ITricryptoswapPool(pool).coins(0);
        address tokenB = ITricryptoswapPool(pool).coins(1);
        address tokenC = ITricryptoswapPool(pool).coins(2);
        address tokenLiquidity = pool;

        TransferHelper.safeApprove(tokenLiquidity, pool, amount);

        uint256[3] memory amounts = ITricryptoswapPool(pool).remove_liquidity(
            amount,
            min_amounts
        );

        // bridge tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](3);
        tokensToBridge[0] = TokenAmount(tokenA, amounts[0]);
        tokensToBridge[1] = TokenAmount(tokenB, amounts[1]);
        tokensToBridge[2] = TokenAmount(tokenC, amounts[2]);

        address crossChainLayerAddress = getCrossChainLayerAddress();

        TransferHelper.safeApprove(tokenA, crossChainLayerAddress, amounts[0]);
        TransferHelper.safeApprove(tokenB, crossChainLayerAddress, amounts[1]);
        TransferHelper.safeApprove(tokenC, crossChainLayerAddress, amounts[2]);

        // CCL TAC->TON callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessage memory message = OutMessage({
            queryId: header.queryId,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });
        sendMessage(message, 0);
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
        address tokenIn = ITricryptoswapPool(pool).coins(i);
        address tokenOut = ITricryptoswapPool(pool).coins(j);

        // grant token approvals
        TransferHelper.safeApprove(tokenIn, pool, dx);

        uint256 amountOut = ITricryptoswapPool(pool).exchange(
            i,
            j,
            dx,
            min_dy
        );

        // bridge tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(tokenOut, amountOut);

        TransferHelper.safeApprove(tokenOut, getCrossChainLayerAddress(), amountOut);

        // CCL TAC->TON callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessage memory message = OutMessage({
            queryId: header.queryId,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });
        sendMessage(message, 0);
    }
}
