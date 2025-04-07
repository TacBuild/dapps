// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { TransferHelper } from '@uniswap/lib/contracts/libraries/TransferHelper.sol';
import { OutMessageV2, TokenAmount, TacHeaderV1, NFTTokenAmount } from "@tonappchain/evm-ccl/contracts/L2/Structs.sol";
import { ICrossChainLayer } from "@tonappchain/evm-ccl/contracts/interfaces/ICrossChainLayer.sol";
import { TacProxyV1Upgradeable } from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import { IPool } from "./Interface/IPool.sol";
import { ISwap } from "./Interface/ISwap.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ILimitOrderManager } from "./Interface/ILimitOrderManager.sol";
import { ILiquidityManager } from "./Interface/ILiquidityManager.sol";
import { BytesLib } from "./BytesLib.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IFactory } from "./Interface/IFactory.sol";
import "hardhat/console.sol";

/**
 * @title IzumiProxy
 * @dev Proxy contract for Izumi
 */
contract IzumiProxy is TacProxyV1Upgradeable, OwnableUpgradeable, UUPSUpgradeable, IERC721Receiver {

    struct BridgeData {
        address[] tokens;
        NFTData[] nfts;
        bool isRequired;
    }

    struct NFTData {
        address nft;
        uint256 id;
        uint256 amount;
    }

    using BytesLib for bytes;
    address public poolAddress;
    address public swapAddress;
    address public limitOrderAddress;
    address public liquidityManagerAddress;
    address constant private GAS_TOKEN = 0x0000000000000000000000000000000000000000;

    event NewPool(address indexed pool);
    event BurnFailed();
    event Mint(uint256 indexed lid);

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
        uint256 orderIdx;
        uint128 amount;
        uint256 deadline;
        uint128 collectDec;
        uint128 collectEarn;
    }

    struct CollectOrderArguments {
        address recipient;
        uint256 orderIdx;
        uint128 collectDec;
        uint128 collectEarn;
    }

    struct NewLimOrderArguments {
        uint256 idx;
        ILimitOrderManager.AddLimOrderParam originAddLimitOrderParam;
    }

    function initialize(
        address crossChainLayer,
        address _poolAddress,
        address _swapAddress,
        address _limitOrderAddress,
        address _liquidityManagerAddress
    ) external initializer {
        __TacProxyV1Upgradeable_init(crossChainLayer);
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        poolAddress = _poolAddress;
        swapAddress = _swapAddress;
        limitOrderAddress = _limitOrderAddress;
        liquidityManagerAddress = _liquidityManagerAddress;
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyOwner
    {}

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

        TransferHelper.safeApprove(args.tokenY, swapAddress, args.amount);

        ISwap(swapAddress).swapY2X{value: msg.value}(params);

        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(args.tokenX, IERC20(args.tokenX).balanceOf(address(this)));

        _bridgeTokens(tacHeader, tokensToBridge, new NFTTokenAmount[](0), "");
    }

    function swapAmount(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable {
        SwapAmountArguments memory args = abi.decode(arguments, (SwapAmountArguments));
        address lastToken;
        address firstToken;

        lastToken = args.path.toAddress(args.path.length - 20);
        firstToken = args.path.toAddress(0);

        ISwap.SwapAmountParams memory params = ISwap.SwapAmountParams({
            path: args.path,
            recipient: args.recipient,
            amount: args.amount,
            minAcquired: args.minAcquired,
            deadline: args.deadline
        });

        TransferHelper.safeApprove(firstToken, swapAddress, args.amount);

        ISwap(swapAddress).swapAmount{value: msg.value}(params);

        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(lastToken, IERC20(lastToken).balanceOf(address(this)));

        _bridgeTokens(tacHeader, tokensToBridge, new NFTTokenAmount[](0), "");
    }

    function swapX2Y(
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

        TransferHelper.safeApprove(args.tokenX, swapAddress, args.amount);

        ISwap(swapAddress).swapX2Y{value: msg.value}(params);

        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(args.tokenY, IERC20(args.tokenY).balanceOf(address(this)));

        _bridgeTokens(tacHeader, tokensToBridge, new NFTTokenAmount[](0), "");
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

        TransferHelper.safeApprove(args.tokenX, swapAddress, args.maxPayed);

        ISwap(swapAddress).swapX2YDesireY{value: msg.value}(params);

        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(args.tokenY, IERC20(args.tokenY).balanceOf(address(this)));

        _bridgeTokens(tacHeader, tokensToBridge, new NFTTokenAmount[](0), "");
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

        TransferHelper.safeApprove(args.tokenY, swapAddress, args.maxPayed);

        ISwap(swapAddress).swapY2XDesireX{value: msg.value}(params);

        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(args.tokenX, IERC20(args.tokenX).balanceOf(address(this)));

        _bridgeTokens(tacHeader, tokensToBridge, new NFTTokenAmount[](0), "");
    }

    function swapDesire(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable {
        SwapDesireArguments memory args = abi.decode(arguments, (SwapDesireArguments));

        address lastToken;
        address firstToken;

        lastToken = args.path.toAddress(args.path.length - 20);
        firstToken = args.path.toAddress(0);
        
        ISwap.SwapDesireParams memory params = ISwap.SwapDesireParams({
            path: args.path,
            recipient: args.recipient,
            desire: args.desire,
            maxPayed: args.maxPayed,
            deadline: args.deadline
        });

        TransferHelper.safeApprove(firstToken, swapAddress, args.maxPayed);

        ISwap(swapAddress).swapDesire{value: msg.value}(params);

        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(lastToken, IERC20(lastToken).balanceOf(address(this)));

        _bridgeTokens(tacHeader, tokensToBridge, new NFTTokenAmount[](0), "");
    }

    function cancelOrder(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external {
        CancelOrderArguments memory args = abi.decode(arguments, (CancelOrderArguments));
        ILimitOrderManager.LimOrder memory order = ILimitOrderManager(limitOrderAddress).getActiveOrder(
            address(this),
            args.orderIdx
        );
        (address tokenX, address tokenY,) = ILimitOrderManager(limitOrderAddress).poolMetas(order.poolId);
        address tokenToSell = order.sellXEarnY ? tokenX : tokenY;
        address tokenToReceive = order.sellXEarnY ? tokenY : tokenX;

        ILimitOrderManager(limitOrderAddress).decLimOrder(
            args.orderIdx,
            args.amount,
            args.deadline
        );

        ILimitOrderManager(limitOrderAddress).collectLimOrder(
            _isGasToken(tokenToSell) || _isGasToken(tokenToReceive) ? limitOrderAddress : address(this),
            args.orderIdx,
            args.collectDec,
            args.collectEarn
        );

        if (_isGasToken(tokenToSell) || _isGasToken(tokenToReceive)) {
            ILimitOrderManager(limitOrderAddress).unwrapWETH9(0, address(this));
            _isGasToken(tokenToSell) ? ILimitOrderManager(limitOrderAddress).sweepToken(tokenToReceive, 0, address(this)) : ILimitOrderManager(limitOrderAddress).sweepToken(tokenToSell, 0, address(this));
        }
        TokenAmount[] memory tokensToBridge;

        if (IERC20(tokenToSell).balanceOf(address(this)) > 0 && IERC20(tokenToReceive).balanceOf(address(this)) > 0) {
            tokensToBridge = new TokenAmount[](2);
            tokensToBridge[0] = TokenAmount(tokenToSell, IERC20(tokenToSell).balanceOf(address(this)));
            tokensToBridge[1] = TokenAmount(tokenToReceive, IERC20(tokenToReceive).balanceOf(address(this)));
        } else  {
            tokensToBridge = new TokenAmount[](1);
            if(IERC20(tokenToSell).balanceOf(address(this)) > 0) {
                tokensToBridge[0] = TokenAmount(tokenToSell, IERC20(tokenToSell).balanceOf(address(this)));
            } else {
                tokensToBridge[0] = TokenAmount(tokenToReceive, IERC20(tokenToReceive).balanceOf(address(this)));
            }
        }
    
        _bridgeTokens(tacHeader, tokensToBridge, new NFTTokenAmount[](0), "");
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

        (uint128 actualCollectDec, uint128 actualCollectEarn) = ILimitOrderManager(limitOrderAddress).collectLimOrder(
            address(this),
            args.orderIdx,
            args.collectDec,
            args.collectEarn
        );

        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(
            tokenToReceive,
            actualCollectEarn
        );

        _bridgeTokens(tacHeader, tokensToBridge, new NFTTokenAmount[](0), "");
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
        address tokenToSell = sellXEarnY ? tokenX : tokenY;
        address tokenToReceive = sellXEarnY ? tokenY : tokenX;
        

        TransferHelper.safeApprove(tokenToSell, limitOrderAddress, amount);
        (,uint128 acquire) = ILimitOrderManager(limitOrderAddress).newLimOrder{value: msg.value}(
            args.idx,
            args.originAddLimitOrderParam
        );
        if (acquire > 0) {
            TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
            tokensToBridge[0] = TokenAmount(
                tokenToReceive,
                IERC20(tokenToReceive).balanceOf(address(this))
            );
            _bridgeTokens(tacHeader, tokensToBridge, new NFTTokenAmount[](0), "");
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

        (uint256 lid,,,) = 
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
        NFTTokenAmount[] memory nftsToBridge = new NFTTokenAmount[](1);
        nftsToBridge[0] = NFTTokenAmount(address(liquidityManagerAddress), lid, 0);

        emit Mint(lid);

        _bridgeTokens(tacHeader, tokensToBridge, nftsToBridge, "");
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
        IERC721(liquidityManagerAddress).approve(liquidityManagerAddress, params.lid);

        ILiquidityManager(liquidityManagerAddress).addLiquidity{value: msg.value}(params);

        TokenAmount[] memory tokensToBridge = new TokenAmount[](2);
        tokensToBridge[0] = TokenAmount(tokenX, IERC20(tokenX).balanceOf(address(this)));
        tokensToBridge[1] = TokenAmount(tokenY, IERC20(tokenY).balanceOf(address(this)));
        NFTTokenAmount[] memory nftsToBridge = new NFTTokenAmount[](1);
        nftsToBridge[0] = NFTTokenAmount(address(liquidityManagerAddress), params.lid, 0);

        _bridgeTokens(tacHeader, tokensToBridge, nftsToBridge, "");
    }

    function decLiquidity(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external {
        (uint256 lid, uint128 liquidDelta, uint256 amountXMin, uint256 amountYMin, uint256 deadline) = 
            abi.decode(arguments, (uint256, uint128, uint256, uint256, uint256));

        ILiquidityManager(liquidityManagerAddress).decLiquidity(
            lid,
            liquidDelta,
            amountXMin,
            amountYMin,
            deadline
        );

        ILiquidityManager.Liquidity memory liq = ILiquidityManager(liquidityManagerAddress).liquidities(lid);
        (address tokenX, address tokenY,) = ILiquidityManager(liquidityManagerAddress).poolMetas(liq.poolId);
        
        uint256 tokenXBalance = IERC20(tokenX).balanceOf(address(this));
        uint256 tokenYBalance = IERC20(tokenY).balanceOf(address(this));

        TokenAmount[] memory tokensToBridge;
        if (tokenXBalance > 0 && tokenYBalance > 0) {
            tokensToBridge = new TokenAmount[](2);
            tokensToBridge[0] = TokenAmount(tokenX, tokenXBalance);
            tokensToBridge[1] = TokenAmount(tokenY, tokenYBalance);
        } else if (tokenXBalance > 0 || tokenYBalance > 0) {
            tokensToBridge = new TokenAmount[](1);
            if (tokenXBalance > 0) {
                tokensToBridge[0] = TokenAmount(tokenX, tokenXBalance);
            } else {
                tokensToBridge[0] = TokenAmount(tokenY, tokenYBalance);
            }
        }

        NFTTokenAmount[] memory nftsToBridge = new NFTTokenAmount[](1);
        nftsToBridge[0] = NFTTokenAmount(address(liquidityManagerAddress), lid, 0);

        _bridgeTokens(tacHeader, tokensToBridge, nftsToBridge, "");

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
        NFTTokenAmount[] memory nftsToBridge = new NFTTokenAmount[](1);
        nftsToBridge[0] = NFTTokenAmount(address(liquidityManagerAddress), lid, 0);

        _bridgeTokens(tacHeader, tokensToBridge, nftsToBridge, "");
    }

    function burn(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external {
        uint256 lid = abi.decode(arguments, (uint256));
        
        bool success = ILiquidityManager(liquidityManagerAddress).burn(lid);

        if (!success) {
            TokenAmount[] memory tokensToBridge = new TokenAmount[](0);
            NFTTokenAmount[] memory nftsToBridge = new NFTTokenAmount[](1);
            nftsToBridge[0] = NFTTokenAmount(address(liquidityManagerAddress), lid, 0);
            _bridgeTokens(tacHeader, tokensToBridge, nftsToBridge, "");
            emit BurnFailed();
        }
    }

    function multicall(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable {

        (address[] memory to, bytes[] memory data, uint256[] memory value, BridgeData memory bridgeData) = abi.decode(arguments, (address[], bytes[], uint256[], BridgeData));
        for (uint256 i = 0; i < to.length; i++) {
            (bool success,) = to[i].call{value: value[i]}(data[i]);
            if (!success) {
                revert("Multicall failed");
            }
        }

        TokenAmount[] memory tokensToBridge = new TokenAmount[](bridgeData.tokens.length);
        for (uint256 i = 0; i < bridgeData.tokens.length; i++) {
            tokensToBridge[i] = TokenAmount(bridgeData.tokens[i], IERC20(bridgeData.tokens[i]).balanceOf(address(this)));
        }

        NFTTokenAmount[] memory nftsToBridge = new NFTTokenAmount[](bridgeData.nfts.length);
        for (uint256 i = 0; i < bridgeData.nfts.length; i++) {
            nftsToBridge[i] = NFTTokenAmount(bridgeData.nfts[i].nft, bridgeData.nfts[i].id, bridgeData.nfts[i].amount);
        }

        _bridgeTokens(tacHeader, tokensToBridge, nftsToBridge, "");
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

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override(IERC721Receiver) returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function _isGasToken(address token) private view returns (bool) {
        return token == GAS_TOKEN;
    }

    receive() external payable {}
}
