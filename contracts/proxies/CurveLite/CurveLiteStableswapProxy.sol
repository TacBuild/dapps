// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { TacProxyV1Upgradeable } from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import { OutMessageV1, TokenAmount, NFTAmount, TacHeaderV1 } from "@tonappchain/evm-ccl/contracts/core/Structs.sol";
import { IStableswapPool } from "contracts/proxies/CurveLite/ICurveLiteStableswapPool.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ITacSmartAccount } from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/ITacSmartAccount.sol";
import { ISAFactory } from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/ISAFactory.sol";
import { IWTAC } from "@tonappchain/evm-ccl/contracts/interfaces/IWTAC.sol";

struct AddLiquidityArguments {
    address pool;
    uint256[] amounts;
    uint256 minMintAmount;
}

struct RemoveLiquidityArguments {
    address pool;
    uint256 amount;
    uint256[] min_amounts;
}

struct ExchangeArguments {
    address pool;
    int128 i;
    int128 j;
    uint256 dx;
    uint256 min_dy;
}

struct RemoveLiquidityOneCoinArguments {
    address pool;
    uint256 burn_amount;
    int128 i;
    uint256 min_received;
}




/**
 * @title CurveLiteStableswapProxy
 * @dev Proxy contract CurveLite, working with Stableswap pools contracts directly
 */
contract CurveLiteStableswapProxy is TacProxyV1Upgradeable, Ownable2StepUpgradeable, UUPSUpgradeable {
    ISAFactory internal _smartAccountFactory;
    address internal wtacAddress;
    address internal constant _ETH_ADDRESS_ = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    error ValueAndAmountInMismatch();
    error ETHTransferFailed();

    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the contract.
     */
    function initialize(address adminAddress, address crossChainLayer, address smartAccountFactory) public initializer {
        __TacProxyV1Upgradeable_init(crossChainLayer);
        __Ownable_init(adminAddress);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        _smartAccountFactory = ISAFactory(smartAccountFactory);
    }

    function setWTACAddress(address _wtacAddress) external onlyOwner {
        require(wtacAddress == address(0), "WTAC already inited");
        wtacAddress = _wtacAddress;
    }

    /**
     * @dev Upgrades the contract.
     */
    function _authorizeUpgrade(address) internal override onlyOwner {}



    /**
     * @dev A proxy to addLiquidity
     */
    function addLiquidity(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public payable _onlyCrossChainLayer {
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = _smartAccountFactory.getOrCreateSmartAccount(header.tvmCaller);
        AddLiquidityArguments memory args = abi.decode(arguments, (AddLiquidityArguments));
        uint256 coinsNum = IStableswapPool(args.pool).N_COINS();
        address[] memory tokens = new address[](coinsNum);
        require(coinsNum == args.amounts.length, "amounts len is not equal to pool coins num");
        for(uint i = 0; i < coinsNum; i++){
            tokens[i] = IStableswapPool(args.pool).coins(i);
            if ((tokens[i] == wtacAddress && msg.value > 0) ){
                require(msg.value == args.amounts[i], "TAC amount does not match amount for token");
                IWTAC(wtacAddress).deposit{value: msg.value}();
            }
            SafeERC20.safeTransfer(IERC20(tokens[i]), user, args.amounts[i]);
            ITacSmartAccount(payable(user)).approve(tokens[i], args.pool, args.amounts[i]);
        }

        bytes memory outData = ITacSmartAccount(user).execute(args.pool, 0, abi.encodeWithSelector(IStableswapPool.add_liquidity.selector, args.amounts, args.minMintAmount));

        (uint liquidity) = abi.decode(outData, (uint));

        ITacSmartAccount(payable(user)).execute(args.pool, 0, abi.encodeWithSelector(IERC20.transfer.selector, address(this), liquidity));

        // bridge LP tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(args.pool, liquidity);

        _bridgeTokens(tacHeader, tokensToBridge, "", 0);
    }

    /**
     * @dev A proxy to removeLiquidity
     */
    function removeLiquidity(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public _onlyCrossChainLayer {
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = _smartAccountFactory.getOrCreateSmartAccount(header.tvmCaller);
        RemoveLiquidityArguments memory args = abi.decode(arguments, (RemoveLiquidityArguments));
        SafeERC20.safeTransfer(IERC20(args.pool), user, args.amount);
        ITacSmartAccount(payable(user)).approve(args.pool, args.pool, args.amount);
        bytes memory data = abi.encodeWithSelector(IStableswapPool.remove_liquidity.selector, args.amount, args.min_amounts);
        bytes memory outData = ITacSmartAccount(payable(user)).execute(args.pool, 0, data);
        (uint256[] memory amounts) = abi.decode(outData, (uint256[]));
        uint256 coinsNum = IStableswapPool(args.pool).N_COINS();
        uint256 nativeTacAmount = 0;

        TokenAmount[] memory tempTokens = new TokenAmount[](coinsNum);
        uint256 count = 0;

        for(uint i = 0; i < coinsNum; i++){
            address token = IStableswapPool(args.pool).coins(i);
            ITacSmartAccount(payable(user)).execute(token, 0, abi.encodeWithSelector(IERC20.transfer.selector, address(this), amounts[i]));
            if ((token == wtacAddress) ){
                IWTAC(wtacAddress).withdraw(amounts[i]);
                nativeTacAmount += amounts[i];
            } else {
                tempTokens[count] = TokenAmount(token, amounts[i]);
                count++;
            }
        }

        TokenAmount[] memory tokensToBridge = new TokenAmount[](count);
        for (uint i = 0; i < count; i++) {
            tokensToBridge[i] = tempTokens[i];
        }

        _bridgeTokens(tacHeader, tokensToBridge, "", 0);
    }

    /**
     * @dev A proxy to removeLiquidity
     */
    function remove_liquidity_one_coin(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public _onlyCrossChainLayer {
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = _smartAccountFactory.getOrCreateSmartAccount(header.tvmCaller);
        RemoveLiquidityOneCoinArguments memory args = abi.decode(arguments, (RemoveLiquidityOneCoinArguments));
        SafeERC20.safeTransfer(IERC20(args.pool), user, args.burn_amount);
        ITacSmartAccount(payable(user)).approve(args.pool, args.pool, args.burn_amount);
        bytes memory data = abi.encodeWithSelector(IStableswapPool.remove_liquidity_one_coin.selector, args.burn_amount, args.i, args.min_received);
        bytes memory outData = ITacSmartAccount(payable(user)).execute(args.pool, 0, data);
        (uint256 amount) = abi.decode(outData, (uint256));

        
        address token = IStableswapPool(args.pool).coins(uint256(uint128(args.i)));
        ITacSmartAccount(payable(user)).execute(token, 0, abi.encodeWithSelector(IERC20.transfer.selector, address(this), amount));

        if (token == wtacAddress ){
            IWTAC(wtacAddress).withdraw(amount);
            _bridgeTokens(tacHeader, new TokenAmount[](0), "", amount);
        } else {
            TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
            tokensToBridge[0] = TokenAmount(token, amount);
            _bridgeTokens(tacHeader, new TokenAmount[](0), "", amount);
        }
    }

    /**
     * @dev A proxy to exchange
     */
    function exchange(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public _onlyCrossChainLayer {
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = _smartAccountFactory.getOrCreateSmartAccount(header.tvmCaller);

        ExchangeArguments memory args = abi.decode(arguments, (ExchangeArguments));
        // claim tokens addresses
        address tokenIn = IStableswapPool(args.pool).coins(uint256(uint128(args.i)));
        address tokenOut = IStableswapPool(args.pool).coins(uint256(uint128(args.j)));

        SafeERC20.safeTransfer(IERC20(tokenIn), user, args.dx);
        ITacSmartAccount(payable(user)).approve(tokenIn, args.pool, args.dx);
        bytes memory data = abi.encodeWithSelector(IStableswapPool.exchange.selector, args.i, args.j, args.dx, args.min_dy);
        bytes memory outData = ITacSmartAccount(payable(user)).execute(args.pool, 0, data);
        (uint256 amountOut) = abi.decode(outData, (uint));
        ITacSmartAccount(payable(user)).execute(tokenOut, 0, abi.encodeWithSelector(IERC20.transfer.selector, address(this), amountOut));

        

        // bridge tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(tokenOut, amountOut);

        _bridgeTokens(tacHeader, tokensToBridge, "", 0);
    }


    /// @notice Bridges tokens to the cross-chain layer
    /// @param tacHeader TAC header data
    /// @param tokens Array of token amounts to bridge
    /// @param payload Additional payload data
    function _bridgeTokens(
        bytes calldata tacHeader,
        TokenAmount[] memory tokens,
        string memory payload,
        uint256 nativeTacAmount
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
            tvmPayload: payload,
            tvmProtocolFee: 0,
            tvmExecutorFee: 0,
            tvmValidExecutors: new string[](0),
            toBridge: tokens,
            toBridgeNFT: new NFTAmount[](0)
        });

        _sendMessageV1(message, nativeTacAmount);
    }

    function containsToken(address[] memory tokens, address tokenToFind) internal pure returns (bool) {
        for (uint i = 0; i < tokens.length; i++) {
            if (tokens[i] == tokenToFind) {
                return true;
            }
        }
        return false;
    }


    receive() external payable {}
}
