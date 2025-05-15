// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IMockOracle } from "../Interface/IMockOracle.sol";

contract MockOracle is IMockOracle {
    function price() external pure returns (uint256) {
        return 1e36;
    }
}