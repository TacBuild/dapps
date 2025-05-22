// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import {Codec, OrderPayload} from "../proxies/Yield/Codec.sol";
import "hardhat/console.sol";



contract MockManager {

    OrderPayload private _lastOrderPayload;


    function deposit(bytes calldata data, bytes calldata sign) external {
        OrderPayload memory payload = Codec.decodeOrderPayload(data);
        console.log("KAK");
        console.log(payload.token);
        console.log(payload.receiver);
        console.log(payload.amount);
        console.log(payload.sharePrice);
        console.log(payload.sAmount);
        console.log(payload.fee);
        console.log(payload.deadline);
        _lastOrderPayload = payload;
        console.log(_lastOrderPayload.token);
        console.log(_lastOrderPayload.receiver);
        console.log(_lastOrderPayload.amount);
        console.log(_lastOrderPayload.sharePrice);
        console.log(_lastOrderPayload.sAmount);
        console.log(_lastOrderPayload.fee);
        console.log(_lastOrderPayload.deadline);
    }

    function getLastOrderPayload() external view returns (
    address token,
    address receiver,
    uint256 amount,
    uint256 sharePrice,
    uint256 sAmount,
    uint256 fee,
    uint256 deadline,
    bytes32 trxnType
) {
    console.log(_lastOrderPayload.token);
    console.log(_lastOrderPayload.receiver);
    console.log(_lastOrderPayload.amount);
    console.log(_lastOrderPayload.sharePrice);
    console.log(_lastOrderPayload.sAmount);
    console.log(_lastOrderPayload.fee);
    console.log(_lastOrderPayload.deadline);
    OrderPayload memory p = _lastOrderPayload;
    return (
        p.token,
        p.receiver,
        p.amount,
        p.sharePrice,
        p.sAmount,
        p.fee,
        p.deadline,
        p.trxnType
    );
}


}
