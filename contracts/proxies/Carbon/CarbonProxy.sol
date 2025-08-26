// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {TacProxyV1Upgradeable} from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ISAFactory} from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/ISAFactory.sol";
import {ITacSmartAccount} from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/ITacSmartAccount.sol";
import {OutMessageV1, TokenAmount, TacHeaderV1, NFTAmount} from "@tonappchain/evm-ccl/contracts/core/Structs.sol";
import {ICarbonController, Order, Token, TradeAction, Strategy} from "./interfaces/ICarbonController.sol";
import {ICarbonBatcher, StrategyData} from "./interfaces/ICarbonBatcher.sol";
import {ICarbonVoucher} from "./interfaces/ICarbonVoucher.sol";

contract CarbonProxy is TacProxyV1Upgradeable, Ownable2StepUpgradeable, UUPSUpgradeable {

    ICarbonController public carbonController;
    ICarbonBatcher public carbonBatcher;
    ICarbonVoucher public carbonVoucher;
    ISAFactory public tacSAFactory;
    address constant NATIVE_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;


    event StrategyCreated(uint256 indexed strategyId, address indexed user, string indexed tvmWalletCaller);
    event StrategyCreatedBatch(uint256[] strategyIds, address indexed user, string tvmWalletCaller);
    event StrategyUpdated(uint256 indexed strategyId);
    event StrategyDeleted(uint256 indexed strategyId);
    event TradeBySourceAmount(Token indexed sourceToken, Token indexed targetToken, address indexed user, string tvmWalletCaller, TradeAction[] tradeActions, uint256 deadline, uint128 minReturn);
    event TradeByTargetAmount(Token indexed sourceToken, Token indexed targetToken, address indexed user, string tvmWalletCaller, TradeAction[] tradeActions, uint256 deadline, uint128 maxInput);
    event StrategyTransferred(uint256 indexed strategyId, string indexed oldOwner, string indexed receiver);
    error TransferFailed();

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    constructor() {
        _disableInitializers();
    }

    function initialize(address _carbonController, address _carbonBatcher, address _carbonVoucher, address _saFactory, address _crosschainLayerAddress, address _owner) external initializer {
        __TacProxyV1Upgradeable_init(_crosschainLayerAddress);
        __Ownable_init(_owner == address(0) ? msg.sender : _owner);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        carbonController = ICarbonController(_carbonController);
        carbonBatcher = ICarbonBatcher(_carbonBatcher);
        carbonVoucher = ICarbonVoucher(_carbonVoucher);
        tacSAFactory = ISAFactory(_saFactory);
    }


    function createStrategy(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable _onlyCrossChainLayer {
        (Token token0, Token token1, Order[2] memory orders) = abi.decode(arguments, (Token, Token, Order[2]));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        
        (uint256 nativeAmount, address[] memory tokensToClear) = _strategyCreationPreparation([token0, token1], user, false);
        bytes memory response = ITacSmartAccount(payable(user)).execute(address(carbonController), nativeAmount, abi.encodeWithSelector(ICarbonController.createStrategy.selector, token0, token1, orders));
        uint256 strategyId = abi.decode(response, (uint256));
        _clearDustFromSa(user, tokensToClear, tacHeader);
        emit StrategyCreated(strategyId, user, header.tvmCaller);
    }

    function batchCreate(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable _onlyCrossChainLayer {
        (StrategyData[] memory strategyData) = abi.decode(arguments, (StrategyData[]));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        address[] memory tokensToClearOverall = new address[](0);
        uint256 nativeAmountOverall = 0;
        for (uint256 i = 0; i < strategyData.length; i++) {
            (uint256 nativeAmount, address[] memory tokensToClear) = _strategyCreationPreparation(strategyData[i].tokens, user, true);
            tokensToClearOverall = _concatenateAddressArrays(tokensToClearOverall, tokensToClear);
            nativeAmountOverall += nativeAmount;
        }
        bytes memory response = ITacSmartAccount(payable(user)).execute(address(carbonBatcher), nativeAmountOverall, abi.encodeWithSelector(ICarbonBatcher.batchCreate.selector, strategyData));
        uint256[] memory strategyIds = abi.decode(response, (uint256[]));
        _clearDustFromSa(user, tokensToClearOverall, tacHeader);
        emit StrategyCreatedBatch(strategyIds, user, header.tvmCaller);
    }

    function _strategyCreationPreparation(Token[2] memory tokens, address user, bool isViaBatcher) internal returns (uint256, address[] memory) {
        address[] memory tokensToClear = new address[](tokens.length);
        uint256 nativeAmount = 0;
        for (uint256 i = 0; i < tokens.length; i++) {
            tokensToClear[i] = Token.unwrap(tokens[i]);
            nativeAmount += _handleTokenPrepBeforeOp(user, tokensToClear[i], isViaBatcher);
        }
        return (nativeAmount, tokensToClear);
    }

    function updateStrategy(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable _onlyCrossChainLayer {
        (uint256 strategyId, Order[2] memory currentOrders, Order[2] memory newOrders) = abi.decode(arguments, (uint256, Order[2], Order[2]));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        Strategy memory strategy = carbonController.strategy(strategyId);
        uint256 nativeAmount = _handleTokenPrepBeforeOp(user, Token.unwrap(strategy.tokens[0]), false);
        nativeAmount += _handleTokenPrepBeforeOp(user, Token.unwrap(strategy.tokens[1]), false);
        ITacSmartAccount(payable(user)).execute(address(carbonController), nativeAmount, abi.encodeWithSelector(ICarbonController.updateStrategy.selector, strategyId, currentOrders, newOrders));
        address[] memory tokensToClear = new address[](2);
        tokensToClear[0] = Token.unwrap(strategy.tokens[0]);
        tokensToClear[1] = Token.unwrap(strategy.tokens[1]);
        _clearDustFromSa(user, tokensToClear, tacHeader);
        emit StrategyUpdated(strategyId);
    }

    function deleteStrategy(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer {
        (uint256 strategyId) = abi.decode(arguments, (uint256));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        address[] memory tokensToClear = new address[](2);
        Strategy memory strategy = carbonController.strategy(strategyId);
        tokensToClear[0] = Token.unwrap(strategy.tokens[0]);
        tokensToClear[1] = Token.unwrap(strategy.tokens[1]);
        ITacSmartAccount(payable(user)).execute(address(carbonController), 0, abi.encodeWithSelector(ICarbonController.deleteStrategy.selector, strategyId));
        _clearDustFromSa(user, tokensToClear, tacHeader);
        emit StrategyDeleted(strategyId);
    }

    function transferStrategy(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer {
        (uint256 strategyId, string memory receiver) = abi.decode(arguments, (uint256, string));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        (address receiverAddress,) = tacSAFactory.getOrCreateSmartAccount(receiver);
        ITacSmartAccount(payable(user)).execute(address(carbonVoucher), 0, abi.encodeWithSelector(ICarbonVoucher.safeTransferFrom.selector, user, receiverAddress, strategyId, ""));
        emit StrategyTransferred(strategyId, header.tvmCaller, receiver);
    }

    function tradeBySourceAmount(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable _onlyCrossChainLayer {
        (Token sourceToken, Token targetToken, TradeAction[] memory tradeActions, uint256 deadline, uint128 minReturn) = abi.decode(arguments, (Token, Token, TradeAction[], uint256, uint128));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        uint256 nativeAmount = _handleTokenPrepBeforeOp(user, Token.unwrap(sourceToken), false);
        ITacSmartAccount(payable(user)).execute(address(carbonController), nativeAmount, abi.encodeWithSelector(ICarbonController.tradeBySourceAmount.selector, sourceToken, targetToken, tradeActions, deadline, minReturn));
        address[] memory tokensToClear = new address[](2);
        tokensToClear[0] = Token.unwrap(targetToken);
        tokensToClear[1] = Token.unwrap(sourceToken);
        _clearDustFromSa(user, tokensToClear, tacHeader);
        emit TradeBySourceAmount(sourceToken, targetToken, user, header.tvmCaller, tradeActions, deadline, minReturn);
    }

    function tradeByTargetAmount(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable _onlyCrossChainLayer {
        (Token sourceToken, Token targetToken, TradeAction[] memory tradeActions, uint256 deadline, uint128 maxInput) = abi.decode(arguments, (Token, Token, TradeAction[], uint256, uint128));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        uint256 nativeAmount = _handleTokenPrepBeforeOp(user, Token.unwrap(sourceToken), false);
        ITacSmartAccount(payable(user)).execute(address(carbonController), nativeAmount, abi.encodeWithSelector(ICarbonController.tradeByTargetAmount.selector, sourceToken, targetToken, tradeActions, deadline, maxInput));
        address[] memory tokensToClear = new address[](2);
        tokensToClear[0] = Token.unwrap(sourceToken);
        tokensToClear[1] = Token.unwrap(targetToken);
        _clearDustFromSa(user, tokensToClear, tacHeader);
        emit TradeByTargetAmount(sourceToken, targetToken, user, header.tvmCaller, tradeActions, deadline, maxInput);
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

    function _handleTokenPrepBeforeOp(address user, address token, bool isViaBatcher) internal returns (uint256 nativeAmount) {
        uint256 amount = 0;
        if (token == NATIVE_ADDRESS) {
            amount = address(this).balance;
            (bool success, )= payable(user).call{value: amount}("");
            require(success, TransferFailed());
            return amount;
        } else {
            amount = IERC20(token).balanceOf(address(this));
            if (amount == 0) {
                return 0;
            }
            ITacSmartAccount(payable(user)).approve(token, isViaBatcher ? address(carbonBatcher) : address(carbonController), amount);
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
                if (user.balance == 0) {
                    continue;
                }
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
        
        if (nativeAmount > 0 || realAmountOfTokensToBridge > 0) {
            assembly {
                mstore(tokenAmounts, realAmountOfTokensToBridge)
            }
            _bridgeTokens(tacHeader, tokenAmounts, "", nativeAmount);
        }
    }

    /// @notice Concatenates two address arrays using assembly for gas efficiency
    /// @param array1 First address array
    /// @param array2 Second address array
    /// @return result Concatenated address array
    function _concatenateAddressArrays(address[] memory array1, address[] memory array2) internal returns (address[] memory result) {
        uint256 length1 = array1.length;
        uint256 length2 = array2.length;
        uint256 totalLength = length1 + length2;
        
        result = new address[](totalLength);
        
        assembly {
            let resultPtr := add(result, 0x20)  // Skip length field
            let array1Ptr := add(array1, 0x20)  // Skip length field
            let array2Ptr := add(array2, 0x20)  // Skip length field
            
            // Copy first array (length1 * 32 bytes per address)
            let bytesToCopy1 := mul(length1, 0x20)
            if gt(bytesToCopy1, 0) {
                // Use identity precompile for efficient memory copy
                let success := call(gas(), 0x04, 0, array1Ptr, bytesToCopy1, resultPtr, bytesToCopy1)
            }
            
            // Copy second array to position after first array
            let bytesToCopy2 := mul(length2, 0x20)
            if gt(bytesToCopy2, 0) {
                let destPtr := add(resultPtr, bytesToCopy1)
                // Use identity precompile for efficient memory copy
                let success := call(gas(), 0x04, 0, array2Ptr, bytesToCopy2, destPtr, bytesToCopy2)
            }
        }
        
        return result;
    }

    receive() external payable {}


}






    