// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IMorpho} from "./IMorpho.sol";

type Id is bytes32;

interface IMorphoVault {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function mint(uint256 shares, address receiver) external returns (uint256 assets);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
    function previewMint(uint256 share) external view returns (uint256 assets);
    function previewWithdraw(uint256 assets) external view returns (uint256 shares);
    function asset() external view returns (address);
    function balanceOf(address account) external view returns (uint256);
    function setCurator(address newCurator) external;
    function curator() external view returns (address);
    function setFeeRecipient(address newFeeRecipient) external;
    function submitCap(IMorpho.MarketParams memory marketParams, uint256 newSupplyCap) external;
    function setSupplyQueue(Id[] calldata newSupplyQueue) external;
    function setIsAllocator(address newAllocator, bool newIsAllocator) external;
    function acceptCap(IMorpho.MarketParams memory marketParams) external;
}
