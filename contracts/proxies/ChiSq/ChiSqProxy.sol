// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ICrossChainLayer} from "@tonappchain/evm-ccl/contracts/interfaces/ICrossChainLayer.sol";
import {TacProxyV1Upgradeable} from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ISAFactory} from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/ISAFactory.sol";
import {ITacSmartAccount} from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/ITacSmartAccount.sol";
import {OutMessageV1, TokenAmount, TacHeaderV1, NFTAmount} from "@tonappchain/evm-ccl/contracts/core/Structs.sol";
import {IParlayLp} from "./interfaces/IParlayLp.sol";
import {IParlayCore} from "./interfaces/IParlayCore.sol";

contract ChiSqProxy is TacProxyV1Upgradeable, UUPSUpgradeable, Ownable2StepUpgradeable {

    using SafeERC20 for IERC20;

    uint256 private constant MAX_TOKEN_IDS = 15;

    ISAFactory public tacSAFactory;
    IParlayLp public parlayLp;
    IParlayCore public parlayCore;
    address public relayer;
    IERC20 public usdt;

    

    event ClaimedPayout(address indexed user, uint256[] indexed tokenIds, uint256 amount, string  tvmCaller);
    event DepositedToSmartAccount(address indexed user, uint256 amount, string tvmCaller);
    event WithdrawnFromSmartAccount(address indexed user, uint256 amount, string tvmCaller);
    event AddedLiquidity(address indexed user, uint256 amount, string tvmCaller);
    event WithdrawnLiquidity(address indexed user, uint256 amount, string tvmCaller);
    event PlacedBet(address indexed onBehalfOf, uint256 indexed tokenId, uint256 amount, string assetId, uint8 row, uint8 column, uint64 expiresAt, uint256 multiplier);

    error ZeroAmount();
    error NotARelayer(address caller);
    error InvalidOnBehalfOf(uint256 caseIndex);
    error InsufficientBalance();
    error TooManyTokenIds(uint256 tokenIdsLength, uint256 maxTokenIds);

    modifier onlyRelayer() {
        require(msg.sender == relayer, NotARelayer(msg.sender));
        _;
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(address _owner, address crossChainLayer, address _tacSAFactory, address _parlayLp, address _parlayCore, address _relayer, address _usdt) public initializer {
        __TacProxyV1Upgradeable_init(crossChainLayer);
        __Ownable_init(_owner == address(0) ? msg.sender : _owner);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        tacSAFactory = ISAFactory(_tacSAFactory);
        parlayLp = IParlayLp(_parlayLp);
        parlayCore = IParlayCore(_parlayCore);
        relayer = _relayer;
        usdt = IERC20(_usdt);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function addLiquidity(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer {
        uint256 amount = abi.decode(arguments, (uint256));
        require(amount > 0, ZeroAmount());
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        usdt.safeTransfer(user, amount);
        ITacSmartAccount(user).approve(address(usdt), address(parlayLp), amount);
        ITacSmartAccount(user).execute(address(parlayLp), 0, abi.encodeWithSelector(IParlayLp.addLiquidity.selector, amount));
        emit AddedLiquidity(user, amount, header.tvmCaller);
    }

    function withdrawLiquidity(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer {
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        uint256 amount = abi.decode(arguments, (uint256));
        require(amount > 0, ZeroAmount());
        ITacSmartAccount(user).execute(address(parlayLp), 0, abi.encodeWithSelector(IParlayLp.withdrawLiquidity.selector, amount));
        ITacSmartAccount(user).execute(address(usdt), 0, abi.encodeWithSelector(IERC20.transfer.selector, address(this), amount));
        TokenAmount[] memory tokens = new TokenAmount[](1);
        tokens[0] = TokenAmount(address(usdt), amount);
        _bridgeTokens(tacHeader, tokens);
        emit WithdrawnLiquidity(user, amount, header.tvmCaller);
    }

    function claimPayout(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer {
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        (uint256[] memory tokenIds, bool bridgeToTon) = abi.decode(arguments, (uint256[], bool));
        require(tokenIds.length <= MAX_TOKEN_IDS, TooManyTokenIds(tokenIds.length, MAX_TOKEN_IDS));
        for (uint256 i = 0; i < tokenIds.length; i++) {
            ITacSmartAccount(user).execute(address(parlayCore), 0, abi.encodeWithSelector(IParlayCore.claimPayout.selector, tokenIds[i]));
        }
        uint256 amount = usdt.balanceOf(user);
        require(amount > 0, ZeroAmount());
        if (bridgeToTon) {
            ITacSmartAccount(user).execute(address(usdt), 0, abi.encodeWithSelector(IERC20.transfer.selector, address(this), amount));
            TokenAmount[] memory tokens = new TokenAmount[](1);
            tokens[0] = TokenAmount(address(usdt), amount);
            _bridgeTokens(tacHeader, tokens);
        }
        emit ClaimedPayout(user, tokenIds, amount, header.tvmCaller);
    }

    function depositToSmartAccount(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer {
        uint256 amount = abi.decode(arguments, (uint256));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        require(amount > 0, ZeroAmount());
        usdt.safeTransfer(user, amount);
        emit DepositedToSmartAccount(user, amount, header.tvmCaller);
    }

    function withdrawFromSmartAccount(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer {
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = tacSAFactory.getOrCreateSmartAccount(header.tvmCaller);
        uint256 amount = abi.decode(arguments, (uint256));
        require(amount > 0, ZeroAmount());
        ITacSmartAccount(user).execute(address(usdt), 0, abi.encodeWithSelector(IERC20.transfer.selector, address(this), amount));
        TokenAmount[] memory tokens = new TokenAmount[](1);
        tokens[0] = TokenAmount(address(usdt), amount);
        _bridgeTokens(tacHeader, tokens);
        emit WithdrawnFromSmartAccount(user, amount, header.tvmCaller);
    }

    function placeBet(string calldata assetId, uint8 row, uint8 column, uint64 expiresAt, uint256 multiplier, address onBehalfOf, uint256 amount) external onlyRelayer{
        require(onBehalfOf != address(0), InvalidOnBehalfOf(0));
        require((onBehalfOf).code.length > 0, InvalidOnBehalfOf(1));
        require(amount > 0, ZeroAmount());
        require(usdt.balanceOf(onBehalfOf) >= amount, InsufficientBalance());
        ITacSmartAccount(onBehalfOf).approve(address(usdt), address(parlayCore), amount);
        bytes memory returnData = ITacSmartAccount(onBehalfOf).execute(address(parlayCore), 0, abi.encodeWithSelector(IParlayCore.placeBet.selector, assetId, row, column, expiresAt, multiplier, amount));
        uint256 tokenId = abi.decode(returnData, (uint256));
        emit PlacedBet(onBehalfOf, tokenId, amount, assetId, row, column, expiresAt, multiplier);
    }

    /// @notice Bridges tokens to the cross-chain layer
    /// @param tacHeader TAC header data
    function _bridgeTokens(
        bytes calldata tacHeader,
        TokenAmount[] memory tokens
    ) private {
        for (uint256 i = 0; i < tokens.length; i++) {
            SafeERC20.forceApprove(
                IERC20(tokens[i].evmAddress),
                _getCrossChainLayerAddress(),
                tokens[i].amount
            );
        }
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            tvmProtocolFee: 0,
            tvmExecutorFee: 0,
            tvmValidExecutors: new string[](0),
            toBridge: tokens,
            toBridgeNFT: new NFTAmount[](0)
        });

        _sendMessageV1(message, 0);
    }
}