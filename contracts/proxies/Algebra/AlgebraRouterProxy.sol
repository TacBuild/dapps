// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import { TransferHelper } from 'contracts/helpers/TransferHelper.sol';
import { TacProxyV1Upgradeable } from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import { OutMessageV1, TokenAmount, TacHeaderV1 } from "@tonappchain/evm-ccl/contracts/L2/Structs.sol";
import "contracts/proxies/Algebra/Path.sol";
import "contracts/proxies/Algebra/IAlgebraRouter.sol";


/**
 * @title AlgebraRouterProxy
 * @dev Proxy contract Algebra, working with router
 */
contract AlgebraRouterProxy is TacProxyV1Upgradeable, OwnableUpgradeable, UUPSUpgradeable {
    address public constant _ETH_ADDRESS_ = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    address internal _appAddress;

    using Path for bytes;

    /**
     * @dev Initialize the contract.
     */
    function initialize(address adminAddress, address appAddress, address crossChainLayer) public initializer {
        __TacProxyV1Upgradeable_init(crossChainLayer);
        __Ownable_init(adminAddress);
        __UUPSUpgradeable_init();
        _appAddress = appAddress;
    }

    /**
     * @dev Upgrades the contract.
     */
    function _authorizeUpgrade(address) internal override onlyOwner {}

    /**
     * @dev A proxy to exactInputSingle
     * @param tacHeader TacHeaderV1 struct containing the header information
     * @param arguments arguments data
     */
    function exactInputSingle(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public payable _onlyCrossChainLayer {
        (ExactInputSingleParams memory params) =
                abi.decode(arguments, (ExactInputSingleParams));

        // grant token approvals
        TransferHelper.safeApprove(params.tokenIn, _appAddress, params.amountIn);

        uint256 amountOut = IRouter(_appAddress).exactInputSingle(params);
        uint256 value;
        TokenAmount[] memory tokensToBridge;
        if (params.tokenOut == _ETH_ADDRESS_) {
            tokensToBridge = new TokenAmount[](0);
            value = amountOut;
        } else {
            tokensToBridge = new TokenAmount[](1);
            tokensToBridge[0] = TokenAmount(params.tokenOut, amountOut);
            TransferHelper.safeApprove(params.tokenOut, _getCrossChainLayerAddress(), amountOut);
            value = 0;
        }

        // CCL TAC->TON callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });

        _sendMessageV1(message, value);
    }

    /**
     * @dev A proxy to exactInput
     * @param tacHeader TacHeaderV1 struct containing the header information
     * @param arguments arguments data
     */
    function exactInput(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public payable _onlyCrossChainLayer {
        (ExactInputParams memory params) = abi.decode(arguments, (ExactInputParams));

        // claim tokens addresses
        (address tokenIn, , address tokenOut) = params.path.decodeFirstPool();
        // grant token approvals
        TransferHelper.safeApprove(tokenIn, _appAddress, params.amountIn);

        uint256 amountOut = IRouter(_appAddress).exactInput(params);

        uint256 value;
        TokenAmount[] memory tokensToBridge;
        if (tokenOut == _ETH_ADDRESS_) {
            tokensToBridge = new TokenAmount[](0);
            value = amountOut;
        } else {
            tokensToBridge = new TokenAmount[](1);
            tokensToBridge[0] = TokenAmount(tokenOut, amountOut);
            TransferHelper.safeApprove(tokenOut, _getCrossChainLayerAddress(), amountOut);
            value = 0;
        }

        // CCL TAC->TON callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });
        _sendMessageV1(message, value);
    }

    /**
     * @dev A proxy to exactOutputSingle
     * @param tacHeader TacHeaderV1 struct containing the header information
     * @param arguments arguments data
     */
    function ExactOutputSingle(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public payable _onlyCrossChainLayer {
        (ExactOutputSingleParams memory params) =
                abi.decode(arguments, (ExactOutputSingleParams));

        // grant token approvals
        TransferHelper.safeApprove(params.tokenIn, _appAddress, params.amountInMaximum);

        uint256 amountIn = IRouter(_appAddress).exactOutputSingle(params);

        address tokenOut = params.tokenOut;

        uint256 value;
        TokenAmount[] memory tokensToBridge;
        if (tokenOut == _ETH_ADDRESS_) {
            tokensToBridge = new TokenAmount[](1);
            tokensToBridge[0] = TokenAmount(params.tokenIn, params.amountInMaximum-amountIn);
            TransferHelper.safeApprove(params.tokenIn, _getCrossChainLayerAddress(), params.amountInMaximum-amountIn);
            value = params.amountOut;
        } else {
            tokensToBridge = new TokenAmount[](2);
            tokensToBridge[0] = TokenAmount(tokenOut, params.amountOut);
            tokensToBridge[1] = TokenAmount(params.tokenIn, params.amountInMaximum-amountIn);
            TransferHelper.safeApprove(tokenOut, _getCrossChainLayerAddress(), params.amountOut);
            TransferHelper.safeApprove(params.tokenIn, _getCrossChainLayerAddress(), params.amountInMaximum-amountIn);
            value = 0;
        }

        // CCL TAC->TON callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });
        _sendMessageV1(message, value);
    }

    /**
     * @dev A proxy to exactOutput
     * @param tacHeader TacHeaderV1 struct containing the header information
     * @param arguments arguments data
     */
    function ExactOutput(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public payable _onlyCrossChainLayer {
        (ExactOutputParams memory params) =
                abi.decode(arguments, (ExactOutputParams));

        (address tokenIn, , address tokenOut) = params.path.decodeFirstPool();

        // grant token approvals
        TransferHelper.safeApprove(tokenIn, _appAddress, params.amountInMaximum);

        uint256 amountIn = IRouter(_appAddress).exactOutput(params);

        uint256 value;
        TokenAmount[] memory tokensToBridge;
        if (tokenOut == _ETH_ADDRESS_) {
            tokensToBridge = new TokenAmount[](1);
            tokensToBridge[0] = TokenAmount(tokenIn, params.amountInMaximum-amountIn);
            TransferHelper.safeApprove(tokenIn, _getCrossChainLayerAddress(), params.amountInMaximum-amountIn);
            value = params.amountOut;
        } else {
            tokensToBridge = new TokenAmount[](2);
            tokensToBridge[0] = TokenAmount(tokenOut, params.amountOut);
            tokensToBridge[1] = TokenAmount(tokenIn, params.amountInMaximum-amountIn);
            TransferHelper.safeApprove(tokenOut, _getCrossChainLayerAddress(), params.amountOut);
            TransferHelper.safeApprove(tokenIn, _getCrossChainLayerAddress(), params.amountInMaximum-amountIn);
            value = 0;
        }

        // CCL TAC->TON callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });
        _sendMessageV1(message, value);
    }

}
