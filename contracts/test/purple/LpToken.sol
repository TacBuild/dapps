// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @notice Not for production use. Only for testing purposes and internal use.
 */
contract LpToken is Initializable, ERC20Upgradeable, OwnableUpgradeable {

    uint8 private _decimals;
    
    constructor() {}

    function initialize(string memory name, uint8 _parentDec) public initializer {
        _decimals = _parentDec;
        __ERC20_init(string(abi.encodePacked("Purple-LP-", name)), string(abi.encodePacked("PPL-LP-", string(abi.encodePacked(bytes(name)[0], bytes(name)[1], bytes(name)[2], bytes(name)[3])))));
        __Ownable_init(msg.sender);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

}

