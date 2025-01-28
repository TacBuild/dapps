pragma solidity ^0.8.0;

import { TacProxyV1 } from "tac-l2-ccl/contracts/proxies/TacProxyV1.sol";

contract SimpleStorage is TacProxyV1 {
    uint256 private storedData;

    // Function to set a value
    function set(bytes calldata, bytes calldata arguments) public {
        uint256 value = abi.decode(arguments, (uint256));
        storedData = value;
    }

    // Function to retrieve the stored value
    function get() public view returns (uint256) {
        return storedData;
    }
}
