// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IMetaMorphoV2Factory {
    function isVaultV2(address vault) external view returns (bool);
}
