// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import { TacProxyV1 } from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1.sol";
import { OutMessageV2, TacHeaderV1, TokenAmount, NFTTokenAmount } from "@tonappchain/evm-ccl/contracts/L2/Structs.sol";


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
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function receiveNFT(bytes calldata tacHeader, bytes calldata arguments) external {
        NFTTokenAmount[] memory nftTokens = abi.decode(arguments, (NFTTokenAmount[]));

        for (uint i; i < nftTokens.length; i++) {
            IERC721(nftTokens[i].l2Address).approve(_getCrossChainLayerAddress(), nftTokens[i].tokenId);
        }

        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        // bridge nft back
        OutMessageV2 memory outMessage = OutMessageV2(
            header.shardsKey,
            header.tvmCaller,
            "",
            new TokenAmount[](0),
            nftTokens // nft tokens to Bridge
        );
        _sendMessageV2(outMessage, 0);
    }
}