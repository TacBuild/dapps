// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Token, Order} from "./ICarbonController.sol";

struct StrategyData {
    Token[2] tokens;
    Order[2] orders;
}

interface ICarbonBatcher {
    function batchCreate(StrategyData[] calldata strategyData) external payable returns (uint256[] memory);
}