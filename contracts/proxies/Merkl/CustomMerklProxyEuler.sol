// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ICustomMerkl} from "./interface/ICustomMerkl.sol";
import {TransferHelper} from "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TacSmartAccount} from "../../TacSmartAccounts/TacSmartAccount.sol";
import {IREUL} from "./interface/IREUL.sol";

contract CustomMerklProxyEuler is ICustomMerkl, OwnableUpgradeable, UUPSUpgradeable {


    address public EUL;
    address public rEUL;
    address public mainMerklProxy;

    struct WithdrawToByLockTimestampData {
        address account;
        uint256 lockTimestamp;
        bool allowReminderLoss;
    }

    struct WithdrawToByLockTimestampsData {
        address account;
        uint256[] lockTimestamps;
        bool allowReminderLoss;
    }

    event ClaimREUL(address indexed user, address indexed token, uint256 amount);

    modifier onlyMainMerklProxy() {
        require(msg.sender == mainMerklProxy, "Only main merkl proxy can call this function");
        _;
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _EUL,
        address _rEUL,
        address _mainMerklProxy
    ) external initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        EUL = _EUL;
        rEUL = _rEUL;
        mainMerklProxy = _mainMerklProxy;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function claim(
        address user,
        address token,
        bytes calldata
    ) external onlyMainMerklProxy returns (address tokenToBridge) {
       emit ClaimREUL(user, token, IERC20(token).balanceOf(user));
       return address(0);
    }

    function withdrawToByLockTimestamp(address user, bytes calldata data) external onlyMainMerklProxy{
        WithdrawToByLockTimestampData memory withdrawToByLockTimestampData = abi.decode(data, (WithdrawToByLockTimestampData));
        bytes memory result = TacSmartAccount(payable(user)).execute(
            rEUL,
            0,
            abi.encodeWithSelector(IREUL.withdrawToByLockTimestamp.selector, mainMerklProxy, withdrawToByLockTimestampData.lockTimestamp, withdrawToByLockTimestampData.allowReminderLoss)
        );
        bool success = abi.decode(result, (bool));
        require(success, "Withdrawal failed");
    }

    function withdrawToByLockTimestamps(address user, bytes calldata data) external onlyMainMerklProxy{
        WithdrawToByLockTimestampsData memory withdrawToByLockTimestampsData = abi.decode(data, (WithdrawToByLockTimestampsData));
        bytes memory result = TacSmartAccount(payable(user)).execute(
            rEUL,
            0,
            abi.encodeWithSelector(IREUL.withdrawToByLockTimestamps.selector, mainMerklProxy, withdrawToByLockTimestampsData.lockTimestamps, withdrawToByLockTimestampsData.allowReminderLoss)
        );
        bool success = abi.decode(result, (bool));
        require(success, "Withdrawal failed");
    }
        
}