// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.2 <0.9.0;

import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {TacSmartAccount} from "./TacSmartAccount.sol";

contract TacSAFactory is OwnableUpgradeable, UUPSUpgradeable {
    UpgradeableBeacon public beacon;
    mapping(address application => mapping(bytes32 id => address smartAccount)) public smartAccounts;

    event SmartAccountCreated(address indexed accountAddress);

    function initialize(
        address _initBlueprint
    ) external initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        beacon = new UpgradeableBeacon(_initBlueprint, address(this));
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyOwner
    {}

    function getOrCreateSmartAccount(
        string memory tvmWallet
    ) external returns (address, bool isNewAccount) {
        bytes32 id = keccak256(abi.encodePacked(tvmWallet));
        if (smartAccounts[msg.sender][id] != address(0)) {
            return (smartAccounts[msg.sender][id], false);
        }
        address account = _createSmartAccount();
        smartAccounts[msg.sender][id] = account;
        return (account, true);
    }

    function getSmartAccountForApplication(
        string memory tvmWallet,
        address application
    ) external view returns (address) {
        bytes32 id = keccak256(abi.encodePacked(tvmWallet));
        return smartAccounts[application][id];
    }

    function _createSmartAccount() internal returns (address) {
        BeaconProxy proxy = new BeaconProxy(
            address(beacon),
            abi.encodeWithSelector(
                TacSmartAccount.initialize.selector,
                msg.sender
            )
        );
        emit SmartAccountCreated(address(proxy));
        return address(proxy);
    }


    function updateBlueprint(address _newBlueprint) external onlyOwner {
        beacon.upgradeTo(_newBlueprint);
    }
}