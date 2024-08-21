// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IConsensus } from "contracts/interfaces/IConsensus.sol";
import { InMessage, OutMessage, TokenAmount } from "contracts/L2/Structs.sol";


/**
 * @title ICrossChainLayer
 * @dev An interface for Cross-Chain Layer.
 */
interface ICrossChainLayer is IConsensus {    
    /**
     * @dev Accepts an L1->L2 message to process if the Merkle proof is valid.
     * @param message Message to process.
     * @param merkleProof Merkle proof for the message.
     * @param value Amount of ETH to send with the message (if needed).
     */
    function receiveMessage(InMessage calldata message, bytes32[] calldata merkleProof, uint256 value) external payable;

    /**
     * @dev Accepts an L2->L1 message to process (e.g. a callback from dApp).
     * @param message Mmessage to process.
     */
    function sendMessage(OutMessage calldata message) external payable;

    /**
     * @dev Checks if the input (receive) message has been processed.
     * @param message Message to check.
     * @return bool True if the message has been processed, false otherwise.
     */
    function getInMessageState(InMessage calldata message) external view returns (bool);

    /**
     * @dev Checks if the message has been processed.
     * @param message Message to check.
     * @return bool True if the message has been processed, false otherwise.
     */
    function getOutMessageState(OutMessage calldata message) external view returns (bool);
}
