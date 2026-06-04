// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ILiquidityManager {
    struct MintParam {
        address miner;
        address tokenX;
        address tokenY;
        uint24 fee;
        int24 pl;
        int24 pr;
        uint128 xLim;
        uint128 yLim;
        uint128 amountXMin;
        uint128 amountYMin;
        uint256 deadline;
    }

    struct AddLiquidityParam {
        uint256 lid;
        uint128 xLim;
        uint128 yLim;
        uint128 amountXMin;
        uint128 amountYMin;
        uint256 deadline;
    }

    struct Liquidity {
        int24 leftPt;
        int24 rightPt;
        uint128 liquidity;
        uint256 lastFeeScaleX_128;
        uint256 lastFeeScaleY_128;
        uint256 remainTokenX;
        uint256 remainTokenY;
        uint128 poolId;
    }

    function mint(
        MintParam calldata mintParam
    ) external payable returns (
        uint256 lid,
        uint128 liquidity,
        uint256 amountX,
        uint256 amountY
    );

    function addLiquidity(
        AddLiquidityParam calldata addLiquidityParam
    ) external payable returns (
        uint128 liquidityDelta,
        uint256 amountX,
        uint256 amountY
    );

    function decLiquidity(
        uint256 lid,
        uint128 liquidDelta,
        uint256 amountXMin,
        uint256 amountYMin,
        uint256 deadline
    ) external returns (uint256 amountX, uint256 amountY);

    function collect(
        address recipient,
        uint256 lid,
        uint128 amountXLim,
        uint128 amountYLim
    ) external payable returns (uint256 amountX, uint256 amountY);

    function liquidities(uint256 tokenId) external view returns (
        Liquidity memory liquidity
    );

    function burn(uint256 lid) external returns (bool success);

    function createPool(
        address tokenX,
        address tokenY,
        uint24 fee,
        int24 initialPoint
    ) external returns (address pool);

    function poolMetas(uint128 poolId) external view returns (
        address tokenX,
        address tokenY,
        uint24 fee
    );
    function factory() external view returns (address);
} 