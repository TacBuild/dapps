// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";

import { TacProxyV1Upgradeable } from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";

import { OutMessageV1, TokenAmount, NFTAmount, TacHeaderV1 } from "@tonappchain/evm-ccl/contracts/core/Structs.sol";
import { IWTAC } from "@tonappchain/evm-ccl/contracts/interfaces/IWTAC.sol";

/**
 * @title WTACConverterProxy
 * @dev This contract is a proxy for the WTACConverter, allowing for upgradeability and ownership management.
 */
contract WTACConverterProxy is TacProxyV1Upgradeable, UUPSUpgradeable, Ownable2StepUpgradeable {
    IWTAC public wtac;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address crossChainLayer, IWTAC _wtac) external initializer {
        __UUPSUpgradeable_init();
        __TacProxyV1Upgradeable_init(crossChainLayer);
        __Ownable_init(admin);

        wtac = _wtac;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    receive() payable external {
        // This contract can receive native TAC
    }

    function _bridgeToTon(
        TacHeaderV1 memory tacHeader,
        uint256 amount
    ) internal {
        OutMessageV1 memory outMessage = OutMessageV1({
            shardsKey: tacHeader.shardsKey,
            tvmTarget: tacHeader.tvmCaller,
            tvmPayload: "",
            tvmProtocolFee: 0,
            tvmExecutorFee: 0,
            tvmValidExecutors: new string[](0),
            toBridge: new TokenAmount[](0),
            toBridgeNFT: new NFTAmount[](0)
        });

        _sendMessageV1(outMessage, amount);
    }


    /**
     * @dev Converts WTAC (Wrapped TAC) to native TAC.
     * @param _tacHeader The encoded tac header v1.
     * @param _params Encoded uint256 amount of wtac
     */
    function convertWrappedToNativeTac(
        bytes calldata _tacHeader,
        bytes calldata _params
    ) external _onlyCrossChainLayer() {
        TacHeaderV1 memory tacHeader = abi.decode(_tacHeader, (TacHeaderV1));
        uint256 amount = abi.decode(_params, (uint256));

        // Ensure the amount is greater than zero
        require(amount > 0, "WTACConverterProxy: Amount must be greater than zero");

        // Convert WTAC to native TAC
        wtac.withdraw(amount);

        // bridge the native TAC back to TON
        _bridgeToTon(tacHeader, amount);
    }
}