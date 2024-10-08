// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { EpochInfo } from "contracts/L2/Structs.sol";


/**
 * @title IConsensus
 * @dev An interface for managing consensus with epoch-based voting.
 */
interface IConsensus {

    // Events

    /**
     * @dev Voter added as eligible event
     * @param voterAddress Voter address
     */
    event VoterAdded(address indexed voterAddress);

    /**
     * @dev Voter blocked event
     * @param voterAddress Voter address
     */
    event VoterBlocked(address indexed voterAddress);

    /**
     * @dev Consensus epoch started event
     * @param epochNumber Epoch number
     */
    event ConsensusEpochStarted(uint64 indexed epochNumber);

    /**
     * @dev Consensus value was updated to a new value event
     * @param newValue New consensus value value
     */
    event ConsensusValueUpdated(bytes32 indexed newValue);

    // Intarface

    /**
     * @dev Vote for a new value.
     * @param newValue New value.
     * @return bool True if consensus is reached, false otherwise.
     */
    function vote(bytes32 newValue) external returns (bool);

    /**
     * @dev Returns current epoch info.
     * @return Epoch info.
     */
    function getCurrentEpoch() external view returns (EpochInfo memory);

    /**
     * @dev Gets total number of active voters.
     * @return uint64 Total number of active voters.
     */
    function totalVoters() external view returns (uint64);

    /**
     * @dev Gets the current (last selected) value.
     * @return bytes32 Current (last selected) value.
     */
    function getValue() external view returns (bytes32);
}
