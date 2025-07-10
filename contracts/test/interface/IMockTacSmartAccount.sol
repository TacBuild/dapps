// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TokenAmount, NFTAmount} from "@tonappchain/evm-ccl/contracts/core/Structs.sol";
interface IMockTacSmartAccount {
    function upgradedToMockBluePrint() external pure returns(bool);
}
