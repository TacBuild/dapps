// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {TacProxyV1Upgradeable} from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import {TacHeaderV1, OutMessageV1, TokenAmount, NFTAmount} from "@tonappchain/evm-ccl/contracts/core/Structs.sol";

import {ISAFactory} from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/ISAFactory.sol";
import {ITacSmartAccount} from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/ITacSmartAccount.sol";

import {LiquidStakingI, LIQUIDSTAKING_PRECOMPILE_ADDRESS} from "./precompiles/liquidstake/LiquidStakingI.sol";
import {IERC20} from "./precompiles/erc20/IERC20.sol";
import {ILiquidStakingProxy} from "./ILiquidStakingProxy.sol";

/**
 * @title LiquidStakingProxy
 * @notice TAC cross-chain proxy that handles TON-initiated liquid staking flows on EVM:
 *         funds the caller’s Smart Account (SA), executes native liquid staking precompiles,
 *         and bridges minted gTAC / withdrawn native TAC back to TON.
 * @dev Upgradeable via UUPS; gated by the Cross-Chain Layer for entrypoints.
 */
contract LiquidStakingProxy is ILiquidStakingProxy, TacProxyV1Upgradeable, Ownable2StepUpgradeable, UUPSUpgradeable {
    ISAFactory public saFactory;
    IERC20 public liquidTacToken;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address crossChainLayer_, address saFactory_, address liquidTacToken_, address owner_) {
        initialize(crossChainLayer_, saFactory_, liquidTacToken_, owner_);
        _disableInitializers();
    }

    /**
     * @notice Initializes the proxy and core dependencies.
     * @dev Must be called exactly once. Sets Cross-Chain Layer, SA factory, gTAC token and owner.
     * @param crossChainLayer_ Address of the TAC Cross-Chain Layer (TON → EVM gateway).
     * @param saFactory_ Smart Account factory used to derive/create caller SAs.
     * @param liquidTacToken_ ERC-20 mapping of the liquid bond denom (gTAC) on this chain.
     * @param owner_ Initial owner for UUPS authorization.
     */
    function initialize(
        address crossChainLayer_,
        address saFactory_,
        address liquidTacToken_,
        address owner_
    )
        public
        initializer
        onlyValidAddress(crossChainLayer_)
        onlyValidAddress(saFactory_)
        onlyValidAddress(liquidTacToken_)
    {
        __TacProxyV1Upgradeable_init(crossChainLayer_);
        __Ownable2Step_init();
        __Ownable_init(owner_);
        __UUPSUpgradeable_init();

        saFactory = ISAFactory(saFactory_);
        liquidTacToken = IERC20(liquidTacToken_);
    }

    /**
     * @notice Accepts native TAC
     */
    receive() external payable {}

    /**
     * @inheritdoc ILiquidStakingProxy
     */
    function liquidStake(bytes calldata tacHeader, bytes calldata params) external payable _onlyCrossChainLayer {
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        uint256 amount = _decodeAmount(params);

        (address smartAccountAddress, ) = saFactory.getOrCreateSmartAccount(header.tvmCaller);
        ITacSmartAccount smartAccount = ITacSmartAccount(smartAccountAddress);

        _sendTacToSmartAccount(smartAccountAddress, amount);

        bytes memory ret = smartAccount.execute(
            LIQUIDSTAKING_PRECOMPILE_ADDRESS,
            0,
            abi.encodeWithSelector(LiquidStakingI.liquidStake.selector, smartAccountAddress, amount)
        );
        bool success = abi.decode(ret, (bool));
        require(success, LiquidStakeFailed());

        uint256 erc20Balance = liquidTacToken.balanceOf(smartAccountAddress);
        _withdrawTacERC20FromSmartAccount(smartAccount, erc20Balance);
        liquidTacToken.approve(_getCrossChainLayerAddress(), erc20Balance);
        _bridgeTacERC20ToTon(header, erc20Balance);

        emit LiquidStaked(header.tvmCaller, smartAccountAddress, amount, erc20Balance);
    }

    /**
     * @inheritdoc ILiquidStakingProxy
     */
    function liquidUnstake(bytes calldata tacHeader, bytes calldata params) external _onlyCrossChainLayer {
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        uint256 amount = _decodeAmount(params);

        (address smartAccountAddress, ) = saFactory.getOrCreateSmartAccount(header.tvmCaller);
        ITacSmartAccount smartAccount = ITacSmartAccount(smartAccountAddress);

        liquidTacToken.transfer(smartAccountAddress, amount);

        bytes memory ret = smartAccount.execute(
            LIQUIDSTAKING_PRECOMPILE_ADDRESS,
            0,
            abi.encodeWithSelector(LiquidStakingI.liquidUnstake.selector, smartAccountAddress, amount)
        );
        int64 completionTime = abi.decode(ret, (int64));

        emit LiquidUnstaked(header.tvmCaller, smartAccountAddress, amount, completionTime);
    }

    /**
     * @notice UUPS authorization hook for upgrades.
     * @dev Restricts upgrades to the current owner.
     * @param newImplementation Address of the new implementation.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {} // solhint-disable no-empty-blocks

    /**
     * @inheritdoc ILiquidStakingProxy
     */
    function withdrawFromAccount(bytes calldata _tacHeader, bytes calldata) external _onlyCrossChainLayer {
        TacHeaderV1 memory tacHeader = _decodeTacHeader(_tacHeader);

        (address sa, ) = saFactory.getOrCreateSmartAccount(tacHeader.tvmCaller);
        ITacSmartAccount smartAccount = ITacSmartAccount(sa);

        uint256 nativeBalance = address(smartAccount).balance;
        require(nativeBalance > 0, NoBalanceToWithdraw());

        _withdrawTacFromSmartAccount(smartAccount, nativeBalance);
        _bridgeTacToTon(tacHeader, nativeBalance);
    }

    /**
     * @notice Decodes a single uint256 amount from ABI-encoded params.
     * @dev Reverts with {InvalidAmount} if the decoded amount is zero.
     * @param params ABI-encoded `(uint256 amount)`.
     * @return amount Decoded non-zero amount.
     */
    function _decodeAmount(bytes calldata params) private pure returns (uint256 amount) {
        amount = abi.decode(params, (uint256));
        require(amount != 0, InvalidAmount());
    }

    /**
     * @notice Bridges gTAC (ERC-20) back to TON for the given TON caller context.
     * @dev Packages a token-bridge message with the provided amount; custody/transfer is handled by CCL.
     * @param tacHeader TAC header carrying TON routing context (e.g. tvmCaller, shardsKey).
     * @param amount Amount of gTAC to bridge to TON.
     */
    function _bridgeTacERC20ToTon(TacHeaderV1 memory tacHeader, uint256 amount) private {
        TokenAmount[] memory tokenAmounts = new TokenAmount[](1);
        tokenAmounts[0] = TokenAmount(address(liquidTacToken), amount);

        OutMessageV1 memory outMessage = OutMessageV1({
            shardsKey: tacHeader.shardsKey,
            tvmTarget: tacHeader.tvmCaller,
            tvmPayload: "",
            tvmProtocolFee: 0,
            tvmExecutorFee: 0,
            tvmValidExecutors: new string[](0),
            toBridge: tokenAmounts,
            toBridgeNFT: new NFTAmount[](0)
        });
        _sendMessageV1(outMessage, 0);
    }

    /**
     * @notice Bridges native TAC back to TON for the given TON caller context.
     * @dev Sends a value-bridge message; value is provided as the second argument to the CCL dispatcher.
     * @param tacHeader TAC header carrying TON routing context (e.g. tvmCaller, shardsKey).
     * @param amount Native TAC amount to bridge to TON.
     */
    function _bridgeTacToTon(TacHeaderV1 memory tacHeader, uint256 amount) private {
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
     * @notice Sends native TAC to the target Smart Account (SA) using a plain call with value.
     * @dev Reverts with {SendTacToSmartAccountFailed} if the SA rejects or reverts the call.
     * @param smartAccount Target SA address to receive `amount`.
     * @param amount Native TAC amount to forward.
     */
    function _sendTacToSmartAccount(address smartAccount, uint256 amount) private {
        (bool success, bytes memory result) = smartAccount.call{value: amount}("");
        require(success, SendTacToSmartAccountFailed(smartAccount, result));
    }

    /**
     * @notice Withdraws native TAC from the Smart Account (SA) to this contract.
     * @dev Executes a value-bearing call via SA’s `execute`, pulling `amount` back to this proxy.
     * @param smartAccount The Smart Account to withdraw from.
     * @param amount Native TAC amount to pull from the SA.
     */
    function _withdrawTacFromSmartAccount(ITacSmartAccount smartAccount, uint256 amount) private {
        smartAccount.execute(
            address(this),
            amount,
            "" // empty payload, we just want to withdraw the amount
        );
    }

    /**
     * @notice Withdraws gTAC (ERC-20) from the Smart Account (SA) to this contract.
     * @dev Invokes ERC-20 `transfer` via SA’s `execute`, moving `amount` gTAC to this proxy.
     * @param smartAccount The Smart Account to withdraw from.
     * @param amount gTAC amount to pull from the SA.
     */
    function _withdrawTacERC20FromSmartAccount(ITacSmartAccount smartAccount, uint256 amount) private {
        smartAccount.execute(
            address(liquidTacToken),
            0,
            abi.encodeWithSelector(IERC20.transfer.selector, address(this), amount)
        );
    }

    /**
     * @notice Ensures the provided address is non-zero.
     * @dev Reverts with {InvalidAddress} if `address_` is the zero address.
     * @param address_ Address to validate.
     */
    modifier onlyValidAddress(address address_) {
        require(address_ != address(0), InvalidAddress());
        _;
    }
}
