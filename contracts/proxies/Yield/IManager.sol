// SPDX-License-Identifier: GPL-2.0
pragma solidity ^0.8.20;

interface IManager {

    function deposit(address _yToken, address _asset, uint256 _amount, address _receiver, address _callback, bytes calldata _callbackData, bytes32 _referralCode) external;

    function redeem(address caller, address _yToken, address _asset, uint256 _shares, address _receiver, address _callback, bytes calldata _callbackData) external;

}
