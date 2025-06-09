// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TacSmartAccount is Initializable {
    address public owner;

    event Executed(address indexed target, uint256 value, bytes data);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner) public initializer {
        owner = _owner;
    }

    function execute(address target, uint256 value, bytes calldata data) external payable onlyOwner returns(bytes memory) {
        (bool success, bytes memory returnData) = target.call{value: value}(data);
        require(success, "Execution failed");
        emit Executed(target, value, data);
        return returnData;
    }

    function executeUnsafe(address target, uint256 value, bytes calldata data) external payable onlyOwner returns(bool success, bytes memory returnData)  {
        (success, returnData) = target.call{value: value}(data);
        emit Executed(target, value, data);
    }

    function approve(address token, address to, uint256 amount) external onlyOwner{
        IERC20(token).approve(to, amount);
    }

    receive() external payable {}
}