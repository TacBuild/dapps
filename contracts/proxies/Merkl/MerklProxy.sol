// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {OutMessageV1, TokenAmount, TacHeaderV1, NFTAmount} from "@tonappchain/evm-ccl/contracts/core/Structs.sol";
import {TacProxyV1Upgradeable} from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ITacSmartAccount} from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/ITacSmartAccount.sol";
import {ISAFactory} from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/ISAFactory.sol";
import {IMerkl} from "./interface/IMerkl.sol";

contract MerklProxy is TacProxyV1Upgradeable, Ownable2StepUpgradeable, UUPSUpgradeable {

    ISAFactory public tacSAFactory;
    IMerkl public merkl;

    mapping(address token => address customMerklLogic) public tokenToLogic;

    struct ClaimData {
        address[] tokens;
        uint256[] amounts;
        bytes32[][] proofs;
        bool transferAndBridge;
    }

    struct CustomFunctionCalldata {
        address token;
        bytes4[] functionSelectors;
        bytes[] functionData;
        address[] tokenToBridge;
    }

    event CustomMerklLogicSet(address indexed token, address indexed customMerklLogic);

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _crossChainLayer,
        address _tacSAFactory,
        address _merkl
    ) external initializer {
        __TacProxyV1Upgradeable_init(_crossChainLayer);
        __Ownable_init(msg.sender);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        tacSAFactory = ISAFactory(_tacSAFactory);
        merkl = IMerkl(_merkl);
    }

    /// @notice Internal function to authorize upgrades
    /// @param newImplementation Address of the new implementation
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}


    function claim(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer() {
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, ) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        (ClaimData memory data) = abi.decode(arguments, (ClaimData));
        require(data.proofs.length == 1, "MerklProxy: Invalid number of users, should be 1");
        address[] memory users = new address[](1);
        users[0] = user;        
        ITacSmartAccount(payable(user)).execute(
                    address(merkl),
                    0,
                    abi.encodeWithSelector(IMerkl.claim.selector, users, data.tokens, data.amounts, data.proofs)
        );
        if (data.transferAndBridge) {
            ITacSmartAccount(payable(user)).execute(
                    data.tokens[0],
                    0,
                    abi.encodeWithSelector(IERC20.transfer.selector, address(this), IERC20(data.tokens[0]).balanceOf(user))
                );
        
            if (IERC20(data.tokens[0]).balanceOf(address(this)) > 0) {
                TokenAmount[] memory tokens = new TokenAmount[](1);
                tokens[0] = TokenAmount({
                    evmAddress: data.tokens[0],
                    amount: IERC20(data.tokens[0]).balanceOf(address(this))
                });

                _bridgeTokens(tacHeader, tokens, "");
            }
        }
    }

    ///@dev Tokens from any function should always be sent to SmartAccount first by custom 
    ///logic proxy and then if needed to bridge, transfer to this contract and then bridge
    function customFunctionCall(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer() {
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, ) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        (CustomFunctionCalldata memory data) = abi.decode(arguments, (CustomFunctionCalldata));
        address logic = tokenToLogic[data.token];
        require(logic != address(0), "MerklProxy: Custom logic not found");
        
        for (uint256 i = 0; i < data.functionSelectors.length; i++) {
            ITacSmartAccount(payable(user)).createOneTimeTicket(logic);
            (bool success,) = logic.call(abi.encodeWithSelector(data.functionSelectors[i], user, data.functionData[i]));
            require(success, "custom function call failed");
            ITacSmartAccount(payable(user)).revokeOneTimeTicket(logic);
        }

        if (data.tokenToBridge.length > 0) {
            
            TokenAmount[] memory tokens = new TokenAmount[](data.tokenToBridge.length);
            for (uint256 i = 0; i < data.tokenToBridge.length; i++) {
                uint256 amount = IERC20(data.tokenToBridge[i]).balanceOf(user);
                ITacSmartAccount(payable(user)).execute(
                    data.tokenToBridge[i],
                    0,
                    abi.encodeWithSelector(IERC20.transfer.selector, address(this), amount)
                );
                tokens[i] = TokenAmount({
                    evmAddress: data.tokenToBridge[i],
                    amount: amount
                });
            }
            _bridgeTokens(tacHeader, tokens, "");
        }
    }

    function bridgeTokensFromSmartAccount(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer() {
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, ) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        (address[] memory tokens) = abi.decode(arguments, (address[]));
        TokenAmount[] memory tokenAmounts = new TokenAmount[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 amount = IERC20(tokens[i]).balanceOf(user);
            ITacSmartAccount(payable(user)).execute(
                tokens[i],
                0,
                abi.encodeWithSelector(IERC20.transfer.selector, address(this), amount)
            );
            tokenAmounts[i] = TokenAmount({
                evmAddress: tokens[i],
                amount: amount
            });
        }
        _bridgeTokens(tacHeader, tokenAmounts, "");
    }

    function getUserAddressForTvmCaller(string calldata tvmCaller) public view returns (address) {
        return tacSAFactory.getSmartAccountForApplication(tvmCaller, address(this));
    }

    function setCustomMerklLogic(address token, address customMerklLogic) external onlyOwner {
        tokenToLogic[token] = customMerklLogic;
        emit CustomMerklLogicSet(token, customMerklLogic);
    }

    /// @notice Bridges tokens to the cross-chain layer
    /// @param tacHeader TAC header data
    /// @param tokens Array of token amounts to bridge
    /// @param payload Additional payload data
    function _bridgeTokens(
        bytes calldata tacHeader,
        TokenAmount[] memory tokens,
        string memory payload
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

        _sendMessageV1(message, address(this).balance);
    }
}


