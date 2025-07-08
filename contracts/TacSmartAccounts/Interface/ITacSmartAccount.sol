// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TokenAmount, NFTAmount} from "@tonappchain/evm-ccl/contracts/core/Structs.sol";
interface ITacSmartAccount {
    function execute(address target, uint256 value, bytes calldata data) external payable returns(bytes memory);
    function executeUnsafe(address target, uint256 value, bytes calldata data) external payable returns(bool success, bytes memory returnData);
    function delegatecall(address target, bytes calldata data) external returns(bool success, bytes memory returnData);
    function createOneTimeTicket(address caller) external;
    function revokeOneTimeTicket(address caller) external;
    function multicall(address[] calldata targets, uint256[] calldata values, bytes[] calldata data) external payable returns(bytes[] memory);
    function approve(address token, address to, uint256 amount) external;
}
