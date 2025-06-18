// SPDX-License-Identifier: GPL-2.0
pragma solidity ^0.8.20;

interface ISToken {
    event TransferToMPC(address indexed token, address indexed mpc, uint256 transferAmount);
    event WithdrawRequest(address indexed caller, address indexed receiver, address indexed owner, uint256 sAmount, uint256 amount);
    event Claim(address indexed caller, address indexed receiver, uint256 amount);
    event Mint(address indexed sender, address indexed account, uint256 value);
    event Burn(address indexed sender, address indexed account, uint256 value);

    function init(address _administrator) external;

    function setCoolingPeriod(uint256 period) external;

    function setWithdrawReceipt(address _withdrawReceipt) external;

    function mint(address account, uint256 value) external;

    function burn(address account, uint256 value) external;

    function transferToMPCs(address token, uint256 amount, address[] calldata mpc, uint256[] calldata ratios) external;

    function withdrawRequest(address asset, uint256 sAmount, address receiver, address owner) external;

    function claim(uint256 receiptId, address receiver) external;
}
