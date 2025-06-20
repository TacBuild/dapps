// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ICustomMerkl {
    function claim(
        address users,
        address tokens,
        bytes calldata data
    ) external returns (address tokenToBridge);


}