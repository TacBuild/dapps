// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import { TransferHelper } from 'contracts/helpers/TransferHelper.sol';
import { TacProxyV1Upgradeable } from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import { OutMessageV1, TokenAmount, NFTAmount, TacHeaderV1 } from "@tonappchain/evm-ccl/contracts/core/Structs.sol";

import { ITricryptoswapPool } from "contracts/proxies/CurveLite/ICurveLiteTricryptoswapPool.sol";


/**
 * @title CurveLiteTricryptoswapProxy
 * @dev Proxy contract CurveLite, working with tricryptoswap pools contracts directly
 */
contract CurveLiteTricryptoswapProxy is TacProxyV1Upgradeable, OwnableUpgradeable, UUPSUpgradeable {
  
    /**
     * @dev Initialize the contract.
     */
    function initialize(address adminAddress, address crossChainLayer) public initializer {
        __TacProxyV1Upgradeable_init(crossChainLayer);
        __Ownable_init(adminAddress);
        __UUPSUpgradeable_init();
        
    }

    /**
     * @dev Upgrades the contract.
     */
    function _authorizeUpgrade(address) internal override onlyOwner {}


    /**
     * @dev A proxy to addLiquidity
     * @param tacHeader TacHeaderV1 struct containing the header information
     * @param arguments arguments data
     */
    function addLiquidity(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public _onlyCrossChainLayer {
        (address pool, uint256[3] memory amounts, uint256 minMintAmount) =
                abi.decode(arguments, (address, uint256[3], uint256));
        // claim tokens addresses
        address tokenA = ITricryptoswapPool(pool).coins(0);
        address tokenB = ITricryptoswapPool(pool).coins(1);
        address tokenC = ITricryptoswapPool(pool).coins(2);
        // grant token approvals
        TransferHelper.safeApprove(tokenA, pool, amounts[0]);
        TransferHelper.safeApprove(tokenB, pool, amounts[1]);
        TransferHelper.safeApprove(tokenC, pool, amounts[2]);

        uint liquidity = ITricryptoswapPool(pool).add_liquidity(
            [amounts[0], amounts[1], amounts[2]],
            minMintAmount
        );

        // bridge LP tokens to TON
        address tokenLiquidity = pool;
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(tokenLiquidity, liquidity);

        // approve LP tokens to CCL
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
        (address pool, uint256 amount, uint256[3] memory min_amounts) =
                abi.decode(arguments, (address, uint256, uint256[3]));
        // claim tokens addresses
        address tokenA = ITricryptoswapPool(pool).coins(0);
        address tokenB = ITricryptoswapPool(pool).coins(1);
        address tokenC = ITricryptoswapPool(pool).coins(2);
        address tokenLiquidity = pool;

        TransferHelper.safeApprove(tokenLiquidity, pool, amount);

        uint256[3] memory amounts = ITricryptoswapPool(pool).remove_liquidity(
            amount,
            min_amounts
        );

        // bridge tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](3);
        tokensToBridge[0] = TokenAmount(tokenA, amounts[0]);
        tokensToBridge[1] = TokenAmount(tokenB, amounts[1]);
        tokensToBridge[2] = TokenAmount(tokenC, amounts[2]);

        address crossChainLayerAddress = _getCrossChainLayerAddress();

        TransferHelper.safeApprove(tokenA, crossChainLayerAddress, amounts[0]);
        TransferHelper.safeApprove(tokenB, crossChainLayerAddress, amounts[1]);
        TransferHelper.safeApprove(tokenC, crossChainLayerAddress, amounts[2]);

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
    ) public _onlyCrossChainLayer {
        (address pool, uint256 i, uint256 j, uint256 dx, uint256 min_dy) =
                abi.decode(arguments, (address, uint256, uint256, uint256, uint256));
        // claim tokens addresses
        address tokenIn = ITricryptoswapPool(pool).coins(i);
        address tokenOut = ITricryptoswapPool(pool).coins(j);

        // grant token approvals
        TransferHelper.safeApprove(tokenIn, pool, dx);

        uint256 amountOut = ITricryptoswapPool(pool).exchange(
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
