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

contract TestSmartAccountProxyUser is UUPSUpgradeable, OwnableUpgradeable, TacProxyV1Upgradeable {

    TacSAFactory public tacSAFactory;
    uint256 public counter;
    bool public mainCallExecuted;
    struct MainCallStruct{
        uint256 value;
    }
    event Incremented(uint256 indexed count, address indexed sender);
    function initialize(
        address _crossChainLayer,
        address _tacSAFactory
    ) external initializer {
        __TacProxyV1Upgradeable_init(_crossChainLayer);
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();        
        tacSAFactory = TacSAFactory(_tacSAFactory);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
    
    function test(bytes calldata tacHeader, bytes calldata arguments) public _onlyCrossChainLayer {

        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);

        (IHooks.SaHooks memory hooks) = abi.decode(arguments, (IHooks.SaHooks));
        SaHelper.executePreHooks(user, hooks);
        SaHelper.executeMainCall(user, hooks);
        SaHelper.executePostHooks(user, hooks);
        SaHelper.executeBridgeHooks(user, hooks, tacHeader, "payload", _getCrossChainLayerAddress());
    }

    function increment() public {
        counter++;
        emit Incremented(counter, msg.sender);
    }

    function mainCall(uint256) public {
        mainCallExecuted = true;
    }
    
}
