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
import {IWTAC} from "@tonappchain/evm-ccl/contracts/interfaces/IWTAC.sol";
import "hardhat/console.sol";

contract OpenOceanProxy is
    TacProxyV1Upgradeable,
    UUPSUpgradeable,
    Ownable2StepUpgradeable
{
    address public constant OPEN_OCEAN_ROUTER = 0x6352a56caadC4F1E25CD6c75970Fa768A3304e64;

    ISAFactory public tacSAFactory;
    IWTAC public WTAC;


    struct CallArguments {
        bytes data;
        address tokenToApprove;
        address tokenToBridge;
    }

    event CallRouter(bytes indexed result, address indexed user, string tvmCaller);

    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the proxy contract
    /// @param _crossChainLayer Address of the cross-chain layer contract
    /// @param _tacSAFactory Address of the smart account factory contract
    /// @param _owner Address of the owner of the proxy contract
    function initialize(
        address _crossChainLayer,
        address _tacSAFactory,
        address _owner,
        address _wtac
    ) external initializer {
        __TacProxyV1Upgradeable_init(_crossChainLayer);
        __Ownable_init(_owner == address(0) ? msg.sender : _owner);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        tacSAFactory = ISAFactory(_tacSAFactory);
        WTAC = IWTAC(_wtac);
    }

    /// @notice Internal function to authorize upgrades
    /// @param newImplementation Address of the new implementation
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    function callRouter(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable _onlyCrossChainLayer {
        (CallArguments memory callArguments) = abi.decode(arguments, (CallArguments));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        uint256 amount = IERC20(callArguments.tokenToApprove).balanceOf(address(this));
        ITacSmartAccount(payable(user)).approve(callArguments.tokenToApprove, OPEN_OCEAN_ROUTER, amount);
        SafeERC20.safeTransfer(IERC20(callArguments.tokenToApprove), user, amount);
        bytes memory result = ITacSmartAccount(payable(user)).execute(OPEN_OCEAN_ROUTER, msg.value, callArguments.data);
        address[] memory tokens = new address[](2);
        tokens[0] = callArguments.tokenToApprove;
        tokens[1] = callArguments.tokenToBridge;
        _bridgeLogic(tokens, user, tacHeader);
        emit CallRouter(result, user, header.tvmCaller);
    }

    function _bridgeLogic(address[] memory tokens, address user, bytes calldata tacHeader) internal {
        uint256 realAmountOfTokensToBridge = 0;
        uint256 nativeAmount = 0;
        TokenAmount[] memory tokenAmounts = new TokenAmount[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 amount = IERC20(tokens[i]).balanceOf(user);
            if (amount == 0) {
                continue;
            }
            ITacSmartAccount(payable(user)).execute(
                tokens[i],
                0,
                abi.encodeWithSelector(IERC20.transfer.selector, address(this), amount)
            );
            if (tokens[i] == address(WTAC)){
                
                nativeAmount = amount;
            } else {
                tokenAmounts[realAmountOfTokensToBridge] = TokenAmount({
                    evmAddress: tokens[i],
                    amount: amount
                });
                realAmountOfTokensToBridge++;
            }
        }
        assembly {
            mstore(tokenAmounts, realAmountOfTokensToBridge)
        }
        if (nativeAmount > 0) {
            WTAC.withdraw(nativeAmount);
        }
        _bridgeTokens(tacHeader, tokenAmounts, "", nativeAmount);
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

    receive() external payable {}
    

}