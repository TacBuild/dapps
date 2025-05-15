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
        address account = _createSmartAccount(tvmWallet, msg.sender);
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

    function predictSmartAccountAddress(
        string memory tvmWallet,
        address application
    ) external view returns (address) {
        bytes32 id = keccak256(abi.encodePacked(tvmWallet));
        if (smartAccounts[application][id] != address(0)) {
            return smartAccounts[application][id];
        }
        
        // Predict the address using the same logic as _createSmartAccount
        bytes memory bytecode = abi.encodePacked(
            type(BeaconProxy).creationCode,
            abi.encode(
                address(beacon),
                abi.encodeWithSelector(
                    TacSmartAccount.initialize.selector,
                    application
                )
            )
        );
        
        bytes32 salt = keccak256(abi.encodePacked(application, id));
        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            salt,
            keccak256(bytecode)
        )))));
    }

    function _createSmartAccount(string memory tvmWallet, address application) internal returns (address) {
        bytes32 id = keccak256(abi.encodePacked(tvmWallet));
        bytes32 salt = keccak256(abi.encodePacked(application, id));
        BeaconProxy proxy = new BeaconProxy{salt: salt}(
            address(beacon),
            abi.encodeWithSelector(
                TacSmartAccount.initialize.selector,
                application
            )
        );
        emit SmartAccountCreated(address(proxy));
        return address(proxy);
    }


    function updateBlueprint(address _newBlueprint) external onlyOwner {
        beacon.upgradeTo(_newBlueprint);
    }
}