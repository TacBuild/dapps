// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { ICrossChainLayer } from "@tonappchain/evm-ccl/contracts/interfaces/ICrossChainLayer.sol";
import { TacProxyV1 } from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1.sol";
import { OutMessageV1, TacHeaderV1, TokenAmount, NFTAmount } from "@tonappchain/evm-ccl/contracts/core/Structs.sol";

contract TestProxy is TacProxyV1 {

    event InvokeWithCallback(uint64 shardsKey, uint256 timestamp, bytes32 operationId, string tvmCaller, bytes extraData, TokenAmount[] receivedTokens);

    constructor(address crossChainLayer) TacProxyV1(crossChainLayer) {}

    function invokeWithCallback(bytes calldata tacHeader, bytes calldata arguments) external {
        // decode header
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        // decode arguments
        TokenAmount[] memory receivedTokens = abi.decode(arguments, (TokenAmount[]));

        emit InvokeWithCallback(header.shardsKey, header.timestamp, header.operationId, header.tvmCaller, header.extraData, receivedTokens);

        // approve to bridge
        for (uint i = 0; i < receivedTokens.length; i++) {
            IERC20(receivedTokens[i].evmAddress).approve(_getCrossChainLayerAddress(), receivedTokens[i].amount);
        }

        // bridge received tokens back to TON
        _sendMessageV1(
            OutMessageV1(
                header.shardsKey,
                header.tvmCaller,
                "",
                0,
                0,
                new string[](0),
                receivedTokens,
                new NFTAmount[](0)
            ),
            0
        );
    }
}
