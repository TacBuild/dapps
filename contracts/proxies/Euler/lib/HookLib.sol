// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IHooks} from "./IHooks.sol";
import {ITacSmartAccount} from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/ITacSmartAccount.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

library SaHelper {
    // address public constant NATIVE_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    
    function executePreHooks(address sa, IHooks.SaHooks memory hooks) internal returns(bytes[] memory) {
        IHooks.PreHook[] memory preHooks = hooks.preHooks;
        bytes[] memory results = new bytes[](preHooks.length);
        for (uint256 i = 0; i < preHooks.length; i++) {
            if (preHooks[i].isFromSAPerspective) {
                results[i] = ITacSmartAccount(sa).execute(preHooks[i].contractAddress, preHooks[i].value, preHooks[i].data);
            } else {
                (address to, uint256 amount) = abi.decode(preHooks[i].data, (address, uint256));
                if(preHooks[i].contractAddress == 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE) {
                    (bool success, ) = to.call{value: amount}("");
                    require(success, "Transfer failed");
                } else {
                    SafeERC20.safeTransfer(IERC20(preHooks[i].contractAddress), to, amount);
                }
                results[i] = abi.encode(true);
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
                (address to, uint256 amount) = abi.decode(postHooks[i].data, (address, uint256));
                if(postHooks[i].contractAddress == 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE) {
                    (bool success, ) = to.call{value: amount}("");
                    require(success, "Transfer failed");
                } else {
                    SafeERC20.safeTransfer(IERC20(postHooks[i].contractAddress), to, amount);
                }
                results[i] = abi.encode(true);
            }
        }
        return results;
    }
}
