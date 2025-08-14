// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SaHelper} from "@tonappchain/evm-ccl/contracts/smart-account/libs/SaHelper.sol";
import {IHooks} from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/IHooks.sol";
import {ICrossChainLayer} from "@tonappchain/evm-ccl/contracts/interfaces/ICrossChainLayer.sol";
import {TacProxyV1Upgradeable} from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ISAFactory} from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/ISAFactory.sol";
import {ITacSmartAccount} from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/ITacSmartAccount.sol";
import {OutMessageV1, TokenAmount, TacHeaderV1, NFTAmount} from "@tonappchain/evm-ccl/contracts/core/Structs.sol";
import {ICarbonController, Order, Token, TradeAction, Strategy} from "./interfaces/ICarbonController.sol";

contract CarbonProxy is TacProxyV1Upgradeable, Ownable2StepUpgradeable, UUPSUpgradeable {

    ICarbonController public carbonController;
    ISAFactory public tacSAFactory;
    address constant NATIVE_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    struct CreateStrategyArgs {
        Token token0;
        Token token1;
        Order[2] orders;
    }

    struct UpdateStrategyArgs {
        uint256 strategyId;
        Order[2] currentOrders;
        Order[2] newOrders;
    }

    struct DeleteStrategyArgs {
        uint256 strategyId;
        Token token0;
        Token token1;
    }

    struct TradeBySourceAmountArgs {
        Token sourceToken;
        Token targetToken;
        TradeAction[] tradeActions;
        uint256 deadline;
        uint128 minReturn;
    }

    struct TradeByTargetAmountArgs {
        Token sourceToken;
        Token targetToken;
        TradeAction[] tradeActions;
        uint256 deadline;
        uint128 maxInput;
    }

    event StrategyCreated(uint256 indexed strategyId, address indexed user, string indexed tvmWalletCaller);
    event StrategyUpdated(uint256 indexed strategyId);
    event StrategyDeleted(uint256 indexed strategyId);
    event TradeBySourceAmount(Token indexed sourceToken, Token indexed targetToken, address indexed user, string tvmWalletCaller, TradeAction[] tradeActions, uint256 deadline, uint128 minReturn, uint128 returnAmount);
    event TradeByTargetAmount(Token indexed sourceToken, Token indexed targetToken, address indexed user, string tvmWalletCaller, TradeAction[] tradeActions, uint256 deadline, uint128 maxInput, uint128 returnAmount);

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    constructor() {
        _disableInitializers();
    }

    function initialize(address _carbonController, address _saFactory, address _crosschainLayerAddress, address _owner) external initializer {
        __TacProxyV1Upgradeable_init(_crosschainLayerAddress);
        __Ownable_init(_owner == address(0) ? msg.sender : _owner);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        carbonController = ICarbonController(_carbonController);
        tacSAFactory = ISAFactory(_saFactory);
    }


    function createStrategy(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable _onlyCrossChainLayer {
        (CreateStrategyArgs memory args) = abi.decode(arguments, (CreateStrategyArgs));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        address token0 = Token.unwrap(args.token0);
        address token1 = Token.unwrap(args.token1);
        uint256 nativeAmount = _handleTokenPrepBeforeOp(user, token0);
        nativeAmount += _handleTokenPrepBeforeOp(user, token1);
        bytes memory response = ITacSmartAccount(payable(user)).execute(address(carbonController), nativeAmount, abi.encodeWithSelector(ICarbonController.createStrategy.selector, args.token0, args.token1, args.orders));
        uint256 strategyId = abi.decode(response, (uint256));
        address[] memory tokensToClear = new address[](2);
        tokensToClear[0] = token0;
        tokensToClear[1] = token1;
        _clearDustFromSa(user, tokensToClear, tacHeader);
        emit StrategyCreated(strategyId, user, header.tvmCaller);
    }

    function updateStrategy(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable _onlyCrossChainLayer {
        (UpdateStrategyArgs memory args) = abi.decode(arguments, (UpdateStrategyArgs));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        Strategy memory strategy = carbonController.strategy(args.strategyId);
        uint256 nativeAmount = _handleTokenPrepBeforeOp(user, Token.unwrap(strategy.tokens[0]));
        nativeAmount += _handleTokenPrepBeforeOp(user, Token.unwrap(strategy.tokens[1]));
        ITacSmartAccount(payable(user)).execute(address(carbonController), nativeAmount, abi.encodeWithSelector(ICarbonController.updateStrategy.selector, args.strategyId, args.currentOrders, args.newOrders));
        address[] memory tokensToClear = new address[](2);
        tokensToClear[0] = Token.unwrap(strategy.tokens[0]);
        tokensToClear[1] = Token.unwrap(strategy.tokens[1]);
        _clearDustFromSa(user, tokensToClear, tacHeader);
        emit StrategyUpdated(args.strategyId);
    }

    function deleteStrategy(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer {
        (DeleteStrategyArgs memory args) = abi.decode(arguments, (DeleteStrategyArgs));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        ITacSmartAccount(payable(user)).execute(address(carbonController), 0, abi.encodeWithSelector(ICarbonController.deleteStrategy.selector, args.strategyId));
        address[] memory tokensToClear = new address[](2);
        tokensToClear[0] = Token.unwrap(args.token0);
        tokensToClear[1] = Token.unwrap(args.token1);
        _clearDustFromSa(user, tokensToClear, tacHeader);
        emit StrategyDeleted(args.strategyId);
    }

    function tradeBySourceAmount(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable _onlyCrossChainLayer {
        (TradeBySourceAmountArgs memory args) = abi.decode(arguments, (TradeBySourceAmountArgs));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        address tokenIn = Token.unwrap(args.sourceToken);
        uint256 nativeAmount = _handleTokenPrepBeforeOp(user, tokenIn);
        bytes memory response = ITacSmartAccount(payable(user)).execute(address(carbonController), nativeAmount, abi.encodeWithSelector(ICarbonController.tradeBySourceAmount.selector, args.sourceToken, args.targetToken, args.tradeActions, args.deadline, args.minReturn));
        uint128 returnAmount = abi.decode(response, (uint128));
        address[] memory tokensToClear = new address[](2);
        tokensToClear[0] = Token.unwrap(args.targetToken);
        tokensToClear[1] = tokenIn;
        _clearDustFromSa(user, tokensToClear, tacHeader);
        emit TradeBySourceAmount(args.sourceToken, args.targetToken, user, header.tvmCaller, args.tradeActions, args.deadline, args.minReturn, returnAmount);
    }

    function tradeByTargetAmount(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable _onlyCrossChainLayer {
        (TradeByTargetAmountArgs memory args) = abi.decode(arguments, (TradeByTargetAmountArgs));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        address tokenIn = Token.unwrap(args.sourceToken);
        uint256 nativeAmount = _handleTokenPrepBeforeOp(user, tokenIn);
        bytes memory response = ITacSmartAccount(payable(user)).execute(address(carbonController), nativeAmount, abi.encodeWithSelector(ICarbonController.tradeByTargetAmount.selector, args.sourceToken, args.targetToken, args.tradeActions, args.deadline, args.maxInput));
        uint128 returnAmount = abi.decode(response, (uint128));
        address[] memory tokensToClear = new address[](2);
        tokensToClear[0] = Token.unwrap(args.targetToken);
        tokensToClear[1] = tokenIn;
        _clearDustFromSa(user, tokensToClear, tacHeader);
        emit TradeByTargetAmount(args.sourceToken, args.targetToken, user, header.tvmCaller, args.tradeActions, args.deadline, args.maxInput, returnAmount);
    }

    /// @notice Bridges tokens to the cross-chain layer
    /// @param tacHeader TAC header data
    /// @param tokens Array of token amounts to bridge
    /// @param payload Additional payload data
    function _bridgeTokens(
        bytes calldata tacHeader,
        TokenAmount[] memory tokens,
        string memory payload,
        uint256 nativeAmount
    ) private {
        for (uint256 i = 0; i < tokens.length; i++) {
            SafeERC20.forceApprove(
                IERC20(tokens[i].evmAddress),
                _getCrossChainLayerAddress(),
                tokens[i].amount
            );
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
            toBridgeNFT: new NFTAmount[](0)
        });

        _sendMessageV1(message, nativeAmount);
    }

    function _handleTokenPrepBeforeOp(address user, address token) internal returns (uint256 nativeAmount) {
        uint256 amount = 0;
        if (token == NATIVE_ADDRESS) {
            amount = address(this).balance;
            (bool success, )= payable(user).call{value: amount}("");
            require(success, "Transfer failed");
            return amount;
        } else {
            amount = IERC20(token).balanceOf(address(this));
            ITacSmartAccount(payable(user)).approve(token, address(carbonController), amount);
            SafeERC20.safeTransfer(IERC20(token), user, amount);
            return 0;
        }
    }

    function _clearDustFromSa(address user, address[] memory tokens,  bytes calldata tacHeader) internal {
        uint256 nativeAmount = 0;
        uint256 tokensLength = tokens.length;
        uint256 realAmountOfTokensToBridge = 0;
        TokenAmount[] memory tokenAmounts = new TokenAmount[](tokensLength);
        for (uint256 i = 0; i < tokensLength; i++) {
            if (tokens[i] == address(0)) {
                continue;
            }
            if (tokens[i] == NATIVE_ADDRESS) {
                nativeAmount = user.balance;
                ITacSmartAccount(payable(user)).execute(address(this), nativeAmount, "");
                continue;
            }
            uint256 amount = IERC20(tokens[i]).balanceOf(user);
            if (amount == 0) {
                continue;
            }
            ITacSmartAccount(payable(user)).execute(
                tokens[i],
                0,
                abi.encodeWithSelector(IERC20.transfer.selector, address(this), amount)
            );
            
            tokenAmounts[realAmountOfTokensToBridge] = TokenAmount({
                evmAddress: tokens[i],
                amount: amount
            });
            realAmountOfTokensToBridge++;
            
        }
        assembly {
            mstore(tokenAmounts, realAmountOfTokensToBridge)
        }
        _bridgeTokens(tacHeader, tokenAmounts, "", nativeAmount);
    }

    receive() external payable {}


}






    