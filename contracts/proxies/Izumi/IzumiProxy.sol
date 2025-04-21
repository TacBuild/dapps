// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { TransferHelper } from '@uniswap/lib/contracts/libraries/TransferHelper.sol';
import { OutMessageV2, TokenAmount, TacHeaderV1, NFTAmount } from "@tonappchain/evm-ccl/contracts/L2/Structs.sol";
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
import { IWTAC } from "./Interface/IWTAC.sol";
/// @title IzumiProxy
/// @notice A proxy contract that interfaces with Izumi protocol for liquidity management and trading operations
/// @dev Implements TacProxyV1Upgradeable, OwnableUpgradeable, UUPSUpgradeable, and IERC721Receiver
contract IzumiProxy is TacProxyV1Upgradeable, OwnableUpgradeable, UUPSUpgradeable, IERC721Receiver {

    /// @notice Structure for bridge data containing tokens and NFTs to be bridged
    /// @param tokens Array of token addresses to bridge
    /// @param nfts Array of NFT data to bridge
    /// @param isRequired Whether the bridge operation is required
    struct BridgeData {
        address[] tokens;
        NFTData[] nfts;
        bool isRequired;
    }

    /// @notice Structure for NFT data to be bridged
    /// @param nft Address of the NFT contract
    /// @param id Token ID of the NFT
    /// @param amount Amount of NFTs to bridge
    struct NFTData {
        address nft;
        uint256 id;
        uint256 amount;
    }

    using BytesLib for bytes;
    /// @notice Address of the pool contract
    address public poolAddress;
    /// @notice Address of the swap contract
    address public swapAddress;
    /// @notice Address of the limit order contract
    address public limitOrderAddress;
    /// @notice Address of the liquidity manager contract
    address public liquidityManagerAddress;
    /// @notice Address of the W-TAC contract
    IWTAC public wTac;

    /// @notice Emitted when a new pool is created
    /// @param pool Address of the newly created pool
    event NewPool(address indexed pool);
    /// @notice Emitted when a burn operation fails
    event BurnFailed();
    /// @notice Emitted when a new liquidity position is minted
    /// @param lid ID of the minted liquidity position
    event Mint(uint256 indexed lid);

    /// @notice Arguments for creating a new pool
    /// @param tokenX Address of the first token in the pool
    /// @param tokenY Address of the second token in the pool
    /// @param fee Fee tier of the pool
    /// @param currentPoint Current price point of the pool
    struct NewPoolArguments {
        address tokenX;
        address tokenY;
        uint24 fee;
        int24 currentPoint;
    }

    /// @notice Arguments for swapping token Y to token X
    /// @param tokenX Address of token X
    /// @param tokenY Address of token Y
    /// @param fee Fee tier of the pool
    /// @param boundaryPt Boundary point for the swap
    /// @param recipient Address to receive the swapped tokens
    /// @param amount Amount of tokens to swap
    /// @param maxPayed Maximum amount to pay
    /// @param minAcquired Minimum amount to acquire
    /// @param deadline Deadline for the swap
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

    /// @notice Arguments for swapping token X to token Y
    /// @param tokenX Address of token X
    /// @param tokenY Address of token Y
    /// @param fee Fee tier of the pool
    /// @param boundaryPt Boundary point for the swap
    /// @param recipient Address to receive the swapped tokens
    /// @param amount Amount of tokens to swap
    /// @param maxPayed Maximum amount to pay
    /// @param minAcquired Minimum amount to acquire
    /// @param deadline Deadline for the swap
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

    /// @notice Arguments for swapping a specific amount
    /// @param path Path of tokens for the swap
    /// @param recipient Address to receive the swapped tokens
    /// @param amount Amount of tokens to swap
    /// @param minAcquired Minimum amount to acquire
    /// @param deadline Deadline for the swap
    struct SwapAmountArguments {
        bytes path;
        address recipient;
        uint128 amount;
        uint256 minAcquired;
        uint256 deadline;
    }

    /// @notice Arguments for swapping with a desired amount
    /// @param path Path of tokens for the swap
    /// @param recipient Address to receive the swapped tokens
    /// @param desire Desired amount of tokens
    /// @param maxPayed Maximum amount to pay
    /// @param deadline Deadline for the swap
    struct SwapDesireArguments {
        bytes path;
        address recipient;
        uint128 desire;
        uint256 maxPayed;
        uint256 deadline;
    }

    /// @notice Arguments for canceling an order
    /// @param orderIdx Index of the order to cancel
    /// @param amount Amount to cancel
    /// @param deadline Deadline for the cancellation
    /// @param collectDec Amount to collect from decrease
    /// @param collectEarn Amount to collect from earnings
    struct CancelOrderArguments {
        uint256 orderIdx;
        uint128 amount;
        uint256 deadline;
        uint128 collectDec;
        uint128 collectEarn;
    }

    /// @notice Arguments for collecting from an order
    /// @param recipient Address to receive the collected tokens
    /// @param orderIdx Index of the order to collect from
    /// @param collectDec Amount to collect from decrease
    /// @param collectEarn Amount to collect from earnings
    struct CollectOrderArguments {
        address recipient;
        uint256 orderIdx;
        uint128 collectDec;
        uint128 collectEarn;
    }

    /// @notice Arguments for creating a new limit order
    /// @param idx Index for the new order
    /// @param originAddLimitOrderParam Original limit order parameters
    struct NewLimOrderArguments {
        uint256 idx;
        ILimitOrderManager.AddLimOrderParam originAddLimitOrderParam;
    }

    /// @notice Initializes the proxy contract
    /// @param crossChainLayer Address of the cross-chain layer contract
    /// @param _poolAddress Address of the pool contract
    /// @param _swapAddress Address of the swap contract
    /// @param _limitOrderAddress Address of the limit order contract
    /// @param _liquidityManagerAddress Address of the liquidity manager contract
    function initialize(
        address crossChainLayer,
        address _poolAddress,
        address _swapAddress,
        address _limitOrderAddress,
        address _liquidityManagerAddress,
        address _wTacAddress
    ) external initializer {
        __TacProxyV1Upgradeable_init(crossChainLayer);
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        poolAddress = _poolAddress;
        swapAddress = _swapAddress;
        limitOrderAddress = _limitOrderAddress;
        liquidityManagerAddress = _liquidityManagerAddress;
        wTac = IWTAC(_wTacAddress);
    }

    /// @notice Internal function to authorize upgrades
    /// @param newImplementation Address of the new implementation
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyOwner
    {}

    /// @notice Creates a new pool
    /// @param arguments Encoded pool creation arguments
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

    /// @notice Swaps token Y for token X
    /// @param tacHeader TAC header data
    /// @param arguments Encoded swap arguments
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

        _bridgeTokens(tacHeader, tokensToBridge, new NFTAmount[](0), "");
    }

    /// @notice Swaps tokens along a specified path for a specific amount
    /// @param tacHeader TAC header data
    /// @param arguments Encoded swap amount arguments
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

        _bridgeTokens(tacHeader, tokensToBridge, new NFTAmount[](0), "");
    }

    /// @notice Swaps token X for token Y
    /// @param tacHeader TAC header data
    /// @param arguments Encoded swap arguments
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

        _bridgeTokens(tacHeader, tokensToBridge, new NFTAmount[](0), "");
    }

    /// @notice Swaps token X for token Y with a desired amount of Y
    /// @param tacHeader TAC header data
    /// @param arguments Encoded swap arguments
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

        _bridgeTokens(tacHeader, tokensToBridge, new NFTAmount[](0), "");
    }

    /// @notice Swaps token Y for token X with a desired amount of X
    /// @param tacHeader TAC header data
    /// @param arguments Encoded swap arguments
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

        _bridgeTokens(tacHeader, tokensToBridge, new NFTAmount[](0), "");
    }

    /// @notice Swaps tokens along a specified path with a desired amount
    /// @param tacHeader TAC header data
    /// @param arguments Encoded swap desire arguments
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

        _bridgeTokens(tacHeader, tokensToBridge, new NFTAmount[](0), "");
    }

    /// @notice Cancels an existing order
    /// @param tacHeader TAC header data
    /// @param arguments Encoded cancel order arguments
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
            address(this),
            args.orderIdx,
            args.collectDec,
            args.collectEarn
        );
        
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
    
        _bridgeTokens(tacHeader, tokensToBridge, new NFTAmount[](0), "");
    }

    /// @notice Collects tokens from an order
    /// @param tacHeader TAC header data
    /// @param arguments Encoded collect order arguments
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

        _bridgeTokens(tacHeader, tokensToBridge, new NFTAmount[](0), "");
    }

    /// @notice Creates a new limit order
    /// @param tacHeader TAC header data
    /// @param arguments Encoded new limit order arguments
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
            _bridgeTokens(tacHeader, tokensToBridge, new NFTAmount[](0), "");
        } 
    }

    /// @notice Mints a new liquidity position
    /// @param tacHeader TAC header data
    /// @param arguments Encoded mint arguments
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
        NFTAmount[] memory nftsToBridge = new NFTAmount[](1);
        nftsToBridge[0] = NFTAmount(address(liquidityManagerAddress), lid, 0);

        emit Mint(lid);

        _bridgeTokens(tacHeader, tokensToBridge, nftsToBridge, "");
    }

    /// @notice Adds liquidity to an existing position
    /// @param tacHeader TAC header data
    /// @param arguments Encoded add liquidity arguments
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
        NFTAmount[] memory nftsToBridge = new NFTAmount[](1);
        nftsToBridge[0] = NFTAmount(address(liquidityManagerAddress), params.lid, 0);

        _bridgeTokens(tacHeader, tokensToBridge, nftsToBridge, "");
    }

    /// @notice Decreases liquidity in a position
    /// @param tacHeader TAC header data
    /// @param arguments Encoded decrease liquidity arguments
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

        TokenAmount[] memory tokensToBridge = _getTokensToBridge(tokenX, tokenY);
        
        NFTAmount[] memory nftsToBridge = new NFTAmount[](1);
        nftsToBridge[0] = NFTAmount(address(liquidityManagerAddress), lid, 0);

        _bridgeTokens(tacHeader, tokensToBridge, nftsToBridge, "");
    }

    function _getTokensToBridge(address tokenX, address tokenY) private view returns (TokenAmount[] memory tokensToBridge) {
        uint256 tokenXBalance = IERC20(tokenX).balanceOf(address(this));
        uint256 tokenYBalance = IERC20(tokenY).balanceOf(address(this));
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
        return tokensToBridge;
    }

    /// @notice Collects fees from a liquidity position
    /// @param tacHeader TAC header data
    /// @param arguments Encoded collect arguments
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
        NFTAmount[] memory nftsToBridge = new NFTAmount[](1);
        nftsToBridge[0] = NFTAmount(address(liquidityManagerAddress), lid, 0);

        _bridgeTokens(tacHeader, tokensToBridge, nftsToBridge, "");
    }

    /// @notice Burns a liquidity position
    /// @param tacHeader TAC header data
    /// @param arguments Encoded burn arguments
    function burn(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external {
        uint256 lid = abi.decode(arguments, (uint256));
        
        bool success = ILiquidityManager(liquidityManagerAddress).burn(lid);

        if (!success) {
            TokenAmount[] memory tokensToBridge = new TokenAmount[](0);
            NFTAmount[] memory nftsToBridge = new NFTAmount[](1);
            nftsToBridge[0] = NFTAmount(address(liquidityManagerAddress), lid, 0);
            _bridgeTokens(tacHeader, tokensToBridge, nftsToBridge, "");
            emit BurnFailed();
        }
    }

    /// @notice Executes multiple calls in a single transaction
    /// @param tacHeader TAC header data
    /// @param arguments Encoded multicall arguments
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

        NFTAmount[] memory nftsToBridge = new NFTAmount[](bridgeData.nfts.length);
        for (uint256 i = 0; i < bridgeData.nfts.length; i++) {
            nftsToBridge[i] = NFTAmount(bridgeData.nfts[i].nft, bridgeData.nfts[i].id, bridgeData.nfts[i].amount);
        }

        _bridgeTokens(tacHeader, tokensToBridge, nftsToBridge, "");
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
            tvmProtocolFee: 0,
            tvmExecutorFee: 0,
            tvmValidExecutors: new string[](0),
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

    /// @notice Receives ETH
    receive() external payable {
        IWTAC(wTac).deposit{value: msg.value}(0);
    }
}
