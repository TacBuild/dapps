// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

//Standard Proxy Imports:
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { TacProxyV1Upgradeable } from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";

import { OutMessageV1, TokenAmount, TacHeaderV1 } from "@tonappchain/evm-ccl/contracts/L2/Structs.sol";

//Faucet Proxy Imports:
import { ITreasurySwap } from "../interfaces/ITreasurySwap.sol";

struct MintArguments {
    address to;
    uint256 wTONamt;
}

struct BurnArguments {
    address to;
    uint256 amount;
}

/**
 * @title TreasurySwapProxy
 * @dev Proxy contract for TreasurySwap
 */
contract TreasurySwapProxy is UUPSUpgradeable, OwnableUpgradeable, TacProxyV1Upgradeable {

    using SafeERC20 for IERC20;

    address public _wTON;
    address internal _appAddress;

     /**
      * @dev Initialize the contract.
     */
     function initialize(address adminAddress, address appAddress, address wTON, address crossChainLayer) public initializer {
        __Ownable_init(adminAddress);
        __UUPSUpgradeable_init();
        __TacProxyV1Upgradeable_init(crossChainLayer);
        _wTON = wTON;
        _appAddress = appAddress;
    }

    /**
     * @dev Upgrades the contract.
     */
    function _authorizeUpgrade(address) internal override onlyOwner {}

    function _mint(
        MintArguments memory arguments
    ) internal returns (TokenAmount[] memory) {
        // grant token approvals
        IERC20(_wTON).safeIncreaseAllowance(_appAddress, arguments.wTONamt);

        // proxy call
        uint256 receivedAmount = ITreasurySwap(_appAddress).mint(arguments.to, arguments.wTONamt);

        // bridge remaining tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);

        tokensToBridge[0] = TokenAmount(ITreasurySwap(_appAddress).token(), receivedAmount);

        return tokensToBridge;
    }

    /**
     * @dev A proxy to TreasurySwap.mint(...).
     */
    function mint(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable _onlyCrossChainLayer {

        MintArguments memory args = abi.decode(arguments, (MintArguments));
        TokenAmount[] memory tokensToBridge = _mint(args);

        uint i;
        for (; i < tokensToBridge.length;) {
            IERC20(tokensToBridge[i].l2Address).safeIncreaseAllowance(_getCrossChainLayerAddress(), tokensToBridge[i].amount);
            unchecked {
                i++;
            }
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
            toBridge: tokensToBridge
        });

        _sendMessageV1(message, 0);
    }

    function _burn(
        BurnArguments memory arguments
    ) internal returns (TokenAmount[] memory) {
        // grant token approvals
        IERC20(ITreasurySwap(_appAddress).token()).safeIncreaseAllowance(_appAddress, arguments.amount);

        // proxy call
        uint256 receivedAmount = ITreasurySwap(_appAddress).burn(arguments.to, arguments.amount);

        // bridge remaining tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(_wTON, receivedAmount);

        return tokensToBridge;
    }

    /**
     * @dev A proxy to TreasurySwap.burn(...).
     */
    function burn(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable _onlyCrossChainLayer {

        BurnArguments memory args = abi.decode(arguments, (BurnArguments));
        TokenAmount[] memory tokensToBridge = _burn(args);

        uint i;
        for (; i < tokensToBridge.length;) {
            IERC20(tokensToBridge[i].l2Address).safeIncreaseAllowance(_getCrossChainLayerAddress(), tokensToBridge[i].amount);
            unchecked {
                i++;
            }
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
            toBridge: tokensToBridge
        });

        _sendMessageV1(message, 0);
    }
}
