// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TransferHelper} from "@uniswap/lib/contracts/libraries/TransferHelper.sol";


contract MockBluePrint is Initializable {
    address public owner;

    event Executed(address indexed target, uint256 value, bytes data);

    mapping(address caller => bool ticket) public oneTimeTickets;

    error ExecutionFailed(address target, uint256 value, bytes data, bytes returnData);
    error AccessDenied(address caller);

    modifier onlyOwnerOrTicket() {
        if (oneTimeTickets[msg.sender]) {
            oneTimeTickets[msg.sender] = false;
        } else {
            require(msg.sender == owner, AccessDenied(msg.sender));
        }
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, AccessDenied(msg.sender));
        _;
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner) public initializer {
        owner = _owner;
    }

    function execute(address target, uint256 value, bytes calldata data) external payable onlyOwnerOrTicket returns(bytes memory) {
        (bool success, bytes memory returnData) = target.call{value: value}(data);
        require(success, ExecutionFailed(target, value, data, returnData));
        emit Executed(target, value, data);
        return returnData;
    }

    function executeUnsafe(address target, uint256 value, bytes calldata data) external payable onlyOwnerOrTicket returns(bool success, bytes memory returnData)  {
        (success, returnData) = target.call{value: value}(data);
        emit Executed(target, value, data);
    }

    function delegatecall(address target, bytes calldata data) external onlyOwner returns(bool success, bytes memory returnData) {
        (success, returnData) = target.delegatecall(data);
        require(success, ExecutionFailed(target, 0, data, returnData));
        emit Executed(target, 0, data);
    }

    function createOneTimeTicket(address caller) external onlyOwner {
        oneTimeTickets[caller] = true;
    }

    function revokeOneTimeTicket(address caller) external onlyOwner {
        oneTimeTickets[caller] = false;
    }

    function approve(address token, address to, uint256 amount) external onlyOwnerOrTicket{
        TransferHelper.safeApprove(token, to, amount);
    }

    function multicall(address[] calldata targets, uint256[] calldata values, bytes[] calldata data) external onlyOwnerOrTicket returns(bytes[] memory) {
        bytes[] memory results = new bytes[](targets.length);
        for (uint256 i = 0; i < targets.length; i++) {
            (bool success, bytes memory returnData) = targets[i].call{value: values[i]}(data[i]);
            require(success, ExecutionFailed(targets[i], values[i], data[i], returnData));
            results[i] = returnData;
        }
        return results;
    }

    function upgradedToMockBluePrint() external pure returns(bool) {
        return true;
    }

    receive() external payable {}
}