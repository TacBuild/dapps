// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IHooks} from "./Interface/IHooks.sol";
import {ITacSmartAccount} from "./Interface/ITacSmartAccount.sol";
import {TokenAmount, NFTAmount} from "@tonappchain/evm-ccl/contracts/core/Structs.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library SaHelper {
    
    function executePreHooks(address sa, IHooks.SaHooks memory hooks) internal returns(bytes[] memory) {
        IHooks.PreHook[] memory preHooks = hooks.preHooks;
        bytes[] memory results = new bytes[](preHooks.length);
        for (uint256 i = 0; i < preHooks.length; i++) {
            if (preHooks[i].isFromSAPerspective) {
                results[i] = ITacSmartAccount(sa).execute(preHooks[i].contractAddress, preHooks[i].value, preHooks[i].data);
            } else {
                results[i] = _selfCall(preHooks[i].contractAddress, preHooks[i].value, preHooks[i].data);
            }
        }
        return results;
    }

    function executePostHooks(address sa, IHooks.SaHooks memory hooks) internal returns(bytes[] memory) {
        IHooks.PostHook[] memory postHooks = hooks.postHooks;
        bytes[] memory results = new bytes[](postHooks.length);
        for (uint256 i = 0; i < postHooks.length; i++) {
            if (postHooks[i].isFromSAPerspective) {
                results[i] = ITacSmartAccount(sa).execute(postHooks[i].contractAddress, postHooks[i].value, postHooks[i].data);
            } else {
                results[i] = _selfCall(postHooks[i].contractAddress, postHooks[i].value, postHooks[i].data);
            }
        }
        return results;
    }

    function executeMainCall(address sa, IHooks.SaHooks memory hooks) internal returns(bytes memory) {
        IHooks.MainCallHook memory mainCallHook = hooks.mainCallHook;
        if (mainCallHook.isFromSAPerspective) {
            return ITacSmartAccount(sa).execute(mainCallHook.contractAddress, mainCallHook.value, mainCallHook.data);
        } else {
            return _selfCall(mainCallHook.contractAddress, mainCallHook.value, mainCallHook.data);
        }
    }

    function _selfCall(address to, uint256 value, bytes memory data) internal returns(bytes memory) {
        (bool success, bytes memory returnData) = to.call{value: value}(data);
        require(success, "Self call failed");
        return returnData;
    }
}
