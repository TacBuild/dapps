// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TransferHelper} from "@uniswap/lib/contracts/libraries/TransferHelper.sol";

import {OutMessageV1, TokenAmount, TacHeaderV1, NFTAmount} from "@tonappchain/evm-ccl/contracts/core/Structs.sol";
import {ICrossChainLayer} from "@tonappchain/evm-ccl/contracts/interfaces/ICrossChainLayer.sol";


contract TacSmartAccount is Initializable {
    address public owner;
    uint256 private constant TAC_OUT_MESSAGE_VERSION_1 = 1;

    event Executed(address indexed target, uint256 value, bytes data);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }

    function initialize(address _owner) public initializer {
        owner = _owner;
    }

    function execute(address target, uint256 value, bytes calldata data) external onlyOwner {
        (bool success,) = target.call{value: value}(data);
        require(success, "Execution failed");
        emit Executed(target, value, data);
    }

    /// @notice Bridges tokens to the cross-chain layer
    /// @param tacHeader TAC header data
    /// @param tokens Array of token amounts to bridge
    /// @param payload Additional payload data
    function bridgeTokens(
        bytes calldata tacHeader,
        TokenAmount[] memory tokens,
        NFTAmount[] memory nfts,
        string memory payload,
        address crossChainLayer
    ) external onlyOwner {
        for (uint256 i = 0; i < tokens.length; i++) {
            TransferHelper.safeApprove(
                tokens[i].evmAddress,
                crossChainLayer,
                tokens[i].amount
            );
        }

        for (uint256 i = 0; i < nfts.length; i++) {
            TransferHelper.safeApprove(
                nfts[i].evmAddress,
                crossChainLayer,
                nfts[i].amount
            );
        }

        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: payload,
            tvmProtocolFee: 0,
            tvmExecutorFee: 0,
            tvmValidExecutors: new string[](0),
            toBridge: tokens,
            toBridgeNFT: nfts
        });

        _sendMessageV1(message, address(this).balance, crossChainLayer);
    }

    function _decodeTacHeader(bytes calldata tacHeader) internal pure returns (TacHeaderV1 memory) {
        return abi.decode(tacHeader, (TacHeaderV1));
    }

    function _sendMessageV1(OutMessageV1 memory outMessage, uint256 tacAmount, address crossChainLayer) internal {
        ICrossChainLayer(crossChainLayer).sendMessage{value: tacAmount}(TAC_OUT_MESSAGE_VERSION_1, abi.encode(outMessage));
    }

    receive() external payable {}
}