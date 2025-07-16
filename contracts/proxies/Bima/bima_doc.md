
# 📄 BimaProxy Contract Function Documentation

## 1. `openTrove`
```solidity
function openTrove(address asset, uint256 maxFee, uint256 debt, uint256 coll) external;
```
Opens a new Trove (position) with the specified asset, max fee, debt, and collateral.

- `asset`: address of the asset.
- `maxFee`: maximum fee allowed.
- `debt`: desired debt amount.
- `coll`: collateral amount.

---

## 2. `adjustTrove`
```solidity
function adjustTrove(address asset, bool isDebtIncrease, uint256 debtDelta, uint256 collDelta) external;
```
Adjusts an existing Trove by increasing or decreasing the debt or collateral.

- `isDebtIncrease`: `true` to increase debt, `false` to decrease.
- `debtDelta`: change in debt.
- `collDelta`: change in collateral.

---

## 3. `closeTrove`
```solidity
function closeTrove(address asset) external;
```
Closes the Trove for the specified asset.

---

## 4. `withdrawCollateral`
```solidity
function withdrawCollateral(address asset, uint256 amount) external;
```
Withdraws a portion of the collateral from the Trove.

- `amount`: amount to withdraw.

---

## 5. `repayDebt`
```solidity
function repayDebt(address asset, uint256 amount) external;
```
Repays part of the Trove’s debt.

- `amount`: amount to repay.

---

## 6. `claimCollateral`
```solidity
function claimCollateral(address asset) external;
```
Claims any available collateral after Trove liquidation.

---

## 7. `bridgeTroveOpen`
```solidity
function bridgeTroveOpen(
    address asset,
    uint256 maxFee,
    uint256 debt,
    uint256 coll,
    address to,
    uint256 toChainId
) external payable;
```
Opens a Trove and bridges the position to another chain.

- `to`: recipient address on the destination chain.
- `toChainId`: target chain ID.

---

## 8. `bridgeTroveAdjust`
```solidity
function bridgeTroveAdjust(
    address asset,
    bool isDebtIncrease,
    uint256 debtDelta,
    uint256 collDelta,
    address to,
    uint256 toChainId
) external payable;
```
Adjusts the Trove and bridges the changes.

---

## 9. `bridgeTroveClose`
```solidity
function bridgeTroveClose(
    address asset,
    address to,
    uint256 toChainId
) external;
```
Closes the Trove and bridges the returned assets.

---

## 10. `bridgeTroveRepay`
```solidity
function bridgeTroveRepay(
    address asset,
    uint256 amount,
    address to,
    uint256 toChainId
) external;
```
Repays Trove debt and bridges the assets.

---

## 11. `bridgeTroveWithdraw`
```solidity
function bridgeTroveWithdraw(
    address asset,
    uint256 amount,
    address to,
    uint256 toChainId
) external;
```
Withdraws collateral and sends it to another chain.

---

## 12. `bridgeTroveClaim`
```solidity
function bridgeTroveClaim(
    address asset,
    address to,
    uint256 toChainId
) external;
```
Claims liquidated collateral and bridges it.
