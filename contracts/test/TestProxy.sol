// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { ICrossChainLayer } from "tac-l2-ccl/contracts/interfaces/ICrossChainLayer.sol";
import { TacProxyV1 } from "tac-l2-ccl/contracts/proxies/TacProxyV1.sol";
import { OutMessage, TacHeaderV1, TokenAmount } from "tac-l2-ccl/contracts/L2/Structs.sol";

contract TestProxy is TacProxyV1 {
    uint cnt;

    ICrossChainLayer crossChainLayer;
    IERC20 token;

    event Receive(uint256 value);
    event Invoke(uint256 value, uint64 queryId, uint256 timestamp, bytes32 operationId, string tvmCaller, bytes extraData);
    event InvokeWithCallback(uint64 queryId, uint256 timestamp, bytes32 operationId, string tvmCaller, bytes extraData, TokenAmount[] receivedTokens);

    error MockError(string message);

    constructor(ICrossChainLayer _crossChainLayer, IERC20 _token) {
        crossChainLayer = _crossChainLayer;
        token = _token;
    }

    receive() external payable {
        emit Receive(msg.value);
    }

    function invoke(bytes calldata tacHeader, bytes calldata arguments) external {
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        uint256 a = abi.decode(arguments, (uint256));
        cnt += a;
        emit Invoke(a, header.queryId, header.timestamp, header.operationId, header.tvmCaller, header.extraData);
    }

    function invokeWithCallback(bytes calldata tacHeader, bytes calldata arguments) external {
        // decode header
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        // decode arguments
        TokenAmount[] memory receivedTokens = abi.decode(arguments, (TokenAmount[]));

        emit InvokeWithCallback(header.queryId, header.timestamp, header.operationId, header.tvmCaller, header.extraData, receivedTokens);

        // approve to bridge
        for (uint i = 0; i < receivedTokens.length; i++) {
            IERC20(receivedTokens[i].l2Address).approve(address(crossChainLayer), receivedTokens[i].amount);
        }

        // bridge received tokens back to TON
        crossChainLayer.sendMessage(
            OutMessage(
                header.queryId,
                header.tvmCaller,
                "",
                receivedTokens
            )
        );
    }

    function sendMultiplyCallbackToCrossChainLayer(bytes calldata header, bytes calldata arguments) external {
        TacHeaderV1 memory tacHeader = _decodeTacHeader(header);
        TokenAmount[] memory tokens = abi.decode(arguments, (TokenAmount[]));

        uint i;
        // send out message for each received token
        for (; i < tokens.length;) {
            TokenAmount memory receivedToken = tokens[i];
            IERC20(receivedToken.l2Address).approve(address(crossChainLayer), receivedToken.amount);
            TokenAmount[] memory toBridge = new TokenAmount[](1);
            toBridge[0] = receivedToken;
            OutMessage memory outMessage = OutMessage(tacHeader.queryId, tacHeader.tvmCaller, "", toBridge);
            crossChainLayer.sendMessage(outMessage);
            unchecked {
                i++;
            }
        }

    }

    function mockWithError(bytes calldata, bytes calldata arguments) external {
        string memory message = abi.decode(arguments, (string));
        cnt = 0;
        revert MockError(message);
    }

    function getValue() public view returns (uint) {
        return cnt;
    }
}
