// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract LiquidTacToken is ERC20, AccessControl {
    bytes32 public constant LIQUID_STAKING = keccak256("LIQUID_STAKING");

    constructor(address defaultAdmin) ERC20("gTAC", "gTAC") {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    function mint(address to, uint256 amount) public onlyRole(LIQUID_STAKING) {
        _mint(to, amount);
    }

    function burnFrom(address from, uint256 amount) external onlyRole(LIQUID_STAKING) {
        _burn(from, amount);
    }
}
