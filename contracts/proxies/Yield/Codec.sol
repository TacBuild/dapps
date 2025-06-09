// SPDX-License-Identifier: GPL-2.0
pragma solidity ^0.8.20;

import {Common} from "./Common.sol";
import {Constants} from "./Constants.sol";

struct RewardPayload {
    address receiver;
    uint256 amount;
    uint256 epoch;
    uint256 rewardType;
}

struct BridgeSendPayload {
    uint32 dstId;
    address to;
    address token;
    uint256 amount;
    bytes32 trxnType;
}

struct OrderPayload {
    address token;
    address receiver; // who is gonna get yUSD
    uint256 amount; // for deposit it is asset / shares order withdraw
    uint256 sharePrice; // share price for yUSD only used in L2 chains
    uint256 sAmount; // price for converting token to sUSD value
    uint256 fee; // % represented in 1/Constants.HUNDERED_PERCENT
    uint256 deadline;
    bytes32 trxnType;
}

error WrongDataLength();
error WrongAddressEncoding();
error WrongData();

library Codec {
    uint256 internal constant DATA_LENGTH = 32 * 5;
    uint256 internal constant ORDER_DATA_LENGTH = 32 * 8;

    function decodeReward(
        bytes calldata _data
    ) internal view returns (RewardPayload memory) {
        if (_data.length != DATA_LENGTH) {
            revert WrongDataLength();
        }

        (
            address receiver,
            uint256 amount,
            uint256 epoch,
            uint256 rewardType,
            bytes32 trxnType
        ) = abi.decode(_data, (address, uint256, uint256, uint256, bytes32));

        if (trxnType != Constants.REWARD_HASH) {
            revert WrongData();
        }

        if (receiver == address(0) || !Common.isContract(receiver)) {
            revert WrongAddressEncoding();
        }

        if (amount == 0 || epoch < 1 || rewardType >= 2) {
            revert WrongData();
        }

        return RewardPayload(receiver, amount, epoch, rewardType);
    }

    function decodeBridgeSendPayload(
        bytes calldata _data
    ) internal view returns (BridgeSendPayload memory) {
        if (_data.length != DATA_LENGTH) {
            revert WrongDataLength();
        }

        (
            uint32 dstId,
            address to,
            address token,
            uint256 amount,
            bytes32 trxnType
        ) = abi.decode(_data, (uint32, address, address, uint256, bytes32));

        if (trxnType != Constants.BRIDGE_SEND_HASH) {
            revert WrongData();
        }
        if (dstId == 0 ) {
            revert WrongData();
        }
        if (to == address(0)) {
            revert WrongAddressEncoding();
        }
        if (token == address(0) || !Common.isContract(token)) {
            revert WrongAddressEncoding();
        }
        if (amount == 0) {
            revert WrongData();
        }

        return BridgeSendPayload(dstId, to, token, amount, trxnType);
    }

    function _validate(bytes32 trxn, address receiver, uint256 amount, uint256 sharePrice, uint256 sAmount, uint256 deadline) internal view {

        if (receiver == address(0) || amount == 0 || deadline == 0) {
            revert WrongData();
        }

        if (trxn == Constants.DEPOSIT) {
            if (sAmount == 0) revert WrongData();
        }

        if (trxn == Constants.DEPOSIT_L2 ) {
            if (sAmount == 0 || sharePrice == 0) revert WrongData();
        }

        if (trxn == Constants.WITHDRAW_L2 ) {
            if (sharePrice == 0) revert WrongData();
        }

        require(block.timestamp < deadline, "!deadline");
    }

    function decodeOrderPayload(bytes memory _data) internal view returns (OrderPayload memory) {

        if (_data.length != ORDER_DATA_LENGTH) {
            revert WrongDataLength();
        }

        (
            address token,
            address receiver,
            uint256 amount,
            uint256 sharePrice,
            uint256 sAmount,
            uint256 fee,
            uint256 deadline,
            bytes32 trxnType
        ) = abi.decode(_data, (address, address, uint256, uint256, uint256, uint256, uint256, bytes32));

        _validate(trxnType, receiver, amount, sharePrice, sAmount, deadline);

        if (token == address(0) || !Common.isContract(token)) {
            revert WrongAddressEncoding();
        }
        return OrderPayload(token, receiver, amount, sharePrice, sAmount, fee, deadline, trxnType);
    }
}