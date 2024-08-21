// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IConsensus } from "contracts/interfaces/IConsensus.sol";


/**
 * @title IGroup
 * @dev An interface for sequencer group.
 */
interface IGroup is IConsensus {
    /**
     * @dev Gets the current (last selected) Merkle Root.
     * @return bytes32 Current (last selected) Merkle Root.
     */
    function getMerkleRoot() external view returns (bytes32);

    /**
     * @dev Gets the group name.
     * @return string Group name.
     */
    function getName() external view returns (string memory);
}
