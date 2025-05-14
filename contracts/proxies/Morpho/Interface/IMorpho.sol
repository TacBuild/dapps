// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

type Id is bytes32;

interface IMorpho {

    struct MarketParams {
    address loanToken;
    address collateralToken;
    address oracle;
    address irm;
    uint256 lltv;
}
struct Position {
    uint256 supplyShares;
    uint128 borrowShares;
    uint128 collateral;
}

    function supplyCollateral(MarketParams memory marketParams, uint256 assets, address onBehalf, bytes calldata data) external;
    function withdrawCollateral(MarketParams memory marketParams, uint256 assets, address onBehalf, address receiver) external;
    function borrow(MarketParams memory marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver) external returns (uint256, uint256);
    function repay(MarketParams memory marketParams, uint256 assets, uint256 shares, address onBehalf, bytes memory data) external returns (uint256, uint256);
    function createMarket(MarketParams memory marketParams) external;
    function supply(
        MarketParams memory marketParams,
        uint256 assets,
        uint256 shares,
        address onBehalf,
        bytes calldata data
    ) external returns (uint256, uint256);
    function setAuthorization(address authorized, bool newIsAuthorized) external;
    function position(Id id, address onBehalf) external view returns (Position memory);
    function idToMarketParams(Id id)
        external
        view
        returns (address loanToken, address collateralToken, address oracle, address irm, uint256 lltv);
}
