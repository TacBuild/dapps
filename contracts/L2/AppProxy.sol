// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ISettings } from "tac-l2-ccl/contracts/interfaces/ISettings.sol";
import { ICrossChainLayer } from "tac-l2-ccl/contracts/interfaces/ICrossChainLayer.sol";
import { OutMessageV1 } from "tac-l2-ccl/contracts/L2/Structs.sol";
import { TacProxyV1 } from "tac-l2-ccl/contracts/proxies/TacProxyV1.sol";


/**
 * @title AppProxy
 * @dev A base contract for application proxies.
 */
abstract contract AppProxy is TacProxyV1 {
    // State variables
    address internal immutable _appAddress;

    /**
     * @dev Constructor function to initialize the contract with initial state.
     * @param appAddress Application address.
     * @param crossChainLayer Cross chain layer address.
     */
    constructor(address appAddress, address crossChainLayer) TacProxyV1(crossChainLayer) {
        _appAddress = appAddress;
    }

    // View methods

    /**
     * @dev Returns dApp address.
     * @return address dApp address.
     */
    function getAppAddress() external view returns (address) {
        return _appAddress;
    }
}
