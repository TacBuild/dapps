// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IWTAC {
    function deposit(uint256 amount) payable external;
    function withdraw(uint256 amount) external;
}