// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TreasurySwap is Ownable {

    using SafeERC20 for IERC20;

    address public token;
    address public wTON;
    uint256 public tokenValue;
    uint256 public upperBound;
    uint256 public lowerBound;
    uint8 _decimals;

    constructor(
        address _token,
        address _wTON,
        uint256 _tokenValue,
        uint8 _setDecimals,
        uint256 _upperBound,
        uint256 _lowerBound
    ) Ownable(msg.sender) {
        token = _token;
        wTON = _wTON;
        tokenValue = _tokenValue;
        _decimals = _setDecimals;
        upperBound = _upperBound;
        lowerBound = _lowerBound;
    }

    function decimals() public view returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 wTONamt) public returns (uint256) {
        require(wTONamt > 0, "TreasurySwap: You need to send some wTON");

        uint256 amount = (wTONamt * tokenValue) / (10 ** 9);
        require(amount > lowerBound, "TreasurySwap: Requested balance too low");
        require(amount < upperBound, "TreasurySwap: Requested balance too high");

        uint256 allowance = IERC20(wTON).allowance(msg.sender, address(this));
        require(allowance >= wTONamt, "TreasurySwap: Check the wTON allowance");

        IERC20(wTON).safeTransferFrom(msg.sender, address(this), wTONamt);

        uint256 faucetBalance = IERC20(token).balanceOf(address(this));
        require(amount <= faucetBalance, "TreasurySwap: Not enough tokens in the treasury");

        IERC20(token).safeTransfer(to, amount);

        return amount;
    }

    function burn(address to, uint256 amount) public returns (uint256) {
        require(amount > 0, "TreasurySwap: You need to sell at least some tokens");
        require(amount < upperBound, "TreasurySwap: You are requesting to sell too much tokens");

        uint256 allowance = IERC20(token).allowance(to, address(this));
        require(allowance >= amount, "TreasurySwap: Check the token allowance");

        uint256 availableBalance = addressBalance(to);
        require(amount <= availableBalance, "TreasurySwap: Requested burn amount greater than current balance");

        IERC20(token).safeTransferFrom(to, address(this), amount);

        uint256 refundAmount = amount * 10 ** 9 / tokenValue;

        IERC20(wTON).safeTransfer(to, refundAmount);

        return refundAmount;
    }

    function adminWithdraw(uint256 amount) public onlyOwner {
        IERC20(token).safeTransfer(msg.sender, amount);
    }

    function adminWithdrawETH(uint256 amount) public onlyOwner {
        (bool success,) = _msgSender().call{value: amount}(new bytes(0));
        require(success, "TreasurySwap: ETH Admin Withdraw failed");
    }

    function adminWithdrawTON(uint256 amount) public onlyOwner {
        IERC20(wTON).safeTransfer(msg.sender, amount);
    }

    function treasuryERCBalance() public view returns (uint256) {
        uint256 balance = IERC20(token).balanceOf(address(this));
        return balance;
    }

    function treasurywTONBalance() public view returns (uint256) {
        uint256 balance = IERC20(wTON).balanceOf(address(this));
        return balance;
    }

    function addressBalance(address addr) public view returns (uint256) {
        uint256 balance = IERC20(token).balanceOf(address(addr));
        return balance;
    }
}
