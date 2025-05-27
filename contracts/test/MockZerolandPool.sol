// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;
import "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { console } from "hardhat/console.sol";


contract MockPool is Ownable {
    address public token;
    uint256 public tokenValue;

    mapping(address => mapping(address => uint256)) public userSupplies;
    mapping(address => mapping(address => uint256)) public userBorrows;

    constructor(
        address _token,
        uint256 _tokenValue
    ) Ownable(msg.sender) {
        token = _token;
        tokenValue = _tokenValue;
    }

    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) public {
        require(amount > 0, "MockPool: You need to send some wTON");
        require(referralCode == 0, "MockPool: Referral code not supported");

        uint256 creditAmount = (amount * tokenValue) / (10 ** 9);

        uint256 allowance = IERC20(asset).allowance(msg.sender, address(this));
        require(allowance >= amount, "MockPool: Check the wTON allowance");

        bool success = IERC20(asset).transferFrom(msg.sender, address(this), amount);
        require(success, "MockPool: Can't take wTON from user. Likely insufficient balance");

        uint256 faucetBalance = IERC20(token).balanceOf(address(this));
        require(creditAmount <= faucetBalance, "MockPool: Not enough tokens in the treasury");

        userSupplies[onBehalfOf][token] += creditAmount;

        IERC20(token).transfer(onBehalfOf, creditAmount);
    }

    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256) {
        uint256 allowance = IERC20(token).allowance(to, address(this));
        require(allowance >= amount, "MockPool: Check the token allowance");

        uint256 availableBalance = addressBalance(to);
        require(amount <= availableBalance, "MockPool: Requested burn amount greater than current balance");

        IERC20(token).transferFrom(to, address(this), amount);

        uint256 refundAmount = amount * 10 ** 9 / tokenValue;

        userSupplies[to][token] -= amount;

        IERC20(asset).transfer(to, refundAmount);

        return refundAmount;
    }
    

    function borrow(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        uint16 referralCode,
        address onBehalfOf
    ) external{

        require(interestRateMode == 1 || interestRateMode == 2, "MockPool: interestRateMode not supported");
        require(referralCode == 0, "MockPool: Referral code not supported");

        userBorrows[onBehalfOf][asset] += amount;
        IERC20(asset).transfer(msg.sender, amount);
    }

    function repay(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        address onBehalfOf
    ) public returns (uint256) {
        require(amount > 0, "MockPool: You need to send some wTON");
        require(amount <= userBorrows[onBehalfOf][asset], "MockPool: You can't repay more than you borrowed :)");
        require(interestRateMode == 1 || interestRateMode == 2, "MockPool: interestRateMode not supported");

        uint256 allowance = IERC20(asset).allowance(msg.sender, address(this));
        require(allowance >= amount, "MockPool: Check the wTON allowance");

        bool success = IERC20(asset).transferFrom(msg.sender, address(this), amount);
        require(success, "MockPool: Can't take wTON from user. Likely insufficient balance");
        
        userBorrows[onBehalfOf][asset] -= amount;

        return amount;
    }

    function poolERCBalance() public view returns (uint256) {
        uint256 balance = IERC20(token).balanceOf(address(this));
        return balance;
    }

    function poolTONBalance( address TONToken) public view returns (uint256) {
        uint256 balance = IERC20(TONToken).balanceOf(address(this));
        return balance;
    }

    function addressBalance(address addr) public view returns (uint256) {
        uint256 balance = IERC20(token).balanceOf(address(addr));
        return balance;
    }

    receive() external payable {}

    fallback() external payable {}
}
