// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { InMessage, OutMessage } from "contracts/L2/Structs.sol";


/**
 * @title IMerkleTreeUtils
 * @dev An interface to message and Merkle tree utilitary functions
 */
interface IMerkleTreeUtils {
    /**
     * @dev Calculates message hash.
     * @param message Message.
     */
    function hashInMessage(InMessage calldata message) external pure returns (bytes32);

    /**
     * @dev Calculates message hash.
     * @param message Message.
     */
    function hashOutMessage(OutMessage calldata message) external pure returns (bytes32);

    /**
     * @dev Commutative Keccak256 hash of a sorted pair of bytes32. Frequently used when working with merkle proofs.
     * Warning! Taken from https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/cryptography/Hashes.sol
     *          To be used from the next OpenZeppelin release.
     */
    function commutativeKeccak256(bytes32 a, bytes32 b) external pure returns (bytes32);

    /**
     * @dev Function to calculate the Merkle root from the message hash and proof.
     * @param objectHash Leaf object hash to validate.
     * @param merkleProof Merkle proof.
     */
    function checkMerkleProof(bytes32 objectHash, bytes32[] calldata merkleProof) external pure returns (bytes32);
}
