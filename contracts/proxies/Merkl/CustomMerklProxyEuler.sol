// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ICustomMerkl} from "./interface/ICustomMerkl.sol";
import {TransferHelper} from "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TacSmartAccount} from "../../TacSmartAccounts/TacSmartAccount.sol";
import {TacSAFactory} from "../../TacSmartAccounts/TacSAFactory.sol";
import {IMerkl} from "./interface/IMerkl.sol";
import {SaHelper} from "../../TacSmartAccounts/SaHelper.sol";
import {IHooks} from "../../TacSmartAccounts/Interface/IHooks.sol";
import {IREUL} from "./interface/IREUL.sol";
contract CustomMerklProxyEuler is ICustomMerkl, OwnableUpgradeable, UUPSUpgradeable {

    struct ClaimData {
        address tokenWrapper;
    }

    struct WithdrawToData {
        uint256 amount;
        address target;
        address proxy;
    }

    struct WithdrawToByLockTimestampData {
        uint256 amount;
        address target;
        address proxy;
        uint256 lockTimestamp;
    }

    struct WithdrawToByLockTimestampsData {
        uint256 amount;
        address target;
        address proxy;
        uint256[] lockTimestamps;
    }

    function initialize(
    ) external initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function claim(
        address user,
        address token,
        bytes calldata data
    ) external returns (address tokenToBridge) {
        ClaimData memory claimData = abi.decode(data, (ClaimData));
        //!TODO Ensure that depositFor is not automaticly done
        TacSmartAccount(payable(user)).execute(
            address(token),
            0,
            abi.encodeWithSelector(IREUL.depositFor.selector, user, IERC20(token).balanceOf(user))
        );

        TacSmartAccount(payable(user)).execute(
            claimData.tokenWrapper,
            0,
            abi.encodeWithSelector(IERC20.transfer.selector, address(this), IERC20(token).balanceOf(user))
        );

        return claimData.tokenWrapper;
    }

    function withdrawTo(bytes calldata data) external{
        WithdrawToData memory withdrawToData = abi.decode(data, (WithdrawToData));
        bool success = IREUL(withdrawToData.target).withdrawTo(address(this), withdrawToData.amount);
        require(success, "Withdrawal failed");
        address underlying = IREUL(withdrawToData.target).underlying();
        TransferHelper.safeTransfer(underlying, withdrawToData.proxy, IERC20(underlying).balanceOf(address(this)));
    }
    function withdrawToByLockTimestamp(bytes calldata data) external{
        WithdrawToByLockTimestampData memory withdrawToByLockTimestampData = abi.decode(data, (WithdrawToByLockTimestampData));
        bool success = IREUL(withdrawToByLockTimestampData.target).withdrawToByLockTimestamp(address(this), withdrawToByLockTimestampData.amount, withdrawToByLockTimestampData.lockTimestamp);
        require(success, "Withdrawal failed");
        address underlying = IREUL(withdrawToByLockTimestampData.target).underlying();
        TransferHelper.safeTransfer(underlying, withdrawToByLockTimestampData.proxy, IERC20(underlying).balanceOf(address(this)));
    }
    function withdrawToByLockTimestamps(bytes calldata data) external{
        WithdrawToByLockTimestampsData memory withdrawToByLockTimestampsData = abi.decode(data, (WithdrawToByLockTimestampsData));
        bool success = IREUL(withdrawToByLockTimestampsData.target).withdrawToByLockTimestamps(address(this), withdrawToByLockTimestampsData.lockTimestamps, withdrawToByLockTimestampsData.amount);
        require(success, "Withdrawal failed");
        address underlying = IREUL(withdrawToByLockTimestampsData.target).underlying();
        TransferHelper.safeTransfer(underlying, withdrawToByLockTimestampsData.proxy, IERC20(underlying).balanceOf(address(this)));
    }
        
}