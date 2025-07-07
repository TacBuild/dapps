// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IMockOracle } from "../Interface/IMockOracle.sol";

contract MockOracle is IMockOracle {
    function price() external view returns (uint256) {
        // Use timestamp to create price variations around 1e37 base price
        // Variation of +-100 using simple modulo operation
        uint256 basePrice = 1e36;
        uint256 variation = basePrice + (uint256(keccak256(abi.encodePacked(block.timestamp))) % 10000) - 4999;
        return variation;
    }
}