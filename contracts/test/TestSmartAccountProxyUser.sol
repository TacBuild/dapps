// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {SaHelper} from "../TacSmartAccounts/SaHelper.sol";
import {IHooks} from "../TacSmartAccounts/Interface/IHooks.sol";
import {TacProxyV1Upgradeable} from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {TacSAFactory} from "../TacSmartAccounts/TacSAFactory.sol";
import {TacHeaderV1, TokenAmount, NFTAmount, OutMessageV1} from "@tonappchain/evm-ccl/contracts/L2/Structs.sol";
import {TransferHelper} from "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
contract TestSmartAccountProxyUser is UUPSUpgradeable, TacProxyV1Upgradeable {

    TacSAFactory public tacSAFactory;
    uint256 public counter;
    bool public mainCallExecuted;
    address public tokenToBridge;
    address public user;
    struct MainCallStruct{
        uint256 value;
    }
    event Incremented(uint256 indexed count, address indexed sender);
    function initialize(
        address _crossChainLayer,
        address _tacSAFactory
    ) external initializer {
        __TacProxyV1Upgradeable_init(_crossChainLayer);
        __UUPSUpgradeable_init();        
        tacSAFactory = TacSAFactory(_tacSAFactory);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override {}
    
    function test(bytes calldata tacHeader, bytes calldata arguments) public _onlyCrossChainLayer {

        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address createdUser,) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);

        (IHooks.SaHooks memory hooks) = abi.decode(arguments, (IHooks.SaHooks));
        SaHelper.executePreHooks(createdUser, hooks);
        SaHelper.executeMainCall(createdUser, hooks);
        SaHelper.executePostHooks(createdUser, hooks);
        TokenAmount[] memory tokens = new TokenAmount[](1);
        tokens[0] = TokenAmount({
            l2Address: tokenToBridge,
            amount: IERC20(tokenToBridge).balanceOf(address(this))
        });
        _bridgeTokens(tacHeader, tokens, "payload");
    }

    function increment() public {
        counter++;
        emit Incremented(counter, msg.sender);
    }

    function mainCall(uint256, address _tokenToBrdige) public {
        mainCallExecuted = true;
        tokenToBridge = _tokenToBrdige;
        user = msg.sender;
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
            tvmProtocolFee: 0,
            tvmExecutorFee: 0,
            tvmValidExecutors: new string[](0),
            toBridge: tokens,
            toBridgeNFT: new NFTAmount[](0)
        });

        _sendMessageV1(message, address(this).balance);
    }
    
}
