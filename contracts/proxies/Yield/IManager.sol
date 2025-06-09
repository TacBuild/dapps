// SPDX-License-Identifier: GPL-2.0
pragma solidity ^0.8.20;

interface IManager {
    event Deposit(address indexed caller, address indexed asset, uint256 amount, address indexed receiver, uint256 yAmount);

    function init(address _administrator) external;

    function setTokens(
        address _sToken,
        address _yToken,
        bool _isVault
    ) external;

    function setAsset(address asset, bool status) external;

    function setTreasury(address _treasury) external;

    function deposit(bytes calldata _data, bytes memory _sign) external;

    function withdraw(bytes calldata _data, bytes memory _sign) external;
}
