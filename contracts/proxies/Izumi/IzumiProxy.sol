// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { TransferHelper } from '@uniswap/lib/contracts/libraries/TransferHelper.sol';
import { OutMessageV1, TokenAmount, TacHeaderV1 } from "tac-l2-ccl/contracts/L2/Structs.sol";
import { ICrossChainLayer } from "tac-l2-ccl/contracts/interfaces/ICrossChainLayer.sol";
import { TacProxyV1 } from "tac-l2-ccl/contracts/proxies/TacProxyV1.sol";
import { IPool } from "../Interface/Izumi/IPool.sol";
import { ISwap } from "../Interface/Izumi/ISwap.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ILimitOrderManager } from "../Interface/Izumi/ILimitOrderManager.sol";
import { ILiquidityManager } from "../Interface/Izumi/ILiquidityManager.sol";


/**
 * @title IzumiProxy
 * @dev Proxy contract for Izumi, similar to UniswapV2Router02
 */
import "hardhat/console.sol";

contract IzumiProxy is TacProxyV1 {
    address public poolAddress;
    address public swapAddress;
    address public limitOrderAddress;
    address public liquidityManagerAddress;

    event NewPool(address indexed pool);
    event BurnFailed();
    /**
     * @dev Constructor function to initialize the contract with initial state.
     * @param crossChainLayer Cross chain layer contract address.
     */
    constructor(
        address crossChainLayer,
        address _poolAddress,
        address _swapAddress,
        address _limitOrderAddress,
        address _liquidityManagerAddress
    ) TacProxyV1(crossChainLayer) {
        poolAddress = _poolAddress;
        swapAddress = _swapAddress;
        limitOrderAddress = _limitOrderAddress;
        liquidityManagerAddress = _liquidityManagerAddress;
    }

    struct NewPoolArguments {
        address tokenX;
        address tokenY;
        uint24 fee;
        int24 currentPoint;
    }
    struct SwapY2XArguments {
        address tokenX;
        address tokenY;
        uint24 fee;
        int24 boundaryPt;
        address recipient;
        uint128 amount;
        uint256 maxPayed;
        uint256 minAcquired;
        uint256 deadline;
    }

    struct SwapX2YArguments {
        address tokenX;
        address tokenY;
        uint24 fee;
        int24 boundaryPt;
        address recipient;
        uint128 amount;
        uint256 maxPayed;
        uint256 minAcquired;
        uint256 deadline;
    }

    struct SwapAmountArguments {
        bytes path;
        address recipient;
        uint128 amount;
        uint256 minAcquired;
        uint256 deadline;
    }

    struct SwapDesireArguments {
        bytes path;
        address recipient;
        uint128 desire;
        uint256 maxPayed;
        uint256 deadline;
    }

    struct CancelOrderArguments {
        address recipient;
        uint256 orderIdx;
        uint256 deadline;
    }

    struct CollectOrderArguments {
        address recipient;
        uint256 orderIdx;
    }

    struct NewLimOrderArguments {
        uint256 idx;
        ILimitOrderManager.AddLimOrderParam originAddLimitOrderParam;
    }

    function newPool(
         bytes calldata,
         bytes calldata arguments
    ) external {
        NewPoolArguments memory args = abi.decode(arguments, (NewPoolArguments));
        
        address pool = IPool(poolAddress).newPool(
            args.tokenX,
            args.tokenY,
            args.fee,
            args.currentPoint
        );

        emit NewPool(pool);
    }

    function swapY2X(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable {
        SwapY2XArguments memory args = abi.decode(arguments, (SwapY2XArguments));
        
        ISwap.SwapParams memory params = ISwap.SwapParams({
            tokenX: args.tokenX > args.tokenY ? args.tokenY : args.tokenX,
            tokenY: args.tokenX > args.tokenY ? args.tokenX : args.tokenY,
            fee: args.fee,
            boundaryPt: args.boundaryPt,
            recipient: args.recipient,
            amount: args.amount,
            maxPayed: args.maxPayed,
            minAcquired: args.minAcquired,
            deadline: args.deadline
        });

        TransferHelper.safeApprove(args.tokenY, swapAddress, args.amount);

        ISwap(swapAddress).swapY2X{value: msg.value}(params);

        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(args.tokenX, IERC20(args.tokenX).balanceOf(address(this)));

        _bridgeTokens(tacHeader, tokensToBridge, "");
    }

    function swapAmount(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable {
        SwapAmountArguments memory args = abi.decode(arguments, (SwapAmountArguments));
        
        address lastToken;
        assembly {
            let path := mload(add(args, 0x20))
            let pathLength := mload(path)
            let lastTokenStart := add(add(path, 0x20), sub(pathLength, 20))
            lastToken := shr(96, mload(lastTokenStart))
        }

        ISwap.SwapAmountParams memory params = ISwap.SwapAmountParams({
            path: args.path,
            recipient: args.recipient,
            amount: args.amount,
            minAcquired: args.minAcquired,
            deadline: args.deadline
        });

        ISwap(swapAddress).swapAmount{value: msg.value}(params);

        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(lastToken, IERC20(lastToken).balanceOf(address(this)));

        _bridgeTokens(tacHeader, tokensToBridge, "");
    }

    function swapX2Y(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable {
        SwapX2YArguments memory args = abi.decode(arguments, (SwapX2YArguments));
        
        ISwap.SwapParams memory params = ISwap.SwapParams({
            tokenX: args.tokenX > args.tokenY ? args.tokenY : args.tokenX,
            tokenY: args.tokenX > args.tokenY ? args.tokenX : args.tokenY,
            fee: args.fee,
            boundaryPt: args.boundaryPt,
            recipient: args.recipient,
            amount: args.amount,
            maxPayed: args.maxPayed,
            minAcquired: args.minAcquired,
            deadline: args.deadline
        });

        ISwap(swapAddress).swapX2Y{value: msg.value}(params);

        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(args.tokenY, IERC20(args.tokenY).balanceOf(address(this)));

        _bridgeTokens(tacHeader, tokensToBridge, "");
    }

    function swapX2YDesireY(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable {
        SwapX2YArguments memory args = abi.decode(arguments, (SwapX2YArguments));
        
        ISwap.SwapParams memory params = ISwap.SwapParams({
            tokenX: args.tokenX,
            tokenY: args.tokenY,
            fee: args.fee,
            boundaryPt: args.boundaryPt,
            recipient: args.recipient,
            amount: args.amount,
            maxPayed: args.maxPayed,
            minAcquired: args.minAcquired,
            deadline: args.deadline
        });

        ISwap(swapAddress).swapX2YDesireY{value: msg.value}(params);

        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(args.tokenY, IERC20(args.tokenY).balanceOf(address(this)));

        _bridgeTokens(tacHeader, tokensToBridge, "");
    }

    function swapY2XDesireX(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable {
        SwapY2XArguments memory args = abi.decode(arguments, (SwapY2XArguments));
        
        ISwap.SwapParams memory params = ISwap.SwapParams({
            tokenX: args.tokenX,
            tokenY: args.tokenY,
            fee: args.fee,
            boundaryPt: args.boundaryPt,
            recipient: args.recipient,
            amount: args.amount,
            maxPayed: args.maxPayed,
            minAcquired: args.minAcquired,
            deadline: args.deadline
        });

        ISwap(swapAddress).swapY2XDesireX{value: msg.value}(params);

        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(args.tokenX, IERC20(args.tokenX).balanceOf(address(this)));

        _bridgeTokens(tacHeader, tokensToBridge, "");
    }

    function swapDesire(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable {
        SwapDesireArguments memory args = abi.decode(arguments, (SwapDesireArguments));

        address lastToken;
        assembly {
            let path := mload(add(args, 0x20))
            let pathLength := mload(path)
            let lastTokenStart := add(add(path, 0x20), sub(pathLength, 20))
            lastToken := shr(96, mload(lastTokenStart))
        }
        
        ISwap.SwapDesireParams memory params = ISwap.SwapDesireParams({
            path: args.path,
            recipient: args.recipient,
            desire: args.desire,
            maxPayed: args.maxPayed,
            deadline: args.deadline
        });

        ISwap(swapAddress).swapDesire{value: msg.value}(params);

        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(lastToken, IERC20(lastToken).balanceOf(address(this)));

        _bridgeTokens(tacHeader, tokensToBridge, "");
    }

    function cancelOrder(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external {
        CancelOrderArguments memory args = abi.decode(arguments, (CancelOrderArguments));
        
        ILimitOrderManager.LimOrder memory order = ILimitOrderManager(limitOrderAddress).getActiveOrder(
            args.recipient,
            args.orderIdx
        );

        (address tokenX, address tokenY,) = ILimitOrderManager(limitOrderAddress).poolMetas(order.poolId);
        
        address tokenToSell = order.sellXEarnY ? tokenX : tokenY;

        ILimitOrderManager(limitOrderAddress).cancel(
            args.recipient,
            args.orderIdx,
            args.deadline
        );

        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(
            tokenToSell,
            IERC20(tokenToSell).balanceOf(address(this))
        );

        _bridgeTokens(tacHeader, tokensToBridge, "");
    }

    function collectOrder(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external {
        CollectOrderArguments memory args = abi.decode(arguments, (CollectOrderArguments));
        
        ILimitOrderManager.LimOrder memory order = ILimitOrderManager(limitOrderAddress).getActiveOrder(
            args.recipient,
            args.orderIdx
        );

        (address tokenX, address tokenY,) = ILimitOrderManager(limitOrderAddress).poolMetas(order.poolId);
        
        address tokenToReceive = order.sellXEarnY ? tokenY : tokenX;

        uint128 earn = ILimitOrderManager(limitOrderAddress).collect(
            args.recipient,
            args.orderIdx
        );

        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(
            tokenToReceive,
            earn
        );

        _bridgeTokens(tacHeader, tokensToBridge, "");
    }

    function newLimOrder(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable {
        NewLimOrderArguments memory args = abi.decode(arguments, (NewLimOrderArguments));
        
        address tokenX = args.originAddLimitOrderParam.tokenX;
        address tokenY = args.originAddLimitOrderParam.tokenY;
        uint128 amount = args.originAddLimitOrderParam.amount;
        bool sellXEarnY = args.originAddLimitOrderParam.sellXEarnY;
        address tokenToReceive = sellXEarnY ? tokenY : tokenX;
        
        TransferHelper.safeApprove(tokenX, limitOrderAddress, amount);
        
        (,,,uint128 acquire) = ILimitOrderManager(limitOrderAddress).newLimOrder{value: msg.value}(
            args.idx,
            args.originAddLimitOrderParam
        );

        if (acquire > 0) {
            TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
            tokensToBridge[0] = TokenAmount(
                tokenToReceive,
                IERC20(tokenToReceive).balanceOf(address(this))
            );

            _bridgeTokens(tacHeader, tokensToBridge, "");
        } 
    }

    function mint(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable {
        ILiquidityManager.MintParam memory params = abi.decode(arguments, (ILiquidityManager.MintParam));
        if (params.tokenX > params.tokenY) {
            address temp = params.tokenX;
            params.tokenX = params.tokenY;
            params.tokenY = temp;
        }
        TransferHelper.safeApprove(params.tokenX, liquidityManagerAddress, params.xLim);
        TransferHelper.safeApprove(params.tokenY, liquidityManagerAddress, params.yLim);

        (uint256 lid, uint128 liquidity, uint256 amountX, uint256 amountY) = 
            ILiquidityManager(liquidityManagerAddress).mint{value: msg.value}(params);

        uint256 tokenXBalance = IERC20(params.tokenX).balanceOf(address(this));
        uint256 tokenYBalance = IERC20(params.tokenY).balanceOf(address(this));
        TokenAmount[] memory tokensToBridge;
        if (tokenXBalance > 0 && tokenYBalance > 0) {
            tokensToBridge = new TokenAmount[](2);
            tokensToBridge[0] = TokenAmount(params.tokenX, tokenXBalance);
            tokensToBridge[1] = TokenAmount(params.tokenY, tokenYBalance);
        } else if (tokenXBalance > 0 || tokenYBalance > 0) {
            tokensToBridge = new TokenAmount[](1);
            if (tokenXBalance > 0) {
                tokensToBridge[0] = TokenAmount(params.tokenX, tokenXBalance);
            } else {
                tokensToBridge[0] = TokenAmount(params.tokenY, tokenYBalance);
            }
        }
        // TODO: NFT bridging is not supported yet

        _bridgeTokens(tacHeader, tokensToBridge, "");
    }

    function addLiquidity(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable {
        ILiquidityManager.AddLiquidityParam memory params = abi.decode(
            arguments,
            (ILiquidityManager.AddLiquidityParam)
        );

        ILiquidityManager.Liquidity memory liq = ILiquidityManager(liquidityManagerAddress).liquidities(params.lid);
        (address tokenX, address tokenY,) = ILiquidityManager(liquidityManagerAddress).poolMetas(liq.poolId);

        TransferHelper.safeApprove(tokenX, liquidityManagerAddress, params.xLim);
        TransferHelper.safeApprove(tokenY, liquidityManagerAddress, params.yLim);

        (uint128 liquidityDelta, uint256 amountX, uint256 amountY) = 
            ILiquidityManager(liquidityManagerAddress).addLiquidity{value: msg.value}(params);

        TokenAmount[] memory tokensToBridge = new TokenAmount[](2);
        tokensToBridge[0] = TokenAmount(tokenX, IERC20(tokenX).balanceOf(address(this)));
        tokensToBridge[1] = TokenAmount(tokenY, IERC20(tokenY).balanceOf(address(this)));

        _bridgeTokens(tacHeader, tokensToBridge, "");
    }

    function decLiquidity(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external {
        (uint256 lid, uint128 liquidDelta, uint256 amountXMin, uint256 amountYMin, uint256 deadline) = 
            abi.decode(arguments, (uint256, uint128, uint256, uint256, uint256));

        (uint256 amountX, uint256 amountY) = ILiquidityManager(liquidityManagerAddress).decLiquidity(
            lid,
            liquidDelta,
            amountXMin,
            amountYMin,
            deadline
        );

        ILiquidityManager.Liquidity memory liq = ILiquidityManager(liquidityManagerAddress).liquidities(lid);
        (address tokenX, address tokenY,) = ILiquidityManager(liquidityManagerAddress).poolMetas(liq.poolId);

        TokenAmount[] memory tokensToBridge = new TokenAmount[](2);
        tokensToBridge[0] = TokenAmount(tokenX, amountX);
        tokensToBridge[1] = TokenAmount(tokenY, amountY);

        TransferHelper.safeApprove(tokenX, _getCrossChainLayerAddress(), amountX);
        TransferHelper.safeApprove(tokenY, _getCrossChainLayerAddress(), amountY);

        _bridgeTokens(tacHeader, tokensToBridge, "");

        // TODO: NFT Bridge back
    }

    function collect(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable {
        (uint256 lid, uint128 amountXLim, uint128 amountYLim) = 
            abi.decode(arguments, (uint256, uint128, uint128));

        (uint256 amountX, uint256 amountY) = ILiquidityManager(liquidityManagerAddress).collect{value: msg.value}(
            address(this),
            lid,
            amountXLim,
            amountYLim
        );

        ILiquidityManager.Liquidity memory liq = ILiquidityManager(liquidityManagerAddress).liquidities(lid);
        (address tokenX, address tokenY,) = ILiquidityManager(liquidityManagerAddress).poolMetas(liq.poolId);

        TokenAmount[] memory tokensToBridge = new TokenAmount[](2);
        tokensToBridge[0] = TokenAmount(tokenX, amountX);
        tokensToBridge[1] = TokenAmount(tokenY, amountY);

        TransferHelper.safeApprove(tokenX, _getCrossChainLayerAddress(), amountX);
        TransferHelper.safeApprove(tokenY, _getCrossChainLayerAddress(), amountY);

        _bridgeTokens(tacHeader, tokensToBridge, "");
    }

    function burn(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external {
        uint256 lid = abi.decode(arguments, (uint256));
        
        bool success = ILiquidityManager(liquidityManagerAddress).burn(lid);

        if (!success) {
            // TODO: NFT Bridge back
            emit BurnFailed();
        }
    }

    // function multicall(
    //     bytes calldata tacHeader,
    //     bytes[] calldata data
    // ) external payable returns (bytes[] memory) {
    //     bytes[] memory results = ISwap(swapAddress).multicall{value: msg.value}(data);

    //     // CCL TAC->TON callback
    //     TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
    //     OutMessageV1 memory message = OutMessageV1({
    //         shardsKey: header.shardsKey,
    //         tvmTarget: header.tvmCaller,
    //         tvmPayload: "",
    //         toBridge: new TokenAmount[](0)
    //     });

    //     _sendMessageV1(message, 0);
        
    //     return results;
    // }

    receive() external payable {}

    function _bridgeTokens(
        bytes calldata tacHeader,
        TokenAmount[] memory tokens,
        string memory payload
    ) private {
        for (uint256 i = 0; i < tokens.length; i++) {
            TransferHelper.safeApprove(
                tokens[i].l2Address,
                _getCrossChainLayerAddress(),
                tokens[i].amount
            );
        }

        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: payload,
            toBridge: tokens
        });

        _sendMessageV1(message, 0);
    }
}
