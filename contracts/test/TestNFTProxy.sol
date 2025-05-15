// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import { TacProxyV1 } from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1.sol";
import { OutMessageV1, TacHeaderV1, TokenAmount, NFTAmount } from "@tonappchain/evm-ccl/contracts/core/Structs.sol";


contract TestNFTProxy is TacProxyV1, IERC721Receiver {

    constructor(address crossChainLayer) TacProxyV1(crossChainLayer) {}

    /**
     * @dev Whenever an {IERC721} `tokenId` token is transferred to this contract via {IERC721-safeTransferFrom}
     * by `operator` from `from`, this function is called.
     *
     * It must return its Solidity selector to confirm the token transfer.
     * If any other value is returned or the interface is not implemented by the recipient, the transfer will be
     * reverted.
     *
     * The selector can be obtained in Solidity with `IERC721Receiver.onERC721Received.selector`.
     * @param {operator}
     * @param {from}
     * @param {tokenId}
     * @param {data}
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override(IERC721Receiver) returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function receiveNFT(bytes calldata tacHeader, bytes calldata arguments) external {
        NFTAmount[] memory nfts = abi.decode(arguments, (NFTAmount[]));

        for (uint i; i < nfts.length; i++) {
            IERC721(nfts[i].evmAddress).approve(_getCrossChainLayerAddress(), nfts[i].tokenId);
        }

        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        // bridge nft back
        OutMessageV1 memory outMessage = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller, // Original TON user
            tvmPayload: "",
            tvmProtocolFee: 0,
            tvmExecutorFee: 0,
            tvmValidExecutors: new string[](0),
            toBridge: new TokenAmount[](0), // no ERC-20 bridging in this example
            toBridgeNFT: nfts         // bridging these NFTs back to TON
        });
        _sendMessageV1(outMessage, 0);
    }
}