// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { ICrossChainLayer } from "tac-l2-ccl/contracts/interfaces/ICrossChainLayer.sol";
import { TacProxyV1 } from "tac-l2-ccl/contracts/proxies/TacProxyV1.sol";
import { OutMessageV1, TacHeaderV1, TokenAmount } from "tac-l2-ccl/contracts/L2/Structs.sol";

contract TestProxy is TacProxyV1 {

    event InvokeWithCallback(uint64 shardedId, uint256 timestamp, bytes32 operationId, string tvmCaller, bytes extraData, TokenAmount[] receivedTokens);

    constructor(address crossChainLayer) TacProxyV1(crossChainLayer) {}

    function invokeWithCallback(bytes calldata tacHeader, bytes calldata arguments) external {
        // decode header
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        // decode arguments
        TokenAmount[] memory receivedTokens = abi.decode(arguments, (TokenAmount[]));

        emit InvokeWithCallback(header.shardedId, header.timestamp, header.operationId, header.tvmCaller, header.extraData, receivedTokens);

        // approve to bridge
        for (uint i = 0; i < receivedTokens.length; i++) {
            IERC20(receivedTokens[i].l2Address).approve(_getCrossChainLayerAddress(), receivedTokens[i].amount);
        }

        // bridge received tokens back to TON
        _sendMessageV1(
            OutMessageV1(
                header.shardedId,
                header.tvmCaller,
                "",
                receivedTokens
            ),
            0
        );
    }
}
