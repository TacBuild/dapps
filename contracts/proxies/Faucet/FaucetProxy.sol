// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ITreasurySwap } from 'contracts/proxies/Faucet/ITreasurySwap.sol';
import { TransferHelper } from '@uniswap/lib/contracts/libraries/TransferHelper.sol';

import { AppProxy } from "contracts/L2/AppProxy.sol";
import { OutMessage, TokenAmount } from "tac-l2-ccl/contracts/L2/Structs.sol";
import { ICrossChainLayer } from "tac-l2-ccl/contracts/interfaces/ICrossChainLayer.sol";

/**
 * @title FaucetProxy
 * @dev Proxy contract for TreasurySwap
 */
contract FaucetProxy is AppProxy {
    /**
     * @dev Constructor function to initialize the contract with initial state.
     * @param appAddress Application address.
     * @param settingsAddress Settings address.
     */
    constructor(address appAddress, address settingsAddress) AppProxy(appAddress, settingsAddress) {
    }

    /**
     * @dev A proxy to TreasurySwap.mint(...).
     */
    function mint(
        address to
    ) public payable {
        // proxy call
        ITreasurySwap(_appAddress).mint{value: msg.value}(to);
        uint256 tokenValue = ITreasurySwap(_appAddress).tokenValue();
        uint256 amount = (msg.value * tokenValue) / (10 ** 18);

        // tokens to L2->L1 transfer (lock)
        address takenAddressReceived = ITreasurySwap(_appAddress).token();
        // grant token approvals
        TransferHelper.safeApprove(takenAddressReceived, getCrossChainLayerAddress(), amount);
        TokenAmount[] memory tokensToLock = new TokenAmount[](1);
        tokensToLock[0] = TokenAmount(takenAddressReceived, amount);

        // CCL L2->L1 callback
        OutMessage memory message = OutMessage({
            queryId: 0,
            timestamp: block.timestamp,
            target: "",
            methodName: "",
            arguments: new bytes(0),
            caller: address(this),
            burn: new TokenAmount[](0),
            lock: tokensToLock
        });
        sendMessage(message, 0);
    }

    /**
     * @dev A proxy to TreasurySwap.burn(...).
     */
    function burn(
        uint256 amount
    ) public {
        // grant token approvals
        TransferHelper.safeApprove(ITreasurySwap(_appAddress).token(), _appAddress, amount);

        // proxy call
        ITreasurySwap(_appAddress).burn(amount);
        uint256 tokenValue = ITreasurySwap(_appAddress).tokenValue();
        uint256 refundAmount = amount * 10 ** 18 / tokenValue;

        // CCL L2->L1 callback
        OutMessage memory message = OutMessage({
            queryId: 0,
            timestamp: block.timestamp,
            target: "",
            methodName: "",
            arguments: new bytes(0),
            caller: address(this),
            burn: new TokenAmount[](0),
            lock: new TokenAmount[](0)
        });
        sendMessage(message, refundAmount);
    }
}
