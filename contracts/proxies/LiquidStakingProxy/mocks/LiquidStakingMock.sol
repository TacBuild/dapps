// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {LiquidTacToken} from "./LiquidTacToken.sol";

contract LiquidStakingMock {
    uint64 public constant UNBONDING_TIME = 1 hours;

    LiquidTacToken public immutable gTAC;

    constructor(address liquidTacToken_) {
        gTAC = LiquidTacToken(liquidTacToken_);
    }

    function liquidStake(address delegatorAddress, uint256 amount) external returns (bool success) {
        require(amount != 0, "Invalid amount");
        gTAC.mint(delegatorAddress, amount);
        return true;
    }

    function liquidUnstake(address delegatorAddress, uint256 amount) external returns (int64 completionTime) {
        gTAC.burnFrom(delegatorAddress, amount);
        completionTime = int64(int(block.timestamp + UNBONDING_TIME));
    }
}
