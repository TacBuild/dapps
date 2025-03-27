// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TacProxyV1 } from "tac-l2-ccl/contracts/proxies/TacProxyV1.sol";
import { OutMessageV1, TokenAmount, TacHeaderV1 } from "tac-l2-ccl/contracts/L2/Structs.sol";
import { TransferHelper } from '@uniswap/lib/contracts/libraries/TransferHelper.sol';

contract AgnosticProxy is TacProxyV1 {

    struct BridgeData {
        address[] tokens;
        bool isRequired;
    }
    
    constructor(address crossChainLayer) TacProxyV1(crossChainLayer) {}

    function Zap(bytes calldata tacHeader, bytes calldata arguments) public _onlyCrossChainLayer {
        (address[] memory to, bytes[] memory encodedMission, BridgeData memory bridgeData) = abi.decode(arguments, (address[], bytes[], BridgeData));
        for (uint256 i = 0; i < to.length; i++) {
            if (encodedMission[i].length > 0) {
                callContract(encodedMission[i], to[i]);
            }
        }
        if (bridgeData.isRequired) {
            TokenAmount[] memory tokensToBridge = new TokenAmount[](bridgeData.tokens.length);
            for (uint256 i = 0; i < bridgeData.tokens.length; i++) {
                tokensToBridge[i] = TokenAmount(bridgeData.tokens[i], IERC20(bridgeData.tokens[i]).balanceOf(address(this)));
            }
            _bridgeTokens(tacHeader, tokensToBridge, "");
        }
    }

    function callContract(bytes memory data, address callTo) private {
        require(callTo != address(0), "Invalid call address");
        (bool success, ) = callTo.call(data);
        require(success, "Call failed");
    }

    function _bridgeTokens(
        bytes calldata tacHeader,
        TokenAmount[] memory tokens,
        string memory payload
    ) private {
        for (uint256 i = 0; i < tokens.length; i++) {
            TransferHelper.safeApprove(
                tokens[i].l2Address,
                _getCrossChainLayerAddress(),
                tokens[i].amount
            );
        }

        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: payload,
            toBridge: tokens
        });

        _sendMessageV1(message, address(this).balance);
    }
}
