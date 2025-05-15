// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import { TransferHelper } from 'contracts/helpers/TransferHelper.sol';
import { TacProxyV1Upgradeable } from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import { OutMessageV1, TokenAmount, NFTAmount, TacHeaderV1 } from "@tonappchain/evm-ccl/contracts/core/Structs.sol";

import { IRouter } from "contracts/proxies/CurveLite/ICurveLiteRouter.sol";


/**
 * @title CurveLiteRouterProxy
 * @dev Proxy contract CurveLite, working with router
 */
contract CurveLiteRouterProxy is TacProxyV1Upgradeable, OwnableUpgradeable, UUPSUpgradeable {
    address public constant _ETH_ADDRESS_ = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    address internal _appAddress;

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
     * @dev A proxy to exchange
     * @param tacHeader TacHeaderV1 struct containing the header information
     * @param arguments arguments data
     */
    function exchange(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public payable _onlyCrossChainLayer {
        (address[11] memory route,
        uint256[4][5] memory params,
        uint256 amount,
        uint256 min_dy) =
                abi.decode(arguments, (address[11], uint256[4][5], uint256, uint256));
        // claim tokens addresses
        address tokenA = route[0];
        // grant token approvals
        TransferHelper.safeApprove(tokenA, _appAddress, amount);

        uint256 amountOut = IRouter(_appAddress).exchange(
            route, params, amount, min_dy
        );

        address tokenOut;
        uint i = 0;
        for (;i < 11;) {
            if (route[i] == address(0)){
                tokenOut = route[i-1];
                break;
            }
            unchecked {
                i++;
            }
        }

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
            tvmProtocolFee: 0,
            tvmExecutorFee: 0,
            tvmValidExecutors: new string[](0),
            toBridge: tokensToBridge,
            toBridgeNFT: new NFTAmount[](0)
        });
        _sendMessageV1(message, value);
    }
}
