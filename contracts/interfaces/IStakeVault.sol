// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @title IConsensus
 * @dev An interface for managing consensus with epoch-based voting.
 */
interface IStakeVault {
    /**
     * @dev Update sequencer stake.
     * @param sequencer Sequencer address.
     * @param stake Sequencer stake.
     */
    function updateSequencerStake(address sequencer, uint256 stake) external;

    /**
     * @dev Returns sequencer current stake.
     * @param address_ Sequencer address.
     */
    function getSequencerStake(address address_) external view returns (uint256);

    /**
     * @dev Returns number of sequencers active in current round.
     */
    function getActiveSequencerCount() external view returns (uint256);

    /**
     * @dev Returns all active sequencer current round stakes.
     */
    function getAllSequencersWithStakes() external view returns (address[] memory, uint256[] memory);
}
