// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IConsensus } from "contracts/interfaces/IConsensus.sol";
import { InMessage, OutMessage, TokenAmount } from "contracts/L2/Structs.sol";


/**
 * @title ICrossChainLayer
 * @dev An interface for Cross-Chain Layer.
 */
interface ICrossChainLayer is IConsensus {  

    // Events
    
    /**
     * @dev Native Cross-Chain Layer token received event
     * @param fromAddress From address
     * @param amount Token amount
     */
    event NativeTokenReceived(address indexed fromAddress, uint256 amount);

    /**
     * @dev Native Cross-Chain Layer token fallback event
     * @param fromAddress From address
     * @param amount Token amount
     */
    event NativeTokenFallback(address indexed fromAddress, uint256 amount);

    /**
     * @dev Input (receive) message executed event
     * @param queryId Query Id to track message
     * @param callerAddress Caller address (L1 message initiator)
     * @param targetAddress Target address (L2 recipient address)
     * @param tokensMinted Token minted during message processing
     * @param tokensUnlocked Token unlocked during message processing
     */
    event InMessageProcessed(
        uint64 queryId, 
        uint256 operationId,
        string callerAddress, 
        address targetAddress, 
        TokenAmount[] tokensMinted, 
        TokenAmount[] tokensUnlocked
    );

    /**
     * @dev Output (send) message executed event
     * @param queryId Query Id to track message
     * @param callerAddress Caller address (L2 message initiator)
     * @param targetAddress Recipient address (L1 recipient address))
     * @param tokensBurned Token burned during message processing
     * @param tokensLocked Token locked during message processing
     */
    event OutMessageProcessed(
        uint64 queryId, 
        uint256 operationId,
        address callerAddress, 
        string targetAddress, 
        TokenAmount[] tokensBurned, 
        TokenAmount[] tokensLocked
    );

    // Interface

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
     * @param messageHash Message hash to check.
     * @return bool True if the message has been processed, false otherwise.
     */
    function getInMessageState(bytes32 messageHash) external view returns (bool);

    /**
     * @dev Checks if the message has been processed.
     * @param messageHash Message hash to check.
     * @return bool True if the message has been processed, false otherwise.
     */
    function getOutMessageState(bytes32 messageHash) external view returns (bool);
}
