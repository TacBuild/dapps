// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { LpFactory } from "./LpFactory.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @notice Not for production use. Only for testing purposes and internal use.
 */
contract PurpleDapp is Ownable {
    using SafeERC20 for IERC20;

    LpFactory public lpFactory;
    address public constant NATIVE_TOKEN = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    constructor() Ownable(msg.sender) {}

    function addLiquidity(address token, uint256 amount, string memory tvmAddress) public payable {
        if (token == NATIVE_TOKEN) {
            require(msg.value == amount, "Amount must be equal to the native token amount");
        } else {
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }
        address lpToken = lpFactory.createOrGetLpToken(tvmAddress, token);
        require(lpToken != address(0), "LP token not created");
        lpFactory.mintTo(token, msg.sender, amount);
    }

    function removeLiquidity(address token, uint256 amount, string memory tvmAddress) public {
        address lpToken = lpFactory.createOrGetLpToken(tvmAddress, token);
        require(lpToken != address(0), "LP token not created");
        lpFactory.burnFrom(token, msg.sender, amount);
        if (token == NATIVE_TOKEN) {
            (bool success,) = msg.sender.call{value: amount}("");
            require(success, "Transfer failed");
        } else {
            IERC20(token).safeTransfer(msg.sender, amount);
        }
    }

    function setLpFactory(address _lpFactory) public onlyOwner {
        lpFactory = LpFactory(_lpFactory);
    }

    function getLpTokenAddress(address baseToken, string memory name) public view returns (address) {
        return lpFactory.getLpTokenAddress(baseToken, name);
    }
}