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
        console.log(sttonEVMAddress, tacEVMAddress);
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
        const tokenX = sttonEVMAddress > tacEVMAddress ? tacEVMAddress : sttonEVMAddress;
        const tokenY = sttonEVMAddress > tacEVMAddress ? sttonEVMAddress : tacEVMAddress;
        const amountX = tokenX === sttonEVMAddress ? ethers.parseUnits("1", sttonTokenInfo.decimals) : ethers.parseUnits("1", tacTokenInfo.decimals);
        const amountY = tokenY === sttonEVMAddress ? ethers.parseUnits("1", sttonTokenInfo.decimals) : ethers.parseUnits("1", tacTokenInfo.decimals);
        
        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,address,address,uint24,int24,int24,uint128,uint128,uint128,uint128,uint256)'],
            [[
                target, // miner
                tokenX,
                tokenY, // tokenX
                fee, // fee
                leftPoint, // pl (leftPoint)
                rightPoint,  // pr (rightPoint)
                amountX, // xLim
                amountY, // yLim
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
        console.log(sttonEVMAddress, tacEVMAddress, initialPoolAddress);
        
        const stTon = new ethers.Contract(sttonEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        const tac = new ethers.Contract(tacEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
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
        console.log(await tac.balanceOf(initialPoolAddress), await stTon.balanceOf(initialPoolAddress));
        console.log(sttonEVMAddress > tacEVMAddress);
        

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
        console.log(await tac.balanceOf(initialPoolAddress), await stTon.balanceOf(initialPoolAddress));

        const liquidityInfoAfter = await liquidityManager.liquidities(6n);
        expect(liquidityInfoAfter.liquidity).to.be.gt(liquidityInfoBefore.liquidity);
        console.log(liquidityInfoAfter);
    });


    it("Izumi test swap Y2X and X2Y", async function () {
        const shardsKey = 4n;
        const operationIdYToX = ethers.encodeBytes32String("swap y to x");
        const operationIdXToY = ethers.encodeBytes32String("swap x to y");
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await izumiProxy.getAddress();
        const methodNameYToX = "swapY2X(bytes,bytes)";
        const methodNameXToY = "swapX2Y(bytes,bytes)";

        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);
        
        
        const poolAddress = await pool.pool(sttonEVMAddress, tacEVMAddress, 3000);
        const poolContract = new ethers.Contract(poolAddress, IzumiPoolAbi, admin);
        
        const amount = ethers.parseEther("0.1"); // Smaller amount for testing
        const stTon = new ethers.Contract(sttonEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        const tac = new ethers.Contract(tacEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        const tokenX = sttonEVMAddress > tacEVMAddress ? tacEVMAddress : sttonEVMAddress;
        const tokenY = sttonEVMAddress > tacEVMAddress ? sttonEVMAddress : tacEVMAddress;

        await swapToken2Token(tokenX, tokenY, 3000, 214200n, ethers.parseUnits("0.1", tacTokenInfo.decimals), target, shardsKey, operationIdYToX, methodNameYToX, tvmWalletCaller, testSdk);

        await swapToken2Token(tokenX, tokenY, 3000, 207240n, ethers.parseUnits("0.1", sttonTokenInfo.decimals), target, shardsKey, operationIdXToY, methodNameXToY, tvmWalletCaller, testSdk);
        
        
        const finalState = await poolContract.state();
        console.log(await tac.balanceOf(poolAddress), await stTon.balanceOf(poolAddress));
        // expect(finalState.currentPoint).to.not.equal(initialState.currentPoint);
        // expect(finalState.liquidity).to.equal(initialLiquidity);
    });

    it("Izumi test swap amount through path", async function () {
        const shardsKey = 6n;
        const operationId = ethers.encodeBytes32String("swap amount");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await izumiProxy.getAddress();
        const methodName = "swapAmount(bytes,bytes)";

        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);

        // Create path bytes: tokenX -> tokenY with fee
        const path = ethers.concat([
            ethers.zeroPadValue(sttonEVMAddress, 20),
            ethers.zeroPadValue(ethers.toBeHex(3000), 3),
            ethers.zeroPadValue(tacEVMAddress, 20)
        ]);
        console.log(path);
        

        const amount = ethers.parseUnits("0.1", tacTokenInfo.decimals);
        const minAcquired = 0; // No minimum amount requirement for test

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(bytes,address,uint128,uint256,uint256)'],
            [[
                path,           // path
                target,         // recipient
                amount,         // amount
                minAcquired,   // minAcquired
                ethers.MaxUint256 // deadline
            ]]
        );

        // Get initial balances
        const stTon = new ethers.Contract(sttonEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        const tac = new ethers.Contract(tacEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        const poolAddress = await pool.pool(sttonEVMAddress, tacEVMAddress, 3000);
        
        const initialStTonBalance = await stTon.balanceOf(poolAddress);
        const initialTacBalance = await tac.balanceOf(poolAddress);

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

        // Verify balances changed
        const finalStTonBalance = await stTon.balanceOf(poolAddress);
        const finalTacBalance = await tac.balanceOf(poolAddress);

        expect(finalStTonBalance).to.be.gt(initialStTonBalance);
        expect(finalTacBalance).to.be.lt(initialTacBalance);

        // // Verify output message
        // expect(outMessages.length).to.equal(1);
        // const outMessage = outMessages[0] as any; // Type assertion for bridge info
        // expect(outMessage.toBridge.length).to.equal(1);
        // expect(outMessage.toBridge[0].l2Address).to.equal(tacEVMAddress);
    });

    it("Izumi test swap X2Y with desired Y amount", async function () {
        const shardsKey = 7n;
        const operationId = ethers.encodeBytes32String("swap x to y with desired y");
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await izumiProxy.getAddress();
        const methodName = "swapX2YDesireY(bytes,bytes)";

        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);
        
        const poolAddress = await pool.pool(sttonEVMAddress, tacEVMAddress, 3000);
        const poolContract = new ethers.Contract(poolAddress, IzumiPoolAbi, admin);
        
        const amount = ethers.parseUnits("0.001", sttonEVMAddress > tacEVMAddress ? sttonTokenInfo.decimals : tacTokenInfo.decimals);
        const stTon = new ethers.Contract(sttonEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        const tac = new ethers.Contract(tacEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        const tokenX = sttonEVMAddress > tacEVMAddress ? tacEVMAddress : sttonEVMAddress;
        const tokenY = sttonEVMAddress > tacEVMAddress ? sttonEVMAddress : tacEVMAddress;

        // Get initial balances
        const initialStTonBalance = await stTon.balanceOf(poolAddress);
        const initialTacBalance = await tac.balanceOf(poolAddress);

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,address,uint24,int24,address,uint128,uint256,uint256,uint256)'],
            [[
                tokenX,
                tokenY,
                3000,           // fee
                207240n,        // point
                target,         // recipient
                amount,         // amount
                0,             // maxPayed
                0,             // minAcquired
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
            "0x",
            operationId,
            BigInt(Math.floor(Date.now() / 1000))
        );

        // Verify balances changed
        const finalStTonBalance = await stTon.balanceOf(poolAddress);
        const finalTacBalance = await tac.balanceOf(poolAddress);

        expect(finalStTonBalance).to.be.lt(initialStTonBalance);
        expect(finalTacBalance).to.be.gt(initialTacBalance);
    });

    it("Izumi test swap Y2X with desired X amount", async function () {
        const shardsKey = 8n;
        const operationId = ethers.encodeBytes32String("swap y to x with desired x");
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await izumiProxy.getAddress();
        const methodName = "swapY2XDesireX(bytes,bytes)";

        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);
        
        const poolAddress = await pool.pool(sttonEVMAddress, tacEVMAddress, 3000);
        const poolContract = new ethers.Contract(poolAddress, IzumiPoolAbi, admin);
        
        const amount = ethers.parseUnits("0.001", sttonEVMAddress > tacEVMAddress ? sttonTokenInfo.decimals : tacTokenInfo.decimals);
        const stTon = new ethers.Contract(sttonEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        const tac = new ethers.Contract(tacEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        const tokenX = sttonEVMAddress > tacEVMAddress ? tacEVMAddress : sttonEVMAddress;
        const tokenY = sttonEVMAddress > tacEVMAddress ? sttonEVMAddress : tacEVMAddress;

        // Get initial balances
        const initialStTonBalance = await stTon.balanceOf(poolAddress);
        const initialTacBalance = await tac.balanceOf(poolAddress);

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,address,uint24,int24,address,uint128,uint256,uint256,uint256)'],
            [[
                tokenX,
                tokenY,
                3000,           // fee
                214200n,        // point
                target,         // recipient
                amount,         // amount
                0,             // maxPayed
                0,             // minAcquired
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
            "0x",
            operationId,
            BigInt(Math.floor(Date.now() / 1000))
        );

        // Verify balances changed
        const finalStTonBalance = await stTon.balanceOf(poolAddress);
        const finalTacBalance = await tac.balanceOf(poolAddress);

        expect(finalStTonBalance).to.be.gt(initialStTonBalance);
        expect(finalTacBalance).to.be.lt(initialTacBalance);
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

async function swapToken2Token(tokenX : string, tokenY : string, fee : number, point : bigint, amount : bigint, target : string, shardsKey : bigint, operationId : string, methodName : string, tvmWalletCaller : string, testSdk : TacLocalTestSdk){
    const encodedArguments = new ethers.AbiCoder().encode(
        ['tuple(address,address,uint24,int24,address,uint128,uint256,uint256,uint256)'],
        [[
            tokenX,
            tokenY,
            fee,           // fee
            point,  // point
            target,         // recipient
            amount,         // amount
            0,      // minAcquired
            0,             // limitPoint
            ethers.MaxUint256 // deadline
        ]]
    );

    const mintTokens: TokenMintInfo[] = [{
        info: tacTokenInfo,
        mintAmount: amount
    }, {
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
        "0x",
        operationId,
        BigInt(Math.floor(Date.now() / 1000))
    );
}
