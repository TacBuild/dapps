// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TacProxyV1Upgradeable } from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import { OutMessageV2, TokenAmount, TacHeaderV1, NFTTokenAmount } from "@tonappchain/evm-ccl/contracts/L2/Structs.sol";
import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { TransferHelper } from '@uniswap/lib/contracts/libraries/TransferHelper.sol';
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract AgnosticProxy is TacProxyV1Upgradeable, OwnableUpgradeable, UUPSUpgradeable, IERC721Receiver {

    struct BridgeData {
        address[] tokens;
        NFTData[] nfts;
        bool isRequired;
    }

    struct NFTData {
        address nft;
        uint256 id;
        uint256 amount;
    }
    
    function initialize(
        address crossChainLayer
    ) external initializer {
        __TacProxyV1Upgradeable_init(crossChainLayer);
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyOwner
    {}

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

            NFTTokenAmount[] memory nftsToBridge = new NFTTokenAmount[](bridgeData.nfts.length);
            for (uint256 i = 0; i < bridgeData.nfts.length; i++) {
                nftsToBridge[i] = NFTTokenAmount(bridgeData.nfts[i].nft, bridgeData.nfts[i].id, bridgeData.nfts[i].amount);
            }

            _bridgeTokens(tacHeader, tokensToBridge, nftsToBridge, "");
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
        NFTTokenAmount[] memory nfts,
        string memory payload
    ) private {
        for (uint256 i = 0; i < tokens.length; i++) {
            TransferHelper.safeApprove(
                tokens[i].l2Address,
                _getCrossChainLayerAddress(),
                tokens[i].amount
            );
        }

        for (uint256 i = 0; i < nfts.length; i++) {
            IERC721(nfts[i].l2Address).approve(_getCrossChainLayerAddress(), nfts[i].tokenId);
        }
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV2 memory message = OutMessageV2({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: payload,
            toBridge: tokens,
            toBridgeNFT: nfts
        });

        _sendMessageV2(message, address(this).balance);
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override(IERC721Receiver) returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
