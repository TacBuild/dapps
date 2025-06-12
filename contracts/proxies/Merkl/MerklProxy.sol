// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TransferHelper} from "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import {OutMessageV1, TokenAmount, TacHeaderV1, NFTAmount} from "@tonappchain/evm-ccl/contracts/core/Structs.sol";
import {ICrossChainLayer} from "@tonappchain/evm-ccl/contracts/interfaces/ICrossChainLayer.sol";
import {TacProxyV1Upgradeable} from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TacSmartAccount} from "../../TacSmartAccounts/TacSmartAccount.sol";
import {TacSAFactory} from "../../TacSmartAccounts/TacSAFactory.sol";
import {IMerkl} from "./interface/IMerkl.sol";
import {SaHelper} from "../../TacSmartAccounts/SaHelper.sol";
import {IHooks} from "../../TacSmartAccounts/Interface/IHooks.sol";
import "hardhat/console.sol";

contract MerklProxy is TacProxyV1Upgradeable, OwnableUpgradeable, UUPSUpgradeable {

    TacSAFactory public tacSAFactory;
    IMerkl public merkl;

    mapping(address token => address customMerklLogic) public tokenToLogic;

    struct ClaimData {
        address[] tokens;
        uint256[] amounts;
        bytes32[][] proofs;
        bytes customLogicData;
    }

    struct CsutomFunctionCallData {
        address token;
        string[] functionNames;
        bytes[] functionData;
        address tokenToBridge;
    }

    event AccountRegistrated(address indexed user, string indexed tvmCaller);

    function initialize(
        address _crossChainLayer,
        address _tacSAFactory,
        address _merkl
    ) external initializer {
        __TacProxyV1Upgradeable_init(_crossChainLayer);
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        tacSAFactory = TacSAFactory(_tacSAFactory);
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
        users[0] = 0xA5AdB55dAcda60B989BDBb215b80341D1B9659f0;
        
        
        // TacSmartAccount(payable(user)).execute(
        //             address(merkl),
        //             0,
        //             abi.encodeWithSelector(IMerkl.claim.selector, [0xA5AdB55dAcda60B989BDBb215b80341D1B9659f0], data.tokens, data.amounts, data.proofs)
        // );
        merkl.claim(users, data.tokens, data.amounts, data.proofs);
        console.log("claim done");
        if (tokenToLogic[data.tokens[0]] != address(0)) {
            console.log("custom claim");
            _customClaim(data, users, tacHeader);
        } else {
            console.log("reg claim");
                TacSmartAccount(payable(user)).execute(
                    data.tokens[0],
                    0,
                    abi.encodeWithSelector(IERC20.transfer.selector, address(this), IERC20(data.tokens[0]).balanceOf(user))
                );
            console.log("transfer done");
        
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

    function _customClaim(
        ClaimData memory data, address[] memory users, bytes calldata tacHeader
    ) internal {
        (bool success, bytes memory returnData) = tokenToLogic[data.tokens[0]].delegatecall(abi.encodeWithSignature("claim(address,address,bytes)", users[0], data.tokens[0], data.customLogicData));
        require(success, "Delegatecall failed");
        address tokenToBridge = abi.decode(returnData, (address));
        if (tokenToBridge != address(0)) {
            TokenAmount[] memory tokens = new TokenAmount[](1);
            tokens[0] = TokenAmount({
                evmAddress: tokenToBridge,
                amount: IERC20(tokenToBridge).balanceOf(address(this))
            });
            _bridgeTokens(tacHeader, tokens, "");
        }
    }

    function customFunctionCall(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer() {
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, ) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        (CsutomFunctionCallData memory data) = abi.decode(arguments, (CsutomFunctionCallData));
        address logic = tokenToLogic[data.token];
        require(logic != address(0), "MerklProxy: Custom logic not found");

        for (uint256 i = 0; i < data.functionNames.length; i++) {
            TacSmartAccount(payable(user)).delegatecall(
                address(logic),
                abi.encodeWithSignature(data.functionNames[i], data.functionData[i])
            );
        }

        if (data.tokenToBridge != address(0)) {
            TokenAmount[] memory tokens = new TokenAmount[](1);
            tokens[0] = TokenAmount({
                evmAddress: data.tokenToBridge,
                amount: IERC20(data.tokenToBridge).balanceOf(address(this))
            });
            _bridgeTokens(tacHeader, tokens, "");
        }
    }

    function getUserAddressForTvmCaller(string calldata tvmCaller) public view returns (address) {
        return tacSAFactory.getSmartAccountForApplication(tvmCaller, address(this));
    }

    function setCustomMerklLogic(address token, address customMerklLogic) external onlyOwner {
        tokenToLogic[token] = customMerklLogic;
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
            TransferHelper.safeApprove(
                tokens[i].evmAddress,
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


