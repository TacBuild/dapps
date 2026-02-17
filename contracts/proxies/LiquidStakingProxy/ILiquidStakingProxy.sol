// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title ILiquidStakingProxy
 * @notice Interface for a TAC cross-chain proxy handling TON-initiated liquid staking flows on EVM.
 * @dev Exposes entrypoints invoked by the TAC Cross-Chain Layer to stake/unstake via native precompiles
 *      and to withdraw/bridge assets back to TON.
 */
interface ILiquidStakingProxy {
    /**
     * @notice Thrown when a zero address is provided where a valid address is required.
     */
    error InvalidAddress();

    /**
     * @notice Thrown when the provided amount is zero or otherwise invalid.
     */
    error InvalidAmount();

    /**
     * @notice Thrown when sending native TAC to the Smart Account fails.
     * @param smartAccount The Smart Account address that failed to receive funds.
     * @param reason Low-level return data describing the failure.
     */
    error SendTacToSmartAccountFailed(address smartAccount, bytes reason);

    /**
     * @notice Thrown when the Liquid Staking precompile call fails.
     */
    error LiquidStakeFailed();

    /**
     * @notice Thrown when staking to LP via the precompile fails.
     */
    error StakeToLPFailed();

    /**
     * @notice Thrown when there is no native TAC balance available to withdraw from the Smart Account.
     */
    error NoBalanceToWithdraw();

    /**
     * @notice Emitted after a TON-initiated liquid stake is executed and gTAC is queued for bridging.
     * @param tvmCaller TON account identifier that initiated the request.
     * @param callerSmartAccount TAC Smart Account (SA) derived for the caller.
     * @param stakedAmount Native TAC amount provided for liquid staking.
     * @param receivedAmount Amount of gTAC (ERC-20) minted and pulled from the SA.
     */
    event LiquidStaked(
        string indexed tvmCaller,
        address callerSmartAccount,
        uint256 stakedAmount,
        uint256 receivedAmount
    );

    /**
     * @notice Emitted after a TON-initiated liquid unstake request is submitted.
     * @param tvmCaller TON account identifier that initiated the request.
     * @param callerSmartAccount TAC Smart Account (SA) used as delegator for unstake.
     * @param amount gTAC (ERC-20) amount burned to initiate liquid unstaking.
     * @param completionTime UNIX timestamp when native unbonding completes.
     */
    event LiquidUnstaked(string indexed tvmCaller, address callerSmartAccount, uint256 amount, int64 completionTime);

    /**
     * @notice Processes a TON-initiated liquid staking request and bridges minted LST (gTAC, ERC-20) back to TON.
     * @dev Processes a TON-initiated liquid stake by funding the caller’s Smart Account (SA), executing
     *      LiquidStakingI.liquidStake from the SA, pulling the minted gTAC to this contract, and queuing it for
     *      bridging back to TON.
     *
     * Requirements:
     *  - Caller must be the Cross-Chain Layer (_onlyCrossChainLayer).
     *  - `params` must ABI-encode a non-zero `uint256 amount`.
     *
     * Effects:
     *  - Mints gTAC to the SA via the native Liquid Staking precompile and schedules those gTAC for return to TON.
     *  - Emits {LiquidStaked} with TON caller, SA, staked amount, and minted gTAC.
     *
     * @param tacHeader TAC header carrying TON routing context (e.g. tvmCaller, shardsKey).
     * @param params ABI-encoded `(uint256 amount)` — the native amount to liquid-stake.
     */
    function liquidStake(bytes calldata tacHeader, bytes calldata params) external payable;

    /**
     * @notice Processes a TON-initiated liquid unstake request for gTAC (ERC-20).
     * @dev Transfers the specified gTAC amount to the caller’s Smart Account (SA) and executes
     *      `LiquidStakingI.liquidUnstake` from the SA, returning the unbonding completion time.
     *
     * Requirements:
     *  - Caller must be the Cross-Chain Layer (_onlyCrossChainLayer).
     *  - `params` must ABI-encode a non-zero `uint256 amount`.
     *
     * Effects:
     *  - Burns the provided gTAC via the native Liquid Staking precompile and schedules native unbonding.
     *  - Emits {LiquidUnstaked} with TON caller, SA, unstaked amount, and `completionTime`.
     *
     * @param tacHeader TAC header carrying TON routing context (e.g. tvmCaller, shardsKey).
     * @param params ABI-encoded `(uint256 amount)` — the gTAC amount to liquid-unstake.
     */
    function liquidUnstake(bytes calldata tacHeader, bytes calldata params) external;

    /**
     * @notice Withdraws all available native TAC from the caller’s Smart Account (SA) and bridges it back to TON.
     * @dev Fetches the SA for `tvmCaller`, transfers its full native balance to this contract, and enqueues it for
     *      bridging to TON.
     *
     * Requirements:
     *  - Caller must be the Cross-Chain Layer (_onlyCrossChainLayer).
     *  - SA must have a positive native TAC balance.
     *
     * Effects:
     *  - Moves native TAC from the SA to this contract and schedules it for return to TON.
     *
     * @param _tacHeader TAC header carrying TON routing context (e.g. tvmCaller, shardsKey).
     */
    function withdrawFromAccount(bytes calldata _tacHeader, bytes calldata) external;
}
