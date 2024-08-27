// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;


/**
 * @title TokenAmount
 * @dev Token address with amount
 */
struct TokenAmount {
    address tokenAddress;
    uint256 amount;
}


/**
 * @title TokenInfo
 * @dev Extended L1 token info
 */
struct TokenInfo {
    string name;
    string symbol;
    uint8 decimals;
    string l1Address;
    string l1AdditionalAddress;
    address l2Address;
}


/**
 * @title InMessage
 * @dev L1->L2 message
 */
struct InMessage {
    uint64 queryId;
    uint256 timestamp;
    address target;
    string methodName;
    bytes arguments;
    string caller;
    TokenAmount[] mint;
    TokenAmount[] unlock;
}


/**
 * @title OutMessage
 * @dev L2->L1 message
 */
struct OutMessage {
    uint64 queryId;
    uint256 timestamp;
    string target;
    string methodName;
    bytes arguments;
    address caller;
    TokenAmount[] burn;
    TokenAmount[] lock;
}

/**
 * @title EpochInfo
 * @dev Consensus epoch info
 */
struct EpochInfo {
    uint64 epochNumber;
    uint64 epochStartTime;
    bool consensusReached;
}
