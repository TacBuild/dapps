import hre, { ethers } from "hardhat";
import { AddressLike, BytesLike, Signer } from "ethers";
import { expect } from "chai";

import { deployIzumiProxy } from "../scripts/Izumi/deployIzumiProxy";
import { izumiTestnetConfig } from "../scripts/Izumi/config/testnetConfig";
import { TacLocalTestSdk, TokenMintInfo } from "tac-l2-ccl";
import { sttonTokenInfo, tacTokenInfo } from '../scripts/common/info/tokensInfo';
import { IzumiPoolAbi } from "./abis/IzumiPool";
import { ERC20 } from "tac-l2-ccl/dist/typechain-types";
import { IzumiProxy, IPool, ISwap, ILimitOrderManager, ILiquidityManager } from "../typechain-types";
// import { getPoolAddress, getLiquidityManagerContract } from 'iziswap-sdk/src/liquidityManager/view';
// import { getPointDelta, getPoolContract, getPoolState } from 'iziswap-sdk/src/pool/funcs';
// import { pointDeltaRoundingDown, pointDeltaRoundingUp, priceDecimal2Point } from 'iziswap-sdk/src/base/price';
// import {BaseChain, ChainId, initialChainTable, PriceRoundingType} from 'iziswap-sdk/src/base/types'
// import poolAbi from 'iziswap-sdk/src/pool/poolAbi.json'

describe("IzumiProxy", function () {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;

    let izumiProxy: IzumiProxy;
    let pool: IPool;
    let swap: ISwap;
    let limitOrderManager: ILimitOrderManager;
    let liquidityManager: ILiquidityManager;

    let sttonToken: ERC20;
    let tacToken: ERC20;

    before(async function () {
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        izumiProxy = await deployIzumiProxy(admin, izumiTestnetConfig, crossChainLayerAddress);
        
        pool = new ethers.Contract(izumiTestnetConfig.poolAddress, hre.artifacts.readArtifactSync('IPool').abi, admin) as unknown as IPool;
        swap = new ethers.Contract(izumiTestnetConfig.swapAddress, hre.artifacts.readArtifactSync('ISwap').abi, admin) as unknown as ISwap;
        limitOrderManager = new ethers.Contract(izumiTestnetConfig.limitOrderAddress, hre.artifacts.readArtifactSync('ILimitOrderManager').abi, admin) as unknown as ILimitOrderManager;
        liquidityManager = new ethers.Contract(izumiTestnetConfig.liquidityManagerAddress, hre.artifacts.readArtifactSync('ILiquidityManager').abi, admin) as unknown as ILiquidityManager;
    });

    it("Izumi test create new pool", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("create new pool");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await izumiProxy.getAddress();
        const methodName = "newPool(bytes,bytes)";

        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);

        const fee = 3000;
        const currentPoint = 0;

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,address,uint24,int24)'],
            [[
                sttonEVMAddress,
                tacEVMAddress,
                fee,
                currentPoint
            ]]
        );

        // Get initial pool address
        const initialPoolAddress = await pool.pool(sttonEVMAddress, tacEVMAddress, fee);
        expect(initialPoolAddress).to.equal(ethers.ZeroAddress);

        const {receipt, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [],
            [],
            0n,
            extraData,
            operationId,
            timestamp
        );

        // Verify pool creation
        const newPoolAddress = await pool.pool(sttonEVMAddress, tacEVMAddress, fee);
        expect(newPoolAddress).to.not.equal(ethers.ZeroAddress);

        // Verify point delta for fee
        const pointDelta = await pool.fee2pointDelta(fee);
        expect(pointDelta).to.not.equal(0);
    });

    it("Izumi test mint", async function () {
        const shardsKey = 2n;
        const operationId = ethers.encodeBytes32String("mint");
        const extraData = "0x";
        
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await izumiProxy.getAddress();
        const methodName = "mint(bytes,bytes)";

        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);

        const fee = 3000;
        const amount = ethers.parseEther("1");
        const newPoolAddress = await pool.pool(sttonEVMAddress, tacEVMAddress, fee);

        const poolContract = new ethers.Contract(newPoolAddress, IzumiPoolAbi, admin);

        
        const priceUndecimalXByY = BigInt(1) * BigInt(10n ** BigInt(tacTokenInfo.decimals)) / BigInt(10n ** BigInt(sttonTokenInfo.decimals))
        let point1 = Math.log(Number(priceUndecimalXByY)) / Math.log(1.0001)
        point1 = Math.round(point1)

        const priceUndecimalXByY2 = BigInt(2) * BigInt(10n ** BigInt(tacTokenInfo.decimals)) / BigInt(10n ** BigInt(sttonTokenInfo.decimals))
        let point2 = Math.log(Number(priceUndecimalXByY2)) / Math.log(1.0001)
        point2 = Math.round(point2)

        const pointDelta = await poolContract.pointDelta()

        const leftPoint = pointDeltaRoundingDown(Number(Math.min(point1, point2)), Number(pointDelta))
        const rightPoint = pointDeltaRoundingUp(Number(Math.max(point1, point2)), Number(pointDelta))
        
        console.log(leftPoint, rightPoint);
        
        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,address,address,uint24,int24,int24,uint128,uint128,uint128,uint128,uint256)'],
            [[
                target, // miner
                tacEVMAddress,
                sttonEVMAddress, // tokenX
                fee, // fee
                leftPoint, // pl (leftPoint)
                rightPoint,  // pr (rightPoint)
                amount, // xLim
                amount, // yLim
                0n, // amountXMin
                0n, // amountYMin
                ethers.MaxUint256 // deadline
            ]]
        );

        const mintTokens: TokenMintInfo[] = [
            {
                info: sttonTokenInfo,
                mintAmount: amount
            },
            {
                info: tacTokenInfo,
                mintAmount: amount
            }
        ];

        const {receipt, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            mintTokens,
            [],
            0n,
            extraData,
            operationId,
            timestamp
        );

        const poolAddress = await pool.pool(sttonEVMAddress, tacEVMAddress, fee);
        const liquidityInfo = await liquidityManager.liquidities(6n);        
        expect(liquidityInfo.liquidity).to.be.gt(0);
    });

    it("Izumi test add liquidity", async function () {
        const shardsKey = 3n;
        const operationId = ethers.encodeBytes32String("add liquidity");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await izumiProxy.getAddress();
        const methodName = "addLiquidity(bytes,bytes)";

        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);
        const initialPoolAddress = await pool.pool(sttonEVMAddress, tacEVMAddress, 3000);
        console.log(initialPoolAddress);
        
        const amount = ethers.parseEther("1");
        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(uint256,uint128,uint128,uint128,uint128,uint256)'],
            [[
                6, // lid
                amount, // xLim
                amount, // yLim
                0, // amountXMin
                0, // amountYMin
                ethers.MaxUint256 // deadline
            ]]
        );

        const mintTokens: TokenMintInfo[] = [
            {
                info: sttonTokenInfo,
                mintAmount: amount
            },
            {
                info: tacTokenInfo,
                mintAmount: amount
            }
        ];
        const liquidityInfoBefore = await liquidityManager.liquidities(6n);

        const {receipt, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            mintTokens,
            [],
            0n,
            extraData,
            operationId,
            timestamp
        );

        const liquidityInfoAfter = await liquidityManager.liquidities(6n);
        expect(liquidityInfoAfter.liquidity).to.be.gt(liquidityInfoBefore.liquidity);
        console.log(liquidityInfoAfter);
    });

    it("Izumi test swap Y to X", async function () {
        const shardsKey = 4n;
        const operationId = ethers.encodeBytes32String("swap y to x");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await izumiProxy.getAddress();
        const methodName = "swapY2X(bytes,bytes)";

        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);
        const poolAddress = await pool.pool(sttonEVMAddress, tacEVMAddress, 3000);
        const poolContract = new ethers.Contract(poolAddress, IzumiPoolAbi, admin);

        // Get initial state
        const initialState = await poolContract.state();
        // const initialLiquidity = await poolContract.liquidity();
        console.log(initialState.currentPoint);
        
        const amount = ethers.parseEther("0.1"); // Smaller amount for testing
        const minAmount = 0n; // No minimum amount requirement for test

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,address,uint24,int24,address,uint128,uint256,uint256,uint256)'],
            [[
                sttonEVMAddress, // tokenX
                tacEVMAddress,   // tokenY
                3000,           // fee
                214200n,  // point
                target,         // recipient
                amount,         // amount
                ethers.parseEther("0.00000000001"),      // minAcquired
                0,             // limitPoint
                ethers.MaxUint256 // deadline
            ]]
        );

        const mintTokens: TokenMintInfo[] = [{
            info: tacTokenInfo,
            mintAmount: amount
        }];

        const {receipt, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            mintTokens,
            [],
            0n,
            extraData,
            operationId,
            timestamp
        );

        // Verify the swap
        const finalState = await poolContract.state();
        expect(finalState.currentPoint).to.not.equal(initialState.currentPoint);
        // expect(finalState.liquidity).to.equal(initialLiquidity);
    });

    it("Izumi test swap X to Y", async function () {
        const shardsKey = 5n;
        const operationId = ethers.encodeBytes32String("swap x to y");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await izumiProxy.getAddress();
        const methodName = "swapX2Y(bytes,bytes)";

        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);
        const poolAddress = await pool.pool(sttonEVMAddress, tacEVMAddress, 3000);
        const poolContract = new ethers.Contract(poolAddress, IzumiPoolAbi, admin);

        // Get initial state
        const initialState = await poolContract.state();
        // const initialLiquidity = await poolContract.liquidity();

        const amount = ethers.parseEther("0.1"); // Smaller amount for testing
        const minAmount = 0n; // No minimum amount requirement for test

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,address,uint24,int24,address,uint128,uint256,uint256,uint256)'],
            [[
                sttonEVMAddress, // tokenX
                tacEVMAddress,   // tokenY
                3000,           // fee
                214200n,  // point
                target,         // recipient
                amount,         // amount
                ethers.parseEther("0.00000000001"),      // minAcquired
                0,             // limitPoint
                ethers.MaxUint256 // deadline
            ]]
        );

        const mintTokens: TokenMintInfo[] = [{
            info: sttonTokenInfo,
            mintAmount: amount
        }];

        const {receipt, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            mintTokens,
            [],
            0n,
            extraData,
            operationId,
            timestamp
        );

        // Verify the swap
        const finalState = await poolContract.state();
        expect(finalState.currentPoint).to.not.equal(initialState.currentPoint);
        // expect(finalState.liquidity).to.equal(initialLiquidity);
    });

});

export const pointDeltaRoundingUp = (point: number, pointDelta: number) : number => {
    let mod = point % pointDelta
    if (mod < 0) {
        mod += pointDelta
    }
    if (mod === 0) {
        return point
    } else {
        return point + pointDelta - mod
    }
}

export const pointDeltaRoundingDown = (point: number, pointDelta: number) : number => {
    let mod = point % pointDelta
    if (mod < 0) {
        mod += pointDelta
    }
    if (mod === 0) {
        return point
    } else {
        return point - mod
    }
}
