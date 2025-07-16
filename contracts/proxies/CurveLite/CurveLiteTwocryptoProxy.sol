// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import { TransferHelper } from 'contracts/helpers/TransferHelper.sol';
import { TacProxyV1Upgradeable } from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import { OutMessageV1, TokenAmount, NFTAmount, TacHeaderV1 } from "@tonappchain/evm-ccl/contracts/core/Structs.sol";

import { ITwocryptoswapPool } from "contracts/proxies/CurveLite/ICurveLiteTwocryptoswapPool.sol";
import { ITAC } from "contracts/proxies/CurveLite/ITAC.sol";


/**
 * @title CurveLiteTwocryptoswapProxy
 * @dev Proxy contract CurveLite, working with twocryptoswap pools contracts directly
 */
contract CurveLiteTwocryptoswapProxy is TacProxyV1Upgradeable, OwnableUpgradeable, UUPSUpgradeable {

    address internal wtacAddress;
    ITAC wtac;

    /**
     * @dev Initialize the contract.
     */
    function initialize(address adminAddress, address crossChainLayer, address _wtacAddress) public initializer {
        __TacProxyV1Upgradeable_init(crossChainLayer);
        __Ownable_init(adminAddress);
        __UUPSUpgradeable_init();
        wtacAddress = _wtacAddress;
        wtac = ITAC(_wtacAddress);
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
        (address pool, uint256[2] memory amounts, uint256 minMintAmount) =
                abi.decode(arguments, (address, uint256[2], uint256));
        // claim tokens addresses
        address tokenA = ITwocryptoswapPool(pool).coins(0);
        address tokenB = ITwocryptoswapPool(pool).coins(1);

        if (msg.value > 0) {
            if (tokenA == wtacAddress) {
                require(msg.value == amounts[0], "ETH amount does not match amount for tokenA");
                wtac.deposit{value: msg.value}();
            } else if (tokenB == wtacAddress) {
                require(msg.value == amounts[1], "ETH amount does not match amount for tokenB");
                wtac.deposit{value: msg.value}();
            } else {
                revert("No ETH expected for this pool");
            }
        }


        // grant token approvals
        TransferHelper.safeApprove(tokenA, pool, amounts[0]);
        TransferHelper.safeApprove(tokenB, pool, amounts[1]);

        uint liquidity = ITwocryptoswapPool(pool).add_liquidity(
            [amounts[0], amounts[1]],
            minMintAmount
        );

        // bridge LP tokens to TON
        address tokenLiquidity = pool;
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(tokenLiquidity, liquidity);

        TransferHelper.safeApprove(pool, _getCrossChainLayerAddress(), liquidity);

        // CCL TAC->TON callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            tvmProtocolFee: 0,
            tvmExecutorFee: 0,
            tvmValidExecutors: new string[](0),
            toBridge: tokensToBridge,
            toBridgeNFT: new NFTAmount[](0)
        });
        _sendMessageV1(message, 0);
    }

    /**
     * @dev A proxy to removeLiquidity
     */
    function removeLiquidity(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public _onlyCrossChainLayer {
        (address pool, uint256 amount, uint256[2] memory min_amounts) =
                abi.decode(arguments, (address, uint256, uint256[2]));
        // claim tokens addresses
        address tokenA = ITwocryptoswapPool(pool).coins(0);
        address tokenB = ITwocryptoswapPool(pool).coins(1);
        address tokenLiquidity = pool;

        TransferHelper.safeApprove(tokenLiquidity, pool, amount);

        uint256[2] memory amounts = ITwocryptoswapPool(pool).remove_liquidity(
            amount,
            min_amounts
        );

        // bridge tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](2);
        tokensToBridge[0] = TokenAmount(tokenA, amounts[0]);
        tokensToBridge[1] = TokenAmount(tokenB, amounts[1]);

        address crossChainLayer = _getCrossChainLayerAddress();

        // approve tokens to CCL
        TransferHelper.safeApprove(tokenA, crossChainLayer, amounts[0]);
        TransferHelper.safeApprove(tokenB, crossChainLayer, amounts[1]);

        // CCL TAC->TON callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            tvmProtocolFee: 0,
            tvmExecutorFee: 0,
            tvmValidExecutors: new string[](0),
            toBridge: tokensToBridge,
            toBridgeNFT: new NFTAmount[](0)
        });
        _sendMessageV1(message, 0);
    }

    /**
     * @dev A proxy to removeLiquidityOneCoin
     */
    function removeLiquidityOneCoin(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public _onlyCrossChainLayer {
        (address pool, uint256 token_amount, uint256 i, uint256 min_amount) =
                abi.decode(arguments, (address, uint256, uint256, uint256));
        // claim tokens addresses
        address token = ITwocryptoswapPool(pool).coins(i);
        address tokenLiquidity = pool;

        TransferHelper.safeApprove(tokenLiquidity, pool, token_amount);

        uint256 amount = ITwocryptoswapPool(pool).remove_liquidity_one_coin(
            token_amount,
            i,
            min_amount
        );

        // bridge tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(token, amount);

        address crossChainLayer = _getCrossChainLayerAddress();

        // approve tokens to CCL
        TransferHelper.safeApprove(token, crossChainLayer, amount);

        // CCL TAC->TON callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            tvmProtocolFee: 0,
            tvmExecutorFee: 0,
            tvmValidExecutors: new string[](0),
            toBridge: tokensToBridge,
            toBridgeNFT: new NFTAmount[](0)
        });
        _sendMessageV1(message, 0);
    }

    /**
     * @dev A proxy to exchange
     */
    function exchange(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public payable _onlyCrossChainLayer {
        (address pool, uint256 i, uint256 j, uint256 dx, uint256 min_dy) =
                abi.decode(arguments, (address, uint256, uint256, uint256, uint256));
        // claim tokens addresses
        address tokenIn = ITwocryptoswapPool(pool).coins(i);
        address tokenOut = ITwocryptoswapPool(pool).coins(j);

        if (msg.value > 0) {
            if (tokenIn == wtacAddress) {
                require(msg.value == dx, "ETH amount does not match amount for tokenIN");
                wtac.deposit{value: msg.value}();
            } else {
                revert("No ETH expected for this pool");
            }
        }

        // grant token approvals
        TransferHelper.safeApprove(tokenIn, pool, dx);

        uint256 amountOut = ITwocryptoswapPool(pool).exchange(
            i,
            j,
            dx,
            min_dy
        );

        // bridge tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(tokenOut, amountOut);

        TransferHelper.safeApprove(tokenOut, _getCrossChainLayerAddress(), amountOut);

        // CCL TAC->TON callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            tvmProtocolFee: 0,
            tvmExecutorFee: 0,
            tvmValidExecutors: new string[](0),
            toBridge: tokensToBridge,
            toBridgeNFT: new NFTAmount[](0)
        });
        _sendMessageV1(message, 0);
    }
}
