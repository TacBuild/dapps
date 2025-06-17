// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TransferHelper} from "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import {OutMessageV1, TokenAmount, TacHeaderV1, NFTAmount} from "@tonappchain/evm-ccl/contracts/core/Structs.sol";
import {TacProxyV1Upgradeable} from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IMorpho, Id} from "./Interface/IMorpho.sol";
import {IMorphoVault} from "./Interface/IMorphoVault.sol";
import {IURD} from "./Interface/IURD.sol";
import {TacSAFactory} from "../../TacSmartAccounts/TacSAFactory.sol";
import {MarketParamsLib} from "./lib/MarketParamsLib.sol";
import {ITacSmartAccount} from "../../TacSmartAccounts/Interface/ITacSmartAccount.sol";
import {IMetaMorphoV1_1Factory} from "./Interface/IMetaMorphoV1_1Factory.sol";

/// @title MorphoProxy
/// @notice A proxy contract that interfaces with Morpho protocol for lending and borrowing operations
/// @dev Implements TacProxyV1Upgradeable, UUPSUpgradeable, and OwnableUpgradeable
contract MorphoProxy is
    TacProxyV1Upgradeable,
    UUPSUpgradeable,
    OwnableUpgradeable
{
    using MarketParamsLib for IMorpho.MarketParams;

    /// @notice Arguments for deposit operation
    /// @param vault Address of the vault to deposit into
    /// @param assets Amount of assets to deposit
    struct DepositArguments {
        address vault;
        uint256 assets;
    }

    /// @notice Arguments for withdraw operation
    /// @param vault Address of the vault to withdraw from
    /// @param assets Amount of assets to withdraw
    struct WithdrawArguments {
        address vault;
        uint256 assets;
    }

    /// @notice Arguments for mint operation
    /// @param vault Address of the vault to mint from
    /// @param shares Amount of shares to mint
    struct MintArguments {
        address vault;
        uint256 shares;
    }

    /// @notice Arguments for redeem operation
    /// @param vault Address of the vault to redeem from
    /// @param shares Amount of shares to redeem
    struct RedeemArguments {
        address vault;
        uint256 shares;
    }

    /// @notice Arguments for creating a new market
    /// @param marketParams Parameters for the new market
    struct CreateMarketArguments {
        IMorpho.MarketParams marketParams;
    }

    /// @notice Arguments for creating a new vault
    /// @param initialOwner Address of the initial vault owner
    /// @param initialTimeLock Initial time lock period
    /// @param asset Address of the asset token
    /// @param name Name of the vault
    /// @param symbol Symbol of the vault
    /// @param salt Unique salt for vault creation
    struct CreateVaultArguments {
        address initialOwner;
        uint256 initialTimeLock;
        address asset;
        string name;
        string symbol;
        bytes32 salt;
    }

    /// @notice Arguments for supplying collateral
    /// @param marketParams Market parameters
    /// @param assets Amount of assets to supply as collateral
    /// @param data Additional data for the supply operation
    struct SupplyCollateralArguments {
        IMorpho.MarketParams marketParams;
        uint256 assets;
    }

    /// @notice Arguments for withdrawing collateral
    /// @param marketParams Market parameters
    /// @param assets Amount of assets to withdraw from collateral
    struct WithdrawCollateralArguments {
        IMorpho.MarketParams marketParams;
        uint256 assets;
    }

    /// @notice Arguments for borrowing
    /// @param marketParams Market parameters
    /// @param assets Amount of assets to borrow
    /// @param shares Amount of shares to borrow
    struct BorrowArguments {
        IMorpho.MarketParams marketParams;
        uint256 assets;
        uint256 shares;
    }

    /// @notice Arguments for supplying assets
    /// @param marketParams Market parameters
    /// @param assets Amount of assets to supply
    /// @param shares Amount of shares to supply
    /// @param data Additional data for the supply operation
    struct SupplyArguments {
        IMorpho.MarketParams marketParams;
        uint256 assets;
        uint256 shares;
    }

    /// @notice Arguments for withdrawing supplied assets
    /// @param marketParams Market parameters
    /// @param assets Amount of assets to withdraw
    /// @param shares Amount of shares to withdraw
    struct WithdrawSuppliedAssetsArguments {
        IMorpho.MarketParams marketParams;
        uint256 assets;
        uint256 shares;
        address onBehalf;
        address receiver;
    }

    /// @notice Arguments for repaying a loan
    /// @param marketParams Market parameters
    /// @param assets Amount of assets to repay
    /// @param shares Amount of shares to repay
    /// @param data Additional data for the repay operation
    struct RepayArguments {
        IMorpho.MarketParams marketParams;
        uint256 assets;
        uint256 shares;
    }


    /// @notice Arguments for claiming rewards
    /// @param account Address of the account claiming rewards
    /// @param reward Address of the reward token
    /// @param claimable Amount of rewards claimable
    /// @param proof Merkle proof for claiming rewards
    struct ClaimArguments {
        address account;
        address reward;
        uint256 claimable;
        bytes32[] proof;
    }

    /// @notice Emitted when a new vault is created
    /// @param vault Address of the created vault
    event VaultCreated(address indexed vault);
    /// @notice Emitted when a new market is created
    /// @param marketParamsId ID of the created market
    event MarketCreated(Id indexed marketParamsId);
    /// @notice Emitted when assets are deposited into a vault
    /// @param vault Address of the vault
    /// @param assets Amount of assets deposited
    event Deposit(address indexed vault, uint256 assets);
    /// @notice Emitted when shares are minted in a vault
    /// @param vault Address of the vault
    /// @param actualShares Amount of shares minted
    /// @param requestedShares Amount of shares requested
    event Mint(address indexed vault, uint256 actualShares, uint256 requestedShares);
    /// @notice Emitted when assets are withdrawn from a vault
    /// @param vault Address of the vault
    /// @param assets Amount of assets withdrawn
    event Withdraw(address indexed vault, uint256 assets, uint256 sharesBurned);
    /// @notice Emitted when shares are redeemed from a vault
    /// @param vault Address of the vault
    /// @param shares Amount of shares redeemed
    /// @param assetsRedeemed Amount of assets redeemed
    event Redeem(address indexed vault, uint256 shares, uint256 assetsRedeemed);
    /// @notice Emitted when rewards are claimed
    /// @param account Address of the claiming account
    /// @param reward Address of the reward token
    /// @param claimable Amount of rewards claimed
    event Claim(address indexed account, address indexed reward, uint256 claimable);
    /// @notice Emitted when collateral is supplied
    /// @param marketParamsId ID of the market
    /// @param assets Amount of assets supplied as collateral
    event SupplyCollateral(Id indexed marketParamsId, uint256 assets);
    /// @notice Emitted when collateral is withdrawn
    /// @param marketParamsId ID of the market
    /// @param assets Amount of assets withdrawn from collateral
    event WithdrawCollateral(Id indexed marketParamsId, uint256 assets);
    /// @notice Emitted when assets are borrowed
    /// @param marketParamsId ID of the market
    /// @param actualAssets Amount of assets borrowed
    /// @param actualShares Amount of shares borrowed
    /// @param requestedAssets Amount of assets requested
    /// @param requestedShares Amount of shares requested
    event Borrow(Id indexed marketParamsId, uint256 actualAssets, uint256 actualShares, uint256 requestedAssets, uint256 requestedShares);
    /// @notice Emitted when a loan is repaid
    /// @param marketParamsId ID of the market
    /// @param actualAssets Amount of assets repaid
    /// @param actualShares Amount of shares repaid
    /// @param requestedAssets Amount of assets requested
    /// @param requestedShares Amount of shares requested
    event Repay(Id indexed marketParamsId, uint256 actualAssets, uint256 actualShares, uint256 requestedAssets, uint256 requestedShares);
    /// @notice Emitted when assets are supplied
    /// @param marketParamsId ID of the market
    /// @param actualAssets Amount of assets supplied
    /// @param actualShares Amount of shares supplied
    /// @param requestedAssets Amount of assets requested
    /// @param requestedShares Amount of shares requested
    event Supply(Id indexed marketParamsId, uint256 actualAssets, uint256 actualShares, uint256 requestedAssets, uint256 requestedShares);
    /// @notice Emitted when assets are withdrawn from a market
    /// @param marketParamsId ID of the market
    /// @param actualAssets Amount of assets withdrawn
    /// @param actualShares Amount of shares withdrawn
    /// @param requestedAssets Amount of assets requested
    /// @param requestedShares Amount of shares requested
    event WithdrawSuppliedAssets(Id indexed marketParamsId, uint256 actualAssets, uint256 actualShares, uint256 requestedAssets, uint256 requestedShares);

    /// @notice Error emitted when a zero address is provided
    error ZeroAddress();
    
    /// @notice Address of the Morpho protocol contract
    IMorpho public morpho;
    /// @notice Address of the URD contract
    IURD public urd;
    /// @notice Address of the TacSAFactory contract
    TacSAFactory public tacSAFactory;
    /// @notice Address of the MetaMorpho V1.1 contract
    IMetaMorphoV1_1Factory public metaMorphoFactoryV1_1;

    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the proxy contract
    /// @param _crossChainLayer Address of the cross-chain layer contract
    /// @param _morpho Address of the Morpho protocol contract
    /// @param _urd Address of the URD contract
    /// @param _metaMorphoFactoryV1_1 Address of the MetaMorpho V1.1 contract
    /// @param _tacSAFactory Address of the TacSAFactory contract
    function initialize(
        address _crossChainLayer,
        address _morpho,
        address _urd,
        address _metaMorphoFactoryV1_1,
        address _tacSAFactory
    ) external initializer {
        if(_crossChainLayer == address(0) || _morpho == address(0) || _urd == address(0) || _metaMorphoFactoryV1_1 == address(0) || _tacSAFactory == address(0)) {
            revert ZeroAddress();
        }
        __TacProxyV1Upgradeable_init(_crossChainLayer);
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        morpho = IMorpho(_morpho);
        urd = IURD(_urd);
        tacSAFactory = TacSAFactory(_tacSAFactory);
        metaMorphoFactoryV1_1 = IMetaMorphoV1_1Factory(_metaMorphoFactoryV1_1);
    }

    /// @notice Internal function to authorize upgrades
    /// @param newImplementation Address of the new implementation
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}


    ///////////////////////////////
    /////// VAULT FUNCTIONS ///////
    ///////////////////////////////

    /// @notice Deposits assets into a vault
    /// @param tacHeader TAC header data
    /// @param arguments Encoded deposit arguments
    /// @dev Receiver of the shares is the proxy contract, because shares should be bridged to TON
    function deposit(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer{
        DepositArguments memory args = abi.decode(
            arguments,
            (DepositArguments)
        );
        TransferHelper.safeApprove(
            IMorphoVault(args.vault).asset(),
            args.vault,
            args.assets
        );
        uint256 shares = IMorphoVault(args.vault).deposit(
            args.assets,
            address(this)
        );
        emit Deposit(args.vault, args.assets);
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(args.vault, shares);
        _bridgeTokens(tacHeader, tokensToBridge, "");
    }

    /// @notice Mints shares in a vault
    /// @param tacHeader TAC header data
    /// @param arguments Encoded mint arguments
    /// @dev Receiver of the shares is the proxy contract, because shares should be bridged to TON
    function mint(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer {
        MintArguments memory args = abi.decode(arguments, (MintArguments));
        uint256 assets = IMorphoVault(args.vault).previewMint(args.shares);
        TransferHelper.safeApprove(
            IMorphoVault(args.vault).asset(),
            args.vault,
            assets
        );
        uint256 shares = IMorphoVault(args.vault).mint(args.shares, address(this));
        emit Mint(args.vault, shares, args.shares);
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(
            args.vault,
            shares
        );
        if (IERC20(IMorphoVault(args.vault).asset()).balanceOf(address(this)) > 0) {
            TransferHelper.safeApprove(
                IMorphoVault(args.vault).asset(),
                args.vault,
                0
            );
            tokensToBridge = _addTokenToBridge(IMorphoVault(args.vault).asset(), tokensToBridge);
        }
        _bridgeTokens(tacHeader, tokensToBridge, "");
        
    }

    /// @notice Withdraws assets from a vault
    /// @param tacHeader TAC header data
    /// @param arguments Encoded withdraw arguments
    /// @dev Receiver of the assets is the proxy contract, because assets should be bridged to TON
    function withdraw(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer {
        WithdrawArguments memory args = abi.decode(
            arguments,
            (WithdrawArguments)
        );
        uint256 sharesBurned = IMorphoVault(args.vault).withdraw(
            args.assets,
            address(this),
            address(this)
        );
        emit Withdraw(args.vault, args.assets, sharesBurned);
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(
            IMorphoVault(args.vault).asset(),
            IERC20(IMorphoVault(args.vault).asset()).balanceOf(address(this))
        );
        if (IERC20(args.vault).balanceOf(address(this)) > 0) {
            tokensToBridge = _addTokenToBridge(args.vault, tokensToBridge);
        }
        _bridgeTokens(tacHeader, tokensToBridge, "");
    }

    /// @notice Redeems shares from a vault
    /// @param tacHeader TAC header data
    /// @param arguments Encoded redeem arguments
    /// @dev Receiver of the assets is the proxy contract, because assets should be bridged to TON
    function redeem(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer {
        RedeemArguments memory args = abi.decode(arguments, (RedeemArguments));
        uint256 assetsRedeemed = IMorphoVault(args.vault).redeem(
            args.shares,
            address(this),
            address(this)
        );
        emit Redeem(args.vault, args.shares, assetsRedeemed);
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(
            IMorphoVault(args.vault).asset(),
            IERC20(IMorphoVault(args.vault).asset()).balanceOf(address(this))
        );
        _bridgeTokens(tacHeader, tokensToBridge, "");
    }


    ///////////////////////////////
    /////// URD FUNCTIONS ///////
    ///////////////////////////////

    /// @notice Claims rewards for an account
    /// @param tacHeader TAC header data
    /// @param arguments Encoded claim arguments
    function claim(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer {
        ClaimArguments memory args = abi.decode(arguments, (ClaimArguments));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, bool isNewAccount) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        if (isNewAccount) {
            _setAutorization(user);
        }
        uint256 amount = urd.claim(args.account, args.reward, args.claimable, args.proof);
        if (args.account == user) {
            ITacSmartAccount(user).execute(args.reward, 0, abi.encodeWithSelector(IERC20.transfer.selector, address(this), amount));
            if (amount > 0) {
                TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
                tokensToBridge[0] = TokenAmount(args.reward, amount);
                _bridgeTokens(tacHeader, tokensToBridge, "");
            }
        } else if(args.account == address(this)) {
            if (amount > 0) {
                TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
                tokensToBridge[0] = TokenAmount(args.reward, amount);
                _bridgeTokens(tacHeader, tokensToBridge, "");
            }
        }
        emit Claim(args.account, args.reward, amount);
    }


    ///////////////////////////////
    /////// MARKET FUNCTIONS ///////
    ///////////////////////////////

    /// @notice Supplies collateral to a market
    /// @param tacHeader TAC header data
    /// @param arguments Encoded supply collateral arguments
    function supplyCollateral(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer {
        SupplyCollateralArguments memory args = abi.decode(arguments, (SupplyCollateralArguments));
        TransferHelper.safeApprove(
            args.marketParams.collateralToken,
            address(morpho),
            args.assets
        );
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, bool isNewAccount) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        if (isNewAccount) {
            _setAutorization(user);
        }
        morpho.supplyCollateral(args.marketParams, args.assets, user, "");
        emit SupplyCollateral(args.marketParams.id(), args.assets);
    }

    /// @notice Withdraws collateral from a market
    /// @param tacHeader TAC header data
    /// @param arguments Encoded withdraw collateral arguments
    function withdrawCollateral(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer {
        WithdrawCollateralArguments memory args = abi.decode(arguments, (WithdrawCollateralArguments));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, bool isNewAccount) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        if (isNewAccount) {
            _setAutorization(user);
        }
        morpho.withdrawCollateral(args.marketParams, args.assets, user, address(this));
        emit WithdrawCollateral(args.marketParams.id(), args.assets);
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(
            args.marketParams.collateralToken,
            IERC20(args.marketParams.collateralToken).balanceOf(address(this))
        );
        _bridgeTokens(tacHeader, tokensToBridge, "");
    }

    /// @notice Borrows assets from a market
    /// @param tacHeader TAC header data
    /// @param arguments Encoded borrow arguments
    function borrow(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer {
        BorrowArguments memory args = abi.decode(arguments, (BorrowArguments));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, bool isNewAccount) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        if (isNewAccount) {
            _setAutorization(user);
        }
        (uint256 actualAssets, uint256 actualShares) = morpho.borrow(args.marketParams, args.assets, args.shares, user, address(this));
        emit Borrow(args.marketParams.id(), actualAssets, actualShares, args.assets, args.shares);
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(
            args.marketParams.loanToken,
            IERC20(args.marketParams.loanToken).balanceOf(address(this))
        );
        _bridgeTokens(tacHeader, tokensToBridge, "");
    }

    /// @notice Repays a loan in a market
    /// @param tacHeader TAC header data
    /// @param arguments Encoded repay arguments
    function repay(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable _onlyCrossChainLayer {
        RepayArguments memory args = abi.decode(arguments, (RepayArguments));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, bool isNewAccount) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        if (isNewAccount) {
            _setAutorization(user);
        }
        TransferHelper.safeApprove(
            args.marketParams.loanToken,
            address(morpho),
            IERC20(args.marketParams.loanToken).balanceOf(address(this))
        );
        (uint256 actualAssets, uint256 actualShares) = morpho.repay(args.marketParams, args.assets, args.shares, user, "");
        emit Repay(args.marketParams.id(), actualAssets, actualShares, args.assets, args.shares);
        if (IERC20(args.marketParams.loanToken).balanceOf(address(this)) > 0) {
            TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
            tokensToBridge[0] = TokenAmount(
                args.marketParams.loanToken,
                IERC20(args.marketParams.loanToken).balanceOf(address(this))
            );
            _bridgeTokens(tacHeader, tokensToBridge, "");
        }
    }

    

    /// @notice Supplies assets to a market
    /// @param tacHeader TAC header data
    /// @param arguments Encoded supply arguments
    function supply(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable _onlyCrossChainLayer {
        SupplyArguments memory args = abi.decode(arguments, (SupplyArguments));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, bool isNewAccount) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        if (isNewAccount) {
            _setAutorization(user);
        }
        TransferHelper.safeApprove(
            args.marketParams.loanToken,
            address(morpho),
            IERC20(args.marketParams.loanToken).balanceOf(address(this))
        );
        (uint256 actualAssets, uint256 actualShares) = morpho.supply(args.marketParams, args.assets, args.shares, user, "");
        emit Supply(args.marketParams.id(), actualAssets, actualShares, args.assets, args.shares);
    }


    /// @notice Withdraws supplied assets from a market
    /// @param tacHeader TAC header data
    /// @param arguments Encoded withdraw supplied assets arguments
    function withdrawSuppliedAssets(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer {
        WithdrawSuppliedAssetsArguments memory args = abi.decode(arguments, (WithdrawSuppliedAssetsArguments));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, bool isNewAccount) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        if (isNewAccount) {
            _setAutorization(user);
        }
        (uint256 actualAssets, uint256 actualShares) = morpho.withdraw(args.marketParams, args.assets, args.shares, user, args.receiver);
        if (IERC20(args.marketParams.loanToken).balanceOf(address(this)) > 0) {
            TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
            tokensToBridge[0] = TokenAmount(
                args.marketParams.loanToken,
                IERC20(args.marketParams.loanToken).balanceOf(address(this))
            );
            _bridgeTokens(tacHeader, tokensToBridge, "");
        }
        emit WithdrawSuppliedAssets(args.marketParams.id(), actualAssets, actualShares, args.assets, args.shares);
    }

    ///////////////////////////////
    /////// BUNDLED OPERATIONS ////
    ///////////////////////////////

    /// @notice Supplies collateral and borrows assets
    /// @param tacHeader TAC header data
    /// @param arguments Encoded supply collateral and borrow arguments
    function supplyCollateralAndBorrow(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable _onlyCrossChainLayer {
        (SupplyCollateralArguments memory supplyArgs, BorrowArguments memory borrowArgs) = abi.decode(arguments, (SupplyCollateralArguments, BorrowArguments));
        // Supply collateral
        TransferHelper.safeApprove(
            supplyArgs.marketParams.collateralToken,
            address(morpho),
            supplyArgs.assets
        );
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, bool isNewAccount) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        if (isNewAccount) {
            _setAutorization(user);
        }
        morpho.supplyCollateral(supplyArgs.marketParams, supplyArgs.assets, user, "");
        emit SupplyCollateral(supplyArgs.marketParams.id(), supplyArgs.assets);

        // Borrow
        (uint256 actualAssets, uint256 actualShares) = morpho.borrow(borrowArgs.marketParams, borrowArgs.assets, borrowArgs.shares, user, address(this));
        emit Borrow(borrowArgs.marketParams.id(), actualAssets, actualShares, borrowArgs.assets, borrowArgs.shares);
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(
            borrowArgs.marketParams.loanToken,
            IERC20(borrowArgs.marketParams.loanToken).balanceOf(address(this))
        );
        _bridgeTokens(tacHeader, tokensToBridge, "");
    }

    /// @notice Repays a loan and withdraws collateral
    /// @param tacHeader TAC header data
    /// @param arguments Encoded repay and withdraw collateral arguments
    function repayAndWithdrawCollateral(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable _onlyCrossChainLayer {
        (RepayArguments memory repayArgs, WithdrawCollateralArguments memory withdrawArgs) = abi.decode(arguments, (RepayArguments, WithdrawCollateralArguments));
        // Repay
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user, bool isNewAccount) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        if (isNewAccount) {
            _setAutorization(user);
        }
        TransferHelper.safeApprove(
            repayArgs.marketParams.loanToken,
            address(morpho),
            IERC20(repayArgs.marketParams.loanToken).balanceOf(address(this))
        );
        (uint256 actualAssets, uint256 actualShares) = morpho.repay(repayArgs.marketParams, repayArgs.assets, repayArgs.shares, user, "");
        emit Repay(repayArgs.marketParams.id(), actualAssets, actualShares, repayArgs.assets, repayArgs.shares);

        // Withdraw collateral
        morpho.withdrawCollateral(withdrawArgs.marketParams, withdrawArgs.assets, user, address(this));
        emit WithdrawCollateral(withdrawArgs.marketParams.id(), withdrawArgs.assets);


        TokenAmount[] memory tokensToBridge = new TokenAmount[](0);
        if (IERC20(repayArgs.marketParams.loanToken).balanceOf(address(this)) > 0) {
            tokensToBridge = _addTokenToBridge(repayArgs.marketParams.loanToken, tokensToBridge);
        }
        if (IERC20(withdrawArgs.marketParams.collateralToken).balanceOf(address(this)) > 0) {
            tokensToBridge = _addTokenToBridge(withdrawArgs.marketParams.collateralToken, tokensToBridge);
        }
        if (tokensToBridge.length > 0) {
            _bridgeTokens(tacHeader, tokensToBridge, "");
        }
        
    }

    

    ///////////////////////////////
    /////// CREATE FUNCTIONS ///////
    ///////////////////////////////

    /// @notice Creates a new market
    /// @param arguments Encoded create market arguments
    function createMarket(
        bytes calldata ,
        bytes calldata arguments
    ) external _onlyCrossChainLayer {
        CreateMarketArguments memory args = abi.decode(arguments, (CreateMarketArguments));
        morpho.createMarket(args.marketParams);
        emit MarketCreated(args.marketParams.id());
    }

    
    /// @notice Creates a new vault
    /// @param arguments Encoded create vault arguments
    function createVault(
        bytes calldata,
        bytes calldata arguments
    ) external _onlyCrossChainLayer {
        CreateVaultArguments memory args = abi.decode(arguments, (CreateVaultArguments));
        address vault = metaMorphoFactoryV1_1.createMetaMorpho(args.initialOwner, args.initialTimeLock, args.asset, args.name, args.symbol, args.salt);
        emit VaultCreated(vault);
    } 

    ///////////////////////////////
    /////// HELPER FUNCTIONS ///////
    ///////////////////////////////

    /// @notice Sets authorization for a user
    /// @param user Address of the user to authorize
    function _setAutorization(
        address user
    ) private {
        ITacSmartAccount(user).execute(address(morpho),0, abi.encodeWithSelector(IMorpho.setAuthorization.selector, address(this), true));
    }

    /// @notice Bridges tokens to the cross-chain layer
    /// @param tacHeader TAC header data
    /// @param tokens Array of token amounts to bridge
    /// @param payload Additional payload data
    function _bridgeTokens(
        bytes calldata tacHeader,
        TokenAmount[] memory tokens,
        string memory payload
    ) private {
        for (uint256 i = 0; i < tokens.length; i++) {
            TransferHelper.safeApprove(
                tokens[i].evmAddress,
                _getCrossChainLayerAddress(),
                tokens[i].amount
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
            toBridgeNFT: new NFTAmount[](0)
        });

        _sendMessageV1(message, address(this).balance);
    }

    function _addTokenToBridge(address tokenToAdd, TokenAmount[] memory oldInfo) internal view returns (TokenAmount[] memory tokensToBridge) {
        uint256 oldLength = oldInfo.length;
        tokensToBridge = new TokenAmount[](oldLength + 1);
        for (uint256 i = 0; i < oldLength; i++) {
            tokensToBridge[i] = oldInfo[i];
        }
        tokensToBridge[oldLength] = TokenAmount(tokenToAdd, IERC20(tokenToAdd).balanceOf(address(this)));
        return tokensToBridge;
    }

    /// @notice Receives ETH
    receive() external payable {}
}
