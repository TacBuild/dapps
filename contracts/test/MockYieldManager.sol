// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Codec, OrderPayload} from "../proxies/Yield/Codec.sol";
import  "../proxies/Yield/Constants.sol";
import  "../proxies/Yield/Common.sol";
import  {ITestToken} from "../test/TestToken.sol";
import  {IReceipt} from "../proxies/Yield/IReceipt.sol";

contract ManagerMock {
    address public sToken;
    address public yToken;
    address public withdrawReceipt;
    bool public isVault;
    mapping(address => bool) public assets;
    mapping(bytes32 => bool) public usedProofs;

    event Deposit(address indexed caller, address indexed asset, uint256 amount, address indexed receiver, uint256 yAmount);
    event Withdraw(address indexed caller, address indexed asset, uint256 amount, address indexed receiver);

    function setTokens(address _sToken, address _yToken, bool _isVault) external {
        sToken = _sToken;
        yToken = _yToken;
        isVault = _isVault;
    }

    function setAsset(address asset, bool status) external {
        assets[asset] = status;
    }

    function setReceipt(address _withdrawReceipt) external {
        withdrawReceipt = _withdrawReceipt;
    }

    function _validate(bytes calldata, bytes memory) internal pure {
    }

    function deposit(bytes calldata _data, bytes memory _sign) external {
        _validate(_data, _sign);
        OrderPayload memory payload = Codec.decodeOrderPayload(_data);
        require(assets[payload.token] && Common.isContract(sToken) , "!token");
        require(payload.trxnType == Constants.DEPOSIT || payload.trxnType == Constants.DEPOSIT_L2, "!trxnType");
        IERC20(payload.token).transferFrom(msg.sender, sToken, payload.amount);
        ITestToken(yToken).mint(address(this), 42);
        // эмулируем перевод yToken (shares) на receiver
        IERC20(yToken).transfer(payload.receiver, 42);
    }

    // Мок withdraw - эмулирует событие и базовую логику
    function withdraw(bytes calldata _data, bytes memory _sign) external {
        _validate(_data, _sign);

        OrderPayload memory payload = Codec.decodeOrderPayload(_data);
        require(assets[payload.token] && Common.isContract(sToken) , "!token");
        require(payload.trxnType == Constants.WITHDRAW || payload.trxnType == Constants.WITHDRAW_L2, "!trxnType");

        
        ITestToken(yToken).burn(msg.sender, payload.amount);

        IReceipt(withdrawReceipt).mint(payload.receiver, payload.token, 42, 8);
        
    }
}
