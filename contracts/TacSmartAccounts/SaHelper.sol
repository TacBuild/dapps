// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IHooks} from "./Interface/IHooks.sol";
import {ITacSmartAccount} from "./Interface/ITacSmartAccount.sol";
import {TokenAmount, NFTAmount} from "@tonappchain/evm-ccl/contracts/core/Structs.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library SaHelper {
    
    function executePreHooks(address sa, IHooks.SaHooks memory hooks) internal {
        IHooks.PreHook[] memory preHooks = hooks.preHooks;

        for (uint256 i = 0; i < preHooks.length; i++) {
            if (preHooks[i].isFromSAPerspective) {
                ITacSmartAccount(sa).execute(preHooks[i].contractAddress, preHooks[i].value, preHooks[i].data);
            } else {
                _selfCall(preHooks[i].contractAddress, preHooks[i].value, preHooks[i].data);
            }
        }
    }

    function executePostHooks(address sa, IHooks.SaHooks memory hooks) internal {
        IHooks.PostHook[] memory postHooks = hooks.postHooks;

        for (uint256 i = 0; i < postHooks.length; i++) {
            if (postHooks[i].isFromSAPerspective) {
                ITacSmartAccount(sa).execute(postHooks[i].contractAddress, postHooks[i].value, postHooks[i].data);
            } else {
                _selfCall(postHooks[i].contractAddress, postHooks[i].value, postHooks[i].data);
            }
        }
    }

    function executeMainCall(address sa, IHooks.SaHooks memory hooks) internal {
        IHooks.MainCallHook memory mainCallHook = hooks.mainCallHook;
        if (mainCallHook.isFromSAPerspective) {
            ITacSmartAccount(sa).execute(mainCallHook.contractAddress, mainCallHook.value, mainCallHook.data);
        } else {
            _selfCall(mainCallHook.contractAddress, mainCallHook.value, mainCallHook.data);
        }
    }

    function _selfCall(address to, uint256 value, bytes memory data) internal {
        (bool success,) = to.call{value: value}(data);
        require(success, "Self call failed");
    }
}
