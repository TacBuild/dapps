import hre, { ethers } from "hardhat";
import { AddressLike, BytesLike, Signer } from "ethers";
import { expect } from "chai";

import { deployIzumiProxy } from "../scripts/Izumi/deployIzumiProxy";
import { izumiTestnetConfig } from "../scripts/Izumi/config/testnetConfig";
import { TacLocalTestSdk, TokenMintInfo, NFTInfo, NFTMintInfo, NFTUnlockInfo} from "@tonappchain/evm-ccl";
import { sttonTokenInfo, tacTokenInfo } from '../scripts/common/info/tokensInfo';
import { IzumiPoolAbi } from "./abis/IzumiPool";
import { ERC20 } from "@tonappchain/evm-ccl/dist/typechain-types";
import { IzumiProxy, IPool, ISwap, ILimitOrderManager, ILiquidityManager } from "../typechain-types";

export const MAXUINT128 = BigInt("340282366920938463463374607431768211455");


describe("IzumiProxy", function () {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;

    let izumiProxy: IzumiProxy;
    let pool: IPool;
    let swap: ISwap;
    let limitOrderManager: ILimitOrderManager;
    let liquidityManager: ILiquidityManager;

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

        const initialPoolAddress = await pool.pool(sttonEVMAddress, tacEVMAddress, fee);
        expect(initialPoolAddress).to.equal(ethers.ZeroAddress);

        await testSdk.sendMessage(
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

        const newPoolAddress = await pool.pool(sttonEVMAddress, tacEVMAddress, fee);
        expect(newPoolAddress).to.not.equal(ethers.ZeroAddress);

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
                amount: amount
            },
            {
                info: tacTokenInfo,
                amount: amount
            }
        ];

        await testSdk.sendMessage(
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

        const liquidityInfo = await liquidityManager.liquidities(3n);        
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
        
        const amount = ethers.parseEther("1");
        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(uint256,uint128,uint128,uint128,uint128,uint256)'],
            [[
                3, // lid
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
                amount: amount
            },
            {
                info: tacTokenInfo,
                amount: amount
            }
        ];

        const unlockNft : NFTUnlockInfo = {
            evmAddress: izumiTestnetConfig.liquidityManagerAddress,
            tokenId: 3n,
            amount: 0n
        }
        const liquidityInfoBefore = await liquidityManager.liquidities(3n);

        await testSdk.sendMessageWithNFT(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            mintTokens,
            [],
            [],
            [unlockNft],
            0n,
            extraData,
            operationId,
            timestamp

        );

        const liquidityInfoAfter = await liquidityManager.liquidities(3n);
        expect(liquidityInfoAfter.liquidity).to.be.gt(liquidityInfoBefore.liquidity);
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
        const amount = "0.1" // Smaller amount for testing
        const tokenX = sttonEVMAddress > tacEVMAddress ? tacEVMAddress : sttonEVMAddress;
        const tokenY = sttonEVMAddress > tacEVMAddress ? sttonEVMAddress : tacEVMAddress;
        const tokenXContract = new ethers.Contract(tokenX, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        const tokenYContract = new ethers.Contract(tokenY, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;

        const initialTokenXBalance = await tokenXContract.balanceOf(poolAddress);
        const initialTokenYBalance = await tokenYContract.balanceOf(poolAddress);
        
        await swapToken2Token(tokenX, tokenY, 3000, 214200n, ethers.parseUnits(amount, tacTokenInfo.decimals), target, shardsKey, operationIdYToX, methodNameYToX, tvmWalletCaller, testSdk);
        expect(await tokenXContract.balanceOf(poolAddress)).to.be.lt(initialTokenXBalance);
        expect(await tokenYContract.balanceOf(poolAddress)).to.be.gt(initialTokenYBalance);

        const initialTokenXBalance2 = await tokenXContract.balanceOf(poolAddress);
        const initialTokenYBalance2 = await tokenYContract.balanceOf(poolAddress);

        await swapToken2Token(tokenX, tokenY, 3000, 207240n, ethers.parseUnits(amount, sttonTokenInfo.decimals), target, shardsKey, operationIdXToY, methodNameXToY, tvmWalletCaller, testSdk);
        expect(await tokenXContract.balanceOf(poolAddress)).to.be.gt(initialTokenXBalance2);
        expect(await tokenYContract.balanceOf(poolAddress)).to.be.lt(initialTokenYBalance2);
    
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

        const path = ethers.concat([
            ethers.zeroPadValue(sttonEVMAddress, 20),
            ethers.zeroPadValue(ethers.toBeHex(3000), 3),
            ethers.zeroPadValue(tacEVMAddress, 20)
        ]);

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

        const stTon = new ethers.Contract(sttonEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        const tac = new ethers.Contract(tacEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        const poolAddress = await pool.pool(sttonEVMAddress, tacEVMAddress, 3000);
        
        const initialStTonBalance = await stTon.balanceOf(poolAddress);
        const initialTacBalance = await tac.balanceOf(poolAddress);

        const mintTokens: TokenMintInfo[] = [{
            info: sttonTokenInfo,
            amount: amount
        }];

        await testSdk.sendMessage(
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

        const finalStTonBalance = await stTon.balanceOf(poolAddress);
        const finalTacBalance = await tac.balanceOf(poolAddress);

        expect(finalStTonBalance).to.be.gt(initialStTonBalance);
        expect(finalTacBalance).to.be.lt(initialTacBalance);
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
        
        const amount = ethers.parseUnits("0.0001", sttonEVMAddress > tacEVMAddress ? sttonTokenInfo.decimals : tacTokenInfo.decimals);
        const tokenX = sttonEVMAddress > tacEVMAddress ? tacEVMAddress : sttonEVMAddress;
        const tokenY = sttonEVMAddress > tacEVMAddress ? sttonEVMAddress : tacEVMAddress;
        
        const tokenXContract = new ethers.Contract(tokenX, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        const tokenYContract = new ethers.Contract(tokenY, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;

        const initialTokenXBalance = await tokenXContract.balanceOf(poolAddress);
        const initialTokenYBalance = await tokenYContract.balanceOf(poolAddress);


        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,address,uint24,int24,address,uint128,uint256,uint256,uint256)'],
            [[
                tokenX,
                tokenY,
                3000,           // fee
                214200n,        // point
                target,         // recipient
                amount,         // amount
                ethers.MaxUint256,             // maxPayed
                0,             // minAcquired
                ethers.MaxUint256 // deadline
            ]]
        );

        const mintTokens: TokenMintInfo[] = [
            {
                info: sttonTokenInfo,
                amount: ethers.parseUnits("100000000", sttonTokenInfo.decimals)
            },
            {
                info: tacTokenInfo,
                amount: ethers.parseUnits("1000000000", tacTokenInfo.decimals)
            }
        ];

        await testSdk.sendMessage(
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

        const finalTokenXBalance = await tokenXContract.balanceOf(poolAddress);
        const finalTokenYBalance = await tokenYContract.balanceOf(poolAddress);

        expect(finalTokenXBalance).to.be.lt(initialTokenXBalance);
        expect(finalTokenYBalance).to.be.gt(initialTokenYBalance);
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
        
        const amount = ethers.parseUnits("0.1", sttonTokenInfo.decimals)
        const tokenX = sttonEVMAddress > tacEVMAddress ? tacEVMAddress : sttonEVMAddress;
        const tokenY = sttonEVMAddress > tacEVMAddress ? sttonEVMAddress : tacEVMAddress;

        const tokenXContract = new ethers.Contract(tokenX, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        const tokenYContract = new ethers.Contract(tokenY, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;

        const initialTokenXBalance = await tokenXContract.balanceOf(poolAddress);
        const initialTokenYBalance = await tokenYContract.balanceOf(poolAddress);

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,address,uint24,int24,address,uint128,uint256,uint256,uint256)'],
            [[
                tokenX,
                tokenY,
                3000,           // fee
                207240n,        // point
                target,         // recipient
                amount,         // amount
                ethers.MaxUint256,             // maxPayed
                0,             // minAcquired
                ethers.MaxUint256 // deadline
            ]]
        );

        const mintTokens: TokenMintInfo[] = [
            {
                info: sttonTokenInfo,
                amount: amount
            },
            {
                info: tacTokenInfo,
                amount: amount
            }
        ];

        await testSdk.sendMessage(
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

        const finalTokenXBalance = await tokenXContract.balanceOf(poolAddress);
        const finalTokenYBalance = await tokenYContract.balanceOf(poolAddress);

        expect(finalTokenXBalance).to.be.gt(initialTokenXBalance);
        expect(finalTokenYBalance).to.be.lt(initialTokenYBalance);
    });

    it("Izumi test swap desire through path", async function () {
        const shardsKey = 9n;
        const operationId = ethers.encodeBytes32String("swap desire");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await izumiProxy.getAddress();
        const methodName = "swapDesire(bytes,bytes)";

        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);

        const path = ethers.concat([
            ethers.zeroPadValue(sttonEVMAddress, 20),
            ethers.zeroPadValue(ethers.toBeHex(3000), 3),
            ethers.zeroPadValue(tacEVMAddress, 20)
        ]);

        const desire = ethers.parseUnits("0.1", sttonTokenInfo.decimals);
        const maxPayed = ethers.MaxUint256;

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(bytes,address,uint128,uint256,uint256)'],
            [[
                path,           // path
                target,         // recipient
                desire,         // desired amount
                maxPayed,      // maxPayed
                ethers.MaxUint256 // deadline
            ]]
        );

        const stTon = new ethers.Contract(sttonEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        const tac = new ethers.Contract(tacEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        const poolAddress = await pool.pool(sttonEVMAddress, tacEVMAddress, 3000);
        
        const initialStTonBalance = await stTon.balanceOf(poolAddress);
        const initialTacBalance = await tac.balanceOf(poolAddress);

        const mintTokens: TokenMintInfo[] = [{
            info: sttonTokenInfo,
            amount: ethers.parseUnits("100000000", sttonTokenInfo.decimals)
        }
    ];

        await testSdk.sendMessage(
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

        const finalStTonBalance = await stTon.balanceOf(poolAddress);
        const finalTacBalance = await tac.balanceOf(poolAddress);

        // expect(finalStTonBalance).to.be.gt(initialStTonBalance);
        // expect(finalTacBalance).to.be.lt(initialTacBalance);
    });

    it("Izumi test new limit order", async function () {
        const shardsKey = 10n;
        const operationId = ethers.encodeBytes32String("new limit order");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await izumiProxy.getAddress();
        const methodName = "newLimOrder(bytes,bytes)";

        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);
        
        const poolAddress = await pool.pool(sttonEVMAddress, tacEVMAddress, 3000);
        
        const priceUndecimalXByY = BigInt(1) * BigInt(10n ** BigInt(tacTokenInfo.decimals)) / BigInt(10n ** BigInt(sttonTokenInfo.decimals));
        let point1 = Math.log(Number(priceUndecimalXByY)) / Math.log(1.0001);
        point1 = Math.round(point1);

        const priceUndecimalXByY2 = BigInt(2) * BigInt(10n ** BigInt(tacTokenInfo.decimals)) / BigInt(10n ** BigInt(sttonTokenInfo.decimals));
        let point2 = Math.log(Number(priceUndecimalXByY2)) / Math.log(1.0001);
        point2 = Math.round(point2);

        const tokenX = sttonEVMAddress > tacEVMAddress ? tacEVMAddress : sttonEVMAddress;
        const tokenY = sttonEVMAddress > tacEVMAddress ? sttonEVMAddress : tacEVMAddress;
        const amount = ethers.parseUnits("0.001", sttonEVMAddress > tacEVMAddress ? sttonTokenInfo.decimals : tacTokenInfo.decimals);

        const originAddLimitOrderParam = {
            tokenX: tokenX,
            tokenY: tokenY,
            fee: 3000,
            pt: 207240n,
            amount: amount,
            sellXEarnY: false,
            deadline: ethers.MaxUint256
        };

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(uint256,tuple(address,address,uint24,int24,uint128,bool,uint256))'],
            [[
                0n,
                [
                    originAddLimitOrderParam.tokenX,
                    originAddLimitOrderParam.tokenY,
                    originAddLimitOrderParam.fee,
                    originAddLimitOrderParam.pt,
                    originAddLimitOrderParam.amount,
                    originAddLimitOrderParam.sellXEarnY,
                    originAddLimitOrderParam.deadline
                ]
            ]]
        );

        const stTon = new ethers.Contract(sttonEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        const tac = new ethers.Contract(tacEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        
        const initialStTonBalance = await stTon.balanceOf(poolAddress);
        const initialTacBalance = await tac.balanceOf(poolAddress);

        const mintTokens: TokenMintInfo[] = [{
            info: sttonTokenInfo,
            amount: ethers.parseUnits("100000000", sttonTokenInfo.decimals)
        },
        {
            info: tacTokenInfo,
            amount: ethers.parseUnits("1000000000", tacTokenInfo.decimals)
        }];

        await testSdk.sendMessage(
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

        const order = await limitOrderManager.getActiveOrder(target, 0n);
        expect(order.sellingRemain).to.equal(amount);
        expect(order.sellXEarnY).to.equal(false);
        expect(order.active).to.be.true;
    });

    it("Izumi test cancel order", async function () {
        const shardsKey = 11n;
        const operationId = ethers.encodeBytes32String("cancel order");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await izumiProxy.getAddress();
        const methodName = "cancelOrder(bytes,bytes)";

        // Verify there's an active order to cancel
        const orderBeforeCancel = await limitOrderManager.getActiveOrder(target, 0n);
        expect(orderBeforeCancel.active).to.be.true;
        expect(orderBeforeCancel.sellingRemain).to.be.gt(0n);

        // Cancel the order
        const cancelEncodedArguments = new ethers.AbiCoder().encode(
            ['tuple(uint256,uint128,uint256,uint128,uint128)'],
            [[
                0n,         // orderIdx
                ethers.parseEther("1"),            // amount
                ethers.MaxUint256, // deadline
                MAXUINT128, // collectDec
                MAXUINT128 // collectEarn
            ]]
        );
        
        await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            cancelEncodedArguments,
            tvmWalletCaller,
            [],
            [],
            0n,
            extraData,
            operationId,
            timestamp
        );

        // Verify the order was cancelled
        const orderAfterCancel = await limitOrderManager.getActiveOrder(target, 0n);
        expect(orderAfterCancel.active).to.be.false;
        expect(orderAfterCancel.sellingRemain).to.be.equal(0n);
        expect(orderAfterCancel.sellingDec).to.be.equal(0n);
    });

    it("Izumi test decrease liquidity", async function () {
        const shardsKey = 12n;
        const operationId = ethers.encodeBytes32String("decrease liquidity");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await izumiProxy.getAddress();
        const methodName = "decLiquidity(bytes,bytes)";

        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);
        
        const poolAddress = await pool.pool(sttonEVMAddress, tacEVMAddress, 3000);
        const poolContract = new ethers.Contract(poolAddress, IzumiPoolAbi, admin);
        
        // Get initial liquidity info
        const liquidityInfoBefore = await liquidityManager.liquidities(3n);
        expect(liquidityInfoBefore.liquidity).to.be.gt(0n);

        // Get initial token balances
        const stTon = new ethers.Contract(sttonEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        const tac = new ethers.Contract(tacEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        
        const initialStTonBalance = await stTon.balanceOf(target);
        const initialTacBalance = await tac.balanceOf(target);

        // Decrease liquidity by 50%
        const liquidDelta = liquidityInfoBefore.liquidity;
        const amountXMin = 0n;
        const amountYMin = 0n;

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(uint256,uint128,uint256,uint256,uint256)'],
            [[
                3n,             // lid
                liquidDelta,    // liquidDelta
                amountXMin,     // amountXMin
                amountYMin,     // amountYMin
                ethers.MaxUint256 // deadline
            ]]
        );

        const unlockNft: NFTUnlockInfo = {
            evmAddress: izumiTestnetConfig.liquidityManagerAddress,
            tokenId: 3n,
            amount: 0n
        };

        await testSdk.sendMessageWithNFT(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [],
            [],
            [],
            [unlockNft],
            0n,
            extraData,
            operationId,
            timestamp
        );

        // Verify liquidity was decreased
        const liquidityInfoAfter = await liquidityManager.liquidities(3n);
        expect(liquidityInfoAfter.liquidity).to.be.lt(liquidityInfoBefore.liquidity);
        expect(liquidityInfoAfter.liquidity).to.equal(liquidityInfoBefore.liquidity - liquidDelta);

    });

    it("Izumi test collect liquidity", async function () {
        const shardsKey = 13n;
        const operationId = ethers.encodeBytes32String("collect liquidity");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await izumiProxy.getAddress();
        const methodName = "collect(bytes,bytes)";

        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);

        const poolAddress = await pool.pool(sttonEVMAddress, tacEVMAddress, 3000);
        const poolContract = new ethers.Contract(poolAddress, IzumiPoolAbi, admin);
        
        // Get initial liquidity info
        const liquidityInfoBefore = await liquidityManager.liquidities(3n);
        expect(liquidityInfoBefore.liquidity).to.be.equal(0n);

        // Get initial token balances
        const stTon = new ethers.Contract(sttonEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        const tac = new ethers.Contract(tacEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        
        const initialStTonBalance = await stTon.balanceOf(target);

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(uint256,uint128,uint128)'],
            [[
                3n,             // lid
                liquidityInfoBefore.remainTokenX, // amountXLim
                liquidityInfoBefore.remainTokenY  // amountYLim
            ]]
        );

        const unlockNft: NFTUnlockInfo = {
            evmAddress: izumiTestnetConfig.liquidityManagerAddress,
            tokenId: 3n,
            amount: 0n
        };

        await testSdk.sendMessageWithNFT(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [],
            [],
            [],
            [unlockNft],
            0n,
            extraData,
            operationId,
            timestamp
        );

        // Verify the liquidity was collected
        const liquidityInfoAfter = await liquidityManager.liquidities(3n);
        expect(liquidityInfoAfter.liquidity).to.be.equal(0n);
    });

    it("Izumi test burn liquidity", async function () {
        const shardsKey = 13n;
        const operationId = ethers.encodeBytes32String("burn liquidity");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await izumiProxy.getAddress();
        const methodName = "burn(bytes,bytes)";

        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);
        
        const poolAddress = await pool.pool(sttonEVMAddress, tacEVMAddress, 3000);
        const poolContract = new ethers.Contract(poolAddress, IzumiPoolAbi, admin);
        
        // Get initial liquidity info
        const liquidityInfoBefore = await liquidityManager.liquidities(3n);
        expect(liquidityInfoBefore.liquidity).to.be.equal(0n);
        

        // Get initial token balances
        const stTon = new ethers.Contract(sttonEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        const tac = new ethers.Contract(tacEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        
        const initialStTonBalance = await stTon.balanceOf(target);
        const initialTacBalance = await tac.balanceOf(target);

        // Encode arguments for burning the entire position
        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(uint256)'],
            [[
                3n  // lid - the liquidity position ID to burn
            ]]
        );

        const unlockNft: NFTUnlockInfo = {
            evmAddress: izumiTestnetConfig.liquidityManagerAddress,
            tokenId: 3n,
            amount: 0n
        };

        await testSdk.sendMessageWithNFT(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [],
            [],
            [],
            [unlockNft],
            0n,
            extraData,
            operationId,
            timestamp
        );

        // Verify liquidity position was burned
        const liquidityInfoAfter = await liquidityManager.liquidities(3n);
        expect(liquidityInfoAfter.liquidity).to.equal(0n);
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
        amount: amount
    }, {
        info: sttonTokenInfo,
        amount: amount
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
