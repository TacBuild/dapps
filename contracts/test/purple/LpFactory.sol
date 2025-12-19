// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { LpToken } from "./LpToken.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
/**
 * @notice Not for production use. Only for testing purposes and internal use.
 */
contract LpFactory {

    UpgradeableBeacon public beacon;
    address public purpleDapp;
    address public constant NATIVE_TOKEN = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    mapping(address baseToken => address lpToken) public lpTokens;

    error LpTokenNotExists(address baseToken);

    constructor(address _purpleDapp, address _initBlueprint) {
        purpleDapp = _purpleDapp;
        beacon = new UpgradeableBeacon(_initBlueprint, address(this));
    }

    function createOrGetLpToken(string memory name, address baseToken) external returns (address) {
        require(msg.sender == purpleDapp, "Only purpleDapp can create LP token");
        if (lpTokens[baseToken] != address(0)) {
            return lpTokens[baseToken];
        }
        uint8 decimals;
        if(baseToken == NATIVE_TOKEN) {
            decimals = 18;
        } else {
            decimals = ERC20(baseToken).decimals();
        }
        bytes32 salt = keccak256(abi.encode(baseToken));
        BeaconProxy proxy = new BeaconProxy{salt: salt}(
            address(beacon),
            abi.encodeWithSelector(
                LpToken.initialize.selector,
                name,
                decimals
            )
        );
        lpTokens[baseToken] = address(proxy);
        return address(proxy);
    }

    function mintTo(address baseToken, address to, uint256 amount) external {
        require(msg.sender == purpleDapp, "Only purpleDapp can mint to LP token");
        if (lpTokens[baseToken] == address(0)) {
            revert LpTokenNotExists(baseToken);
        }
        LpToken(lpTokens[baseToken]).mint(to, amount);
    }

    function burnFrom(address baseToken, address from, uint256 amount) external {
        require(msg.sender == purpleDapp, "Only purpleDapp can burn from LP token");
        if (lpTokens[baseToken] == address(0)) {
            revert LpTokenNotExists(baseToken);
        }
        LpToken(lpTokens[baseToken]).burn(from, amount);
    }

    function getLpTokenAddress(address baseToken, string memory name) external view returns (address) {
        if (lpTokens[baseToken] == address(0)) {
            uint8 decimals;
            if(baseToken == NATIVE_TOKEN) {
                decimals = 18;
            } else {
                decimals = ERC20(baseToken).decimals();
            }
            bytes memory bytecode = abi.encodePacked(
            type(BeaconProxy).creationCode,
            abi.encode(
                address(beacon),
                abi.encodeWithSelector(
                    LpToken.initialize.selector,
                    name,
                    decimals
                )
            )
        );
        
        bytes32 salt = keccak256(abi.encode(baseToken));
        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            salt,
            keccak256(bytecode)
        )))));
        } else {
            return lpTokens[baseToken];
        }
    }
}