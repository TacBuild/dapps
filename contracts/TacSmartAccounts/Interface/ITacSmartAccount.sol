// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TokenAmount, NFTAmount} from "@tonappchain/evm-ccl/contracts/L2/Structs.sol";
interface ITacSmartAccount {
    function execute(address target, uint256 value, bytes calldata data) external;
    function bridgeTokens(bytes calldata tacHeader, TokenAmount[] memory tokens, NFTAmount[] memory nfts, string memory payload, address crossChainLayer) external;
}
