// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import { TransferHelper } from 'contracts/helpers/TransferHelper.sol';
import { TacProxyV1Upgradeable } from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import { OutMessageV2, TokenAmount, TacHeaderV1, NFTAmount } from "@tonappchain/evm-ccl/contracts/L2/Structs.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Codec, OrderPayload} from "./Codec.sol";


interface IManager {
    /// @notice Executes deposit based on off-chain signed payload
    /// @param data Encoded OrderPayload
    /// @param sign Signature of the payload
    function deposit(bytes calldata data, bytes memory sign) external;

    /// @notice Executes withdrawal based on off-chain signed payload
    /// @param data Encoded OrderPayload
    /// @param sign Signature of the payload
    function withdraw(bytes calldata data, bytes memory sign) external;
}


/**
 * @title YieldManagerProxy
 * @dev Proxy contract for Yield Manager
 */
contract YieldManagerProxy is TacProxyV1Upgradeable, OwnableUpgradeable, UUPSUpgradeable {
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
     * @dev A proxy to deposit
     * @param tacHeader TacHeaderV1 struct containing the header information
     * @param arguments arguments data
     */
    function deposit(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public payable _onlyCrossChainLayer {
        (bytes memory _data, bytes  memory  _sign) =
                abi.decode(arguments, (bytes, bytes));
        

        OrderPayload memory payload = Codec.decodeOrderPayload(_data);

        // grant token approvals

        TransferHelper.safeApprove(payload.token, _appAddress, payload.amount);

        IManager(_appAddress).deposit(
            _data, _sign
        );

    }


    /**
     * @dev A proxy to withdraw
     * @param tacHeader TacHeaderV1 struct containing the header information
     * @param arguments arguments data
     */
    function withdraw(
    bytes calldata tacHeader,
    bytes calldata arguments
) public _onlyCrossChainLayer {
    (bytes memory _data, bytes memory _sign) =
        abi.decode(arguments, (bytes, bytes));

    IManager(_appAddress).withdraw(_data, _sign);
}


}
