import hre, { ethers } from "hardhat";
import { AddressLike, BytesLike, Signer } from "ethers";
import { expect } from "chai";

import { deployTacoProxy } from "../scripts/Taco/deployTacoProxy";
import { tacoTestnetConfig } from "../scripts/Taco/config/testnetConfig";
import { TacLocalTestSdk, TokenMintInfo } from "@tonappchain/evm-ccl";
import { sttonTokenInfo, tacTokenInfo } from '../scripts/common/info/tokensInfo';

import { ERC20 } from "@tonappchain/evm-ccl/dist/typechain-types";
import { TacoProxy, IDODOV2Proxy01, IDODOFeeRouteProxy, IDVMFactory, IDODOApprove, IDVM } from "../typechain-types";

const dvmPoolAbi = hre.artifacts.readArtifactSync('IDVM').abi;

describe("TacoProxy", function () {
    let admin: Signer;

    let testSdk: TacLocalTestSdk;

    let tacoProxy: TacoProxy;
    let tacoV2Proxy02: IDODOV2Proxy01;
    let tacoDVMFactory: IDVMFactory;
    let tacoApprove: IDODOApprove;
    let tacoFeeRouteProxy: IDODOFeeRouteProxy;
    let tacoWETH: ERC20;

    let sttonToken: ERC20;
    let tacToken: ERC20;

    before(async function () {
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);

        tacoProxy = await deployTacoProxy(admin, tacoTestnetConfig, crossChainLayerAddress);

        tacoV2Proxy02 = new ethers.Contract(tacoTestnetConfig.tacoV2Proxy02, hre.artifacts.readArtifactSync('IDODOV2Proxy01').abi, admin) as unknown as IDODOV2Proxy01;
        tacoDVMFactory = new ethers.Contract(tacoTestnetConfig.tacoDVMFactory, hre.artifacts.readArtifactSync('IDVMFactory').abi, admin) as unknown as IDVMFactory;
        tacoApprove = new ethers.Contract(tacoTestnetConfig.tacoApprove, hre.artifacts.readArtifactSync('IDODOApprove').abi, admin) as unknown as IDODOApprove;
        tacoFeeRouteProxy = new ethers.Contract(tacoTestnetConfig.tacoFeeRouteProxy, hre.artifacts.readArtifactSync('IDODOFeeRouteProxy').abi, admin) as unknown as IDODOFeeRouteProxy;

        tacoWETH = new ethers.Contract(tacoTestnetConfig.tacoWETH, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
    });

    it ("TACO test add ERC20 DVM", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("add ERC20 DVM");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await tacoProxy.getAddress();
        const methodName = "createDODOVendingMachine(bytes,bytes)";

        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);

        let pools = await tacoDVMFactory.getDODOPool(sttonEVMAddress, tacEVMAddress);

        expect(pools.length).to.be.equal(0);

        const baseTokenDecimals = sttonTokenInfo.decimals;
        const quoteTokenDecimals = tacTokenInfo.decimals;

        const baseToken = sttonEVMAddress;
        const quoteToken = tacEVMAddress;

        const baseInAmount = 2000n * 10n**9n;
        const quoteInAmount = 1000n * 10n**9n;

        const sttonTokenMintInfo: TokenMintInfo = {
            info: sttonTokenInfo,
            amount: baseInAmount,
        }
        const tacTokenMintInfo: TokenMintInfo = {
            info: tacTokenInfo,
            amount: quoteInAmount,
        }

        const lpFeeRate = 5000000n *10n**9n;
        const i = 1n * 10n**(18n - baseTokenDecimals + quoteTokenDecimals);
        const k = 100000n * 10n**9n;
        const isOpenTWAP = false;
        const deadLine = 19010987500n;

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,address,uint256,uint256,uint256,uint256,uint256,bool,uint256)'],
            [
                [
                    baseToken,
                    quoteToken,
                    baseInAmount,
                    quoteInAmount,
                    lpFeeRate,
                    i,
                    k,
                    isOpenTWAP,
                    deadLine,
                ]
            ]
        );

        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey, // shardsKey
            target, // proxy address
            methodName, // method name
            encodedArguments, // encoded arguments
            tvmWalletCaller, // tvm caller
            [sttonTokenMintInfo, tacTokenMintInfo], // mint tokens
            [], // unlock tokens
            0n, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );

        sttonToken = (new ethers.Contract(deployedTokens[0].evmAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin)) as unknown as ERC20;
        tacToken = (new ethers.Contract(deployedTokens[1].evmAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin)) as unknown as ERC20;

        expect(await sttonToken.name()).to.be.equal(sttonTokenInfo.name);
        expect(await sttonToken.symbol()).to.be.equal(sttonTokenInfo.symbol);
        expect(await sttonToken.decimals()).to.be.equal(sttonTokenInfo.decimals);
        expect(deployedTokens[0].tvmAddress).to.be.equal(sttonTokenInfo.tvmAddress);

        expect(await tacToken.name()).to.be.equal(tacTokenInfo.name);
        expect(await tacToken.symbol()).to.be.equal(tacTokenInfo.symbol);
        expect(await tacToken.decimals()).to.be.equal(tacTokenInfo.decimals);
        expect(deployedTokens[1].tvmAddress).to.be.equal(tacTokenInfo.tvmAddress);

        // check pool was created
        pools = await tacoDVMFactory.getDODOPool(sttonEVMAddress, tacEVMAddress);
        expect(pools.length).to.be.equal(1);

        const dvmPool = (new ethers.Contract(pools[0], dvmPoolAbi, admin)) as unknown as IDVM;

        // check pool balances
        expect(await sttonToken.balanceOf(await dvmPool.getAddress())).to.be.equal(baseInAmount);
        expect(await tacToken.balanceOf(await dvmPool.getAddress())).to.be.equal(quoteInAmount);

        const liquidity = await dvmPool.balanceOf(testSdk.getCrossChainLayerAddress());
        expect(liquidity).to.gte(0n);

        // check bridge lp back to user
        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await tacoProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(1);

        // check lp token locked
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(await dvmPool.getAddress());
        expect(outMessage.tokensLocked[0].amount).to.be.equal(liquidity);

    });

    it ("TACO test add base ETH DVM", async function () {
        const shardsKey = 2n;
        const operationId = ethers.encodeBytes32String("add base ETH DVM");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await tacoProxy.getAddress();
        const methodName = "createDODOVendingMachine(bytes,bytes)";

        const tacoNativeAddress = await tacoProxy._ETH_ADDRESS_();
        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);

        let pools = await tacoDVMFactory.getDODOPool(await tacoWETH.getAddress(), sttonEVMAddress);
        expect(pools.length).to.be.equal(0);

        const baseTokenDecimals = 18n;
        const quoteTokenDecimals = await sttonToken.decimals();
        const baseToken = tacoNativeAddress;
        const quoteToken = await sttonToken.getAddress();
        const baseInAmount = 2000n * 10n**9n;
        const quoteInAmount = 1000n * 10n**9n;
        const lpFeeRate = 5000000n *10n**9n;
        const i = 1n * 10n**(18n - baseTokenDecimals + quoteTokenDecimals);
        const k = 100000n * 10n**9n;
        const isOpenTWAP = false;
        const deadLine = 19010987500n;

        // lock native tac
        await testSdk.lockNativeTacOnCrossChainLayer(baseInAmount);

        const sttonTokenMintInfo: TokenMintInfo = {
            info: sttonTokenInfo,
            amount: quoteInAmount,
        }

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,address,uint256,uint256,uint256,uint256,uint256,bool,uint256)'],
            [
                [
                    baseToken,
                    quoteToken,
                    baseInAmount,
                    quoteInAmount,
                    lpFeeRate,
                    i,
                    k,
                    isOpenTWAP,
                    deadLine,
                ]
            ]
        );

        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey, // shardsKey
            target, // proxy address
            methodName, // method name
            encodedArguments, // encoded arguments
            tvmWalletCaller, // tvm caller
            [sttonTokenMintInfo], // mint tokens
            [], // unlock tokens
            baseInAmount, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );

        // check pool was created
        pools = await tacoDVMFactory.getDODOPool(await tacoWETH.getAddress(), sttonEVMAddress);
        expect(pools.length).to.be.equal(1);

        const dvmPool = (new ethers.Contract(pools[0], dvmPoolAbi, admin)) as unknown as IDVM;

        const liquidity = await dvmPool.balanceOf(testSdk.getCrossChainLayerAddress());
        expect(liquidity).to.gte(0n);

        // check pool balances
        expect(await tacoWETH.balanceOf(await dvmPool.getAddress())).to.be.equal(baseInAmount);
        expect(await sttonToken.balanceOf(await dvmPool.getAddress())).to.be.equal(quoteInAmount);

        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];

        // check bridge lp back to user
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await tacoProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(await dvmPool.getAddress());
        expect(outMessage.tokensLocked[0].amount).to.be.equal(liquidity);

    });

    it ("TACO test add quote ETH DVM", async function () {
        const shardsKey = 3n;
        const operationId = ethers.encodeBytes32String("add quote ETH DVM");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await tacoProxy.getAddress();

        const methodName = "createDODOVendingMachine(bytes,bytes)";

        const tacoNativeAddress = await tacoProxy._ETH_ADDRESS_();
        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);

        let pools = await tacoDVMFactory.getDODOPool(sttonEVMAddress, await tacoWETH.getAddress());
        expect(pools.length).to.be.equal(0);

        const baseTokenDecimals = await sttonToken.decimals();
        const quoteTokenDecimals = 18n;
        const baseToken = await sttonToken.getAddress();
        const quoteToken = tacoNativeAddress;
        const baseInAmount = 2000n * 10n**9n;
        const quoteInAmount = 1000n * 10n**9n;
        const lpFeeRate = 5000000n *10n**9n;
        const i = 1n * 10n**(18n - baseTokenDecimals + quoteTokenDecimals);
        const k = 100000n * 10n**9n;
        const isOpenTWAP = false;
        const deadLine = 19010987500n;

        // mint stton token
        const sttonTokenMintInfo: TokenMintInfo = {
            info: sttonTokenInfo,
            amount: baseInAmount,
        }

        // lock native tac
        await testSdk.lockNativeTacOnCrossChainLayer(quoteInAmount);

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,address,uint256,uint256,uint256,uint256,uint256,bool,uint256)'],
            [
                [
                    baseToken,
                    quoteToken,
                    baseInAmount,
                    quoteInAmount,
                    lpFeeRate,
                    i,
                    k,
                    isOpenTWAP,
                    deadLine,
                ]
            ]
        );

        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey, // shardsKey
            target, // proxy address
            methodName, // method name
            encodedArguments, // encoded arguments
            tvmWalletCaller, // tvm caller
            [sttonTokenMintInfo], // mint tokens
            [], // unlock tokens
            quoteInAmount, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );

        // check pool was created
        pools = await tacoDVMFactory.getDODOPool(sttonEVMAddress, await tacoWETH.getAddress());
        expect(pools.length).to.be.equal(1);

        const dvmPool = (new ethers.Contract(pools[0], dvmPoolAbi, admin)) as unknown as IDVM;

        const liquidity = await dvmPool.balanceOf(testSdk.getCrossChainLayerAddress());
        expect(liquidity).to.gte(0n);

        // check pool balances
        expect(await sttonToken.balanceOf(await dvmPool.getAddress())).to.be.equal(baseInAmount);
        expect(await tacoWETH.balanceOf(await dvmPool.getAddress())).to.be.equal(quoteInAmount);

        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];

        // check bridge lp back to user
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await tacoProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(await dvmPool.getAddress());
        expect(outMessage.tokensLocked[0].amount).to.be.equal(liquidity);

    });

    it ("TACO add ERC20 liquidity", async function () {
        const shardsKey = 4n;
        const operationId = ethers.encodeBytes32String("add ERC20 liquidity");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await tacoProxy.getAddress();
        const methodName = "addDVMLiquidity(bytes,bytes)";

        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);

        let pools = await tacoDVMFactory.getDODOPool(sttonEVMAddress, tacEVMAddress);
        expect(pools.length).to.be.equal(1);

        const dvmPool = (new ethers.Contract(pools[0], dvmPoolAbi, admin)) as unknown as IDVM;

        // pool balances
        const baseBalanceBefore = await sttonToken.balanceOf(await dvmPool.getAddress());
        const quoteBalanceBefore = await tacToken.balanceOf(await dvmPool.getAddress());

        const baseInAmount = 1000n * 10n**9n;
        const quoteInAmount = 1000n * 10n**9n;

        // check reserves ratio
        let factBaseInAmount;
        let factQuoteInAmount;

        const reserves = await dvmPool.getVaultReserve();

        expect(reserves.baseReserve).to.be.gte(0n);
        expect(reserves.quoteReserve).to.be.gte(0n);

        const ONE = 10n**18n;

        const baseIncreaseRatio = baseInAmount * ONE / reserves.baseReserve;
        const quoteIncreaseRatio = quoteInAmount * ONE / reserves.quoteReserve;

        if (baseIncreaseRatio <= quoteIncreaseRatio) {
            factBaseInAmount = baseInAmount;
            factQuoteInAmount = reserves.quoteReserve * baseIncreaseRatio / ONE;
        } else {
            factBaseInAmount = reserves.baseReserve * quoteIncreaseRatio / ONE;
            factQuoteInAmount = quoteInAmount;
        }

        const baseMinAmount = factBaseInAmount;
        const quoteMinAmount = factQuoteInAmount;

        const flag = 0 // 0 - ERC20, 1 - baseInETH, 2 - quoteInETH
        const deadLine = 19010987500n;

        // mint tokens
        const sttonTokenMintInfo: TokenMintInfo = {
            info: sttonTokenInfo,
            amount: baseInAmount,
        }
        const tacTokenMintInfo: TokenMintInfo = {
            info: tacTokenInfo,
            amount: quoteInAmount,
        }

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,uint256,uint256,uint256,uint256,uint8,uint256)'],
            [
                [
                    await dvmPool.getAddress(),
                    baseInAmount,
                    quoteInAmount,
                    baseMinAmount,
                    quoteMinAmount,
                    flag,
                    deadLine,
                ]
            ]
        );

        const liquidityBefore = await dvmPool.balanceOf(testSdk.getCrossChainLayerAddress());

        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey, // shardsKey
            target, // proxy address
            methodName, // method name
            encodedArguments, // encoded arguments
            tvmWalletCaller, // tvm caller
            [sttonTokenMintInfo, tacTokenMintInfo], // mint tokens
            [], // unlock tokens
            0n, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );

        // check pool balances
        const baseBalanceAfter = await sttonToken.balanceOf(await dvmPool.getAddress());
        const quoteBalanceAfter = await tacToken.balanceOf(await dvmPool.getAddress());

        expect(baseBalanceAfter).to.be.equal(baseBalanceBefore + factBaseInAmount);
        expect(quoteBalanceAfter).to.be.equal(quoteBalanceBefore + factQuoteInAmount);

        const liquidityAfter = await dvmPool.balanceOf(testSdk.getCrossChainLayerAddress());

        // check bridge lp back to user
        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await tacoProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");

        const baseChange = baseInAmount - factBaseInAmount;
        const quoteChange = quoteInAmount - factQuoteInAmount;

        const numLocked = 1;
        const numBurned = (quoteChange > 0 ? 1 : 0) + (baseChange > 0 ? 1 : 0);


        expect(outMessage.tokensLocked.length).to.be.equal(numLocked);
        expect(outMessage.tokensBurned.length).to.be.equal(numBurned);

        // check lp token locked
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(await dvmPool.getAddress());
        expect(outMessage.tokensLocked[0].amount).to.be.equal(liquidityAfter - liquidityBefore);

        // check bridge change tokens back to user
        let i = 0;
        if (baseChange > 0) {
            expect(outMessage.tokensBurned[i].evmAddress).to.be.equal(await sttonToken.getAddress());
            expect(outMessage.tokensBurned[i].amount).to.be.equal(baseChange);
            i++;
        }
        if (quoteChange > 0) {
            expect(outMessage.tokensBurned[i].evmAddress).to.be.equal(await tacToken.getAddress());
            expect(outMessage.tokensBurned[i].amount).to.be.equal(quoteChange);
            i++;
        }
    });

    it ("TACO test add base ETH liquidity", async function () {
        const shardsKey = 5n;
        const operationId = ethers.encodeBytes32String("add base ETH liquidity");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await tacoProxy.getAddress();
        const methodName = "addDVMLiquidity(bytes,bytes)";

        let pools = await tacoDVMFactory.getDODOPool(await tacoWETH.getAddress(), await sttonToken.getAddress());
        expect(pools.length).to.be.equal(1);

        const dvmPool = (new ethers.Contract(pools[0], dvmPoolAbi, admin)) as unknown as IDVM;

        // pool balances
        const baseBalanceBefore = await tacoWETH.balanceOf(await dvmPool.getAddress());
        const quoteBalanceBefore = await sttonToken.balanceOf(await dvmPool.getAddress());

        const baseInAmount = 1000n * 10n**9n;
        const quoteInAmount = 1000n * 10n**9n;

        // check reserves ratio
        let factBaseInAmount;
        let factQuoteInAmount;

        const reserves = await dvmPool.getVaultReserve();

        const ONE = 10n**18n;

        const baseIncreaseRatio = baseInAmount * ONE / reserves.baseReserve;
        const quoteIncreaseRatio = quoteInAmount * ONE / reserves.quoteReserve;

        if (baseIncreaseRatio <= quoteIncreaseRatio) {
            factBaseInAmount = baseInAmount;
            factQuoteInAmount = reserves.quoteReserve * baseIncreaseRatio / ONE;
        } else {
            factBaseInAmount = reserves.baseReserve * quoteIncreaseRatio / ONE;
            factQuoteInAmount = quoteInAmount;
        }

        const baseMinAmount = factBaseInAmount;
        const quoteMinAmount = factQuoteInAmount;

        const flag = 1 // 0 - ERC20, 1 - baseInETH, 2 - quoteInETH
        const deadLine = 19010987500n;

        // lock native tac
        await testSdk.lockNativeTacOnCrossChainLayer(baseInAmount);

        // mint tokens
        const sttonTokenMintInfo: TokenMintInfo = {
            info: sttonTokenInfo,
            amount: quoteInAmount,
        }

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,uint256,uint256,uint256,uint256,uint8,uint256)'],
            [
                [
                    await dvmPool.getAddress(),
                    baseInAmount,
                    quoteInAmount,
                    baseMinAmount,
                    quoteMinAmount,
                    flag,
                    deadLine,
                ]
            ]
        );

        const liquidityBefore = await dvmPool.balanceOf(testSdk.getCrossChainLayerAddress());

        // send message

        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey, // shardsKey
            target, // proxy address
            methodName, // method name
            encodedArguments, // encoded arguments
            tvmWalletCaller, // tvm caller
            [sttonTokenMintInfo], // mint tokens
            [], // unlock tokens
            baseInAmount, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );

        // check pool balances
        const baseBalanceAfter = await tacoWETH.balanceOf(await dvmPool.getAddress());
        const quoteBalanceAfter = await sttonToken.balanceOf(await dvmPool.getAddress());

        expect(baseBalanceAfter).to.be.equal(baseBalanceBefore + factBaseInAmount);
        expect(quoteBalanceAfter).to.be.equal(quoteBalanceBefore + factQuoteInAmount);

        const liquidityAfter = await dvmPool.balanceOf(testSdk.getCrossChainLayerAddress());

        // check bridge lp back to user
        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await tacoProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");

        // check bridge change tokens back to user
        const baseChange = baseInAmount - factBaseInAmount;
        const quoteChange = quoteInAmount - factQuoteInAmount;

        const numLocked = (baseChange > 0 ? 1 : 0) + 1;
        const numBurned = (quoteChange > 0 ? 1 : 0);


        expect(outMessage.tokensLocked.length).to.be.equal(numLocked);
        expect(outMessage.tokensBurned.length).to.be.equal(numBurned);

        // check lp token locked
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(await dvmPool.getAddress());
        expect(outMessage.tokensLocked[0].amount).to.be.equal(liquidityAfter - liquidityBefore);

        // check bridge change tokens back to user
        if (baseChange > 0) {
            expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(testSdk.getNativeTokenAddress());
            expect(outMessage.tokensLocked[0].amount).to.be.equal(baseChange);
        }
        if (quoteChange > 0) {
            expect(outMessage.tokensBurned[0].evmAddress).to.be.equal(await sttonToken.getAddress());
            expect(outMessage.tokensBurned[0].amount).to.be.equal(quoteChange);
        }
    });

    it ("TACO test add quote ETH liquidity", async function () {
        const shardsKey = 6n;
        const operationId = ethers.encodeBytes32String("add quote ETH liquidity");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await tacoProxy.getAddress();
        const methodName = "addDVMLiquidity(bytes,bytes)";

        let pools = await tacoDVMFactory.getDODOPool(await sttonToken.getAddress(), await tacoWETH.getAddress());
        expect(pools.length).to.be.equal(1);

        const dvmPool = (new ethers.Contract(pools[0], dvmPoolAbi, admin)) as unknown as IDVM;

        // pool balances
        const baseBalanceBefore = await sttonToken.balanceOf(await dvmPool.getAddress());
        const quoteBalanceBefore = await tacoWETH.balanceOf(await dvmPool.getAddress());

        const baseInAmount = 1000n * 10n**9n;
        const quoteInAmount = 1000n * 10n**9n;

        // check reserves ratio
        let factBaseInAmount;
        let factQuoteInAmount;

        const reserves = await dvmPool.getVaultReserve();

        const ONE = 10n**18n;

        const baseIncreaseRatio = baseInAmount * ONE / reserves.baseReserve;
        const quoteIncreaseRatio = quoteInAmount * ONE / reserves.quoteReserve;

        if (baseIncreaseRatio <= quoteIncreaseRatio) {
            factBaseInAmount = baseInAmount;
            factQuoteInAmount = reserves.quoteReserve * baseIncreaseRatio / ONE;
        } else {
            factBaseInAmount = reserves.baseReserve * quoteIncreaseRatio / ONE;
            factQuoteInAmount = quoteInAmount;
        }

        const baseMinAmount = factBaseInAmount;
        const quoteMinAmount = factQuoteInAmount;

        const flag = 2 // 0 - ERC20, 1 - baseInETH, 2 - quoteInETH
        const deadLine = 19010987500n;

        // mint tokens
        const sttonTokenMintInfo: TokenMintInfo = {
            info: sttonTokenInfo,
            amount: baseInAmount,
        };

        // lock native tac
        await testSdk.lockNativeTacOnCrossChainLayer(factQuoteInAmount);

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,uint256,uint256,uint256,uint256,uint8,uint256)'],
            [
                [
                    await dvmPool.getAddress(),
                    baseInAmount,
                    factQuoteInAmount, // WA: Taco cant take in params ETH more than adjusted amount
                    baseMinAmount,
                    quoteMinAmount,
                    flag,
                    deadLine,
                ]
            ]
        );

        const liquidityBefore = await dvmPool.balanceOf(testSdk.getCrossChainLayerAddress());

        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey, // shardsKey
            target, // proxy address
            methodName, // method name
            encodedArguments, // encoded arguments
            tvmWalletCaller, // tvm caller
            [sttonTokenMintInfo], // mint tokens
            [], // unlock tokens
            factQuoteInAmount, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );

        // check pool balances

        const baseBalanceAfter = await sttonToken.balanceOf(await dvmPool.getAddress());
        const quoteBalanceAfter = await tacoWETH.balanceOf(await dvmPool.getAddress());

        expect(baseBalanceAfter).to.be.equal(baseBalanceBefore + factBaseInAmount);
        expect(quoteBalanceAfter).to.be.equal(quoteBalanceBefore + factQuoteInAmount);

        const liquidityAfter = await dvmPool.balanceOf(testSdk.getCrossChainLayerAddress());

        // check bridge lp back to user
        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await tacoProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");

        const baseChange = baseInAmount - factBaseInAmount;
        const quoteChange = factQuoteInAmount - factQuoteInAmount;

        const numLocked = (quoteChange > 0 ? 1 : 0) + 1;
        const numBurned = (baseChange > 0 ? 1 : 0);

        // check lp token locked
        expect(outMessage.tokensLocked.length).to.be.equal(numLocked);
        expect(outMessage.tokensBurned.length).to.be.equal(numBurned);

        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(await dvmPool.getAddress());
        expect(outMessage.tokensLocked[0].amount).to.be.equal(liquidityAfter - liquidityBefore);

        // check bridge change tokens back to user
        if (quoteChange > 0) {
            expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(testSdk.getNativeTokenAddress());
            expect(outMessage.tokensLocked[0].amount).to.be.equal(quoteChange);
        }

        if (baseChange > 0) {
            expect(outMessage.tokensBurned[0].evmAddress).to.be.equal(await sttonToken.getAddress());
            expect(outMessage.tokensBurned[0].amount).to.be.equal(baseChange);
        }
    });

    // TODO: fix this test
    xit ("TACO test mix swap ERC20", async function () {
        const shardsKey = 7n;
        const operationId = ethers.encodeBytes32String("mix swap ERC20");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await tacoProxy.getAddress();
        const methodName = "mixSwap(bytes,bytes)";

        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);

        let pools = await tacoDVMFactory.getDODOPool(sttonEVMAddress, tacEVMAddress);
        expect(pools.length).to.be.equal(1);

        const dvmPool = (new ethers.Contract(pools[0], dvmPoolAbi, admin)) as unknown as IDVM;

        // pool balances
        const baseBalanceBefore = await sttonToken.balanceOf(await dvmPool.getAddress());
        const quoteBalanceBefore = await tacToken.balanceOf(await dvmPool.getAddress());

        const fromToken = sttonEVMAddress;
        const toToken = tacEVMAddress;
        const fromTokenAmount = 100n * 10n**9n;
        const expReturnAmount = 1n;  // ?
        const minReturnAmount = 1n;
        const mixAdapters: AddressLike[] = [];  // ?
        const mixPairs = [pools[0]];
        const assetTo: AddressLike[] = [];  // ?
        const directions = 0;
        const moreInfos: BytesLike[] = [];  // ?
        const feeData = "0x"; // ?
        const deadLine = 19010987500n;

        // mint base token
        const sttonTokenMintInfo: TokenMintInfo = {
            info: sttonTokenInfo,
            amount: fromTokenAmount,
        }

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,address,uint256,uint256,uint256,address[],address[],address[],uint256,bytes[],bytes,uint256)'],
            [
                [
                    fromToken,
                    toToken,
                    fromTokenAmount,
                    expReturnAmount,
                    minReturnAmount,
                    mixAdapters,
                    mixPairs,
                    assetTo,
                    directions,
                    moreInfos,
                    feeData,
                    deadLine,
                ]
            ]
        );

        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey, // shardsKey
            target, // proxy address
            methodName, // method name
            encodedArguments, // encoded arguments
            tvmWalletCaller, // tvm caller
            [sttonTokenMintInfo], // mint tokens
            [], // unlock tokens
            0n, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );

        // check pool balances
        const baseBalanceAfter = await sttonToken.balanceOf(await dvmPool.getAddress());
        const quoteBalanceAfter = await tacToken.balanceOf(await dvmPool.getAddress());

        // log out message

        for (let msg of outMessages) {

        }
    });

    it ("TACO test sell shares (remove liquidity) from ERC20 DVM", async function () {
        const shardsKey = 8n;
        const operationId = ethers.encodeBytes32String("sell ERC20 DVM shares");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await tacoProxy.getAddress();
        const methodName = "sellShares(bytes,bytes)";

        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);

        let pools = await tacoDVMFactory.getDODOPool(sttonEVMAddress, tacEVMAddress);
        expect(pools.length).to.be.equal(1);

        const dvmPool = (new ethers.Contract(pools[0], dvmPoolAbi, admin)) as unknown as IDVM;

        const lpTokensOnCCL = await dvmPool.balanceOf(testSdk.getCrossChainLayerAddress());
        expect(lpTokensOnCCL).to.be.gt(0n, "No LP tokens available to remove liquidity");


        const sharesToSell = lpTokensOnCCL / 2n;

        // pool balances before removing liquidity
        const baseBalanceBefore = await sttonToken.balanceOf(await dvmPool.getAddress());
        const quoteBalanceBefore = await tacToken.balanceOf(await dvmPool.getAddress());

        const baseMinAmount = 0n;
        const quoteMinAmount = 0n;
        const data = "0x";
        const deadline = 19010987500n;

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,uint256,address,uint256,uint256,bytes,uint256)'],
            [
                [
                    await dvmPool.getAddress(),
                    sharesToSell,
                    target,
                    baseMinAmount,
                    quoteMinAmount,
                    data,
                    deadline
                ]
            ]
        );

        // msg to remove liquidity
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [], // mint tokens
            [{ evmAddress: await dvmPool.getAddress(), amount: sharesToSell }], // unlock LP tokens
            0n, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );

        // pool balances after
        const baseBalanceAfter = await sttonToken.balanceOf(await dvmPool.getAddress());
        const quoteBalanceAfter = await tacToken.balanceOf(await dvmPool.getAddress());

        expect(baseBalanceAfter).to.be.lt(baseBalanceBefore, "Base token balance should decrease");
        expect(quoteBalanceAfter).to.be.lt(quoteBalanceBefore, "Quote token balance should decrease");

        const baseAmountRemoved = baseBalanceBefore - baseBalanceAfter;
        const quoteAmountRemoved = quoteBalanceBefore - quoteBalanceAfter;

        expect(baseAmountRemoved).to.be.gte(baseMinAmount, "Base amount removed is less than minimum");
        expect(quoteAmountRemoved).to.be.gte(quoteMinAmount, "Quote amount removed is less than minimum");

        expect(outMessages.length).to.be.equal(1, "Should have one outbound message");
        const outMessage = outMessages[0];

        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await tacoProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(0, "Should bridge 2 tokens back to TON");
        expect(outMessage.tokensBurned.length).to.be.equal(2, "Should bridge 2 tokens back to TON");

        const bridgedTokens = outMessage.tokensBurned.map(t => t.evmAddress);
        expect(bridgedTokens).to.include(sttonEVMAddress, "Base token not bridged back");
        expect(bridgedTokens).to.include(tacEVMAddress, "Quote token not bridged back");

        const baseTokenBridge = outMessage.tokensBurned.find(t => t.evmAddress === sttonEVMAddress);
        const quoteTokenBridge = outMessage.tokensBurned.find(t => t.evmAddress === tacEVMAddress);

        expect(baseTokenBridge?.amount).to.be.equal(baseAmountRemoved, "Incorrect base token amount bridged");
        expect(quoteTokenBridge?.amount).to.be.equal(quoteAmountRemoved, "Incorrect quote token amount bridged");
    });

    it ("TACO test sell shares (remove liquidity) from base-TAC DVM", async function () {
        const shardsKey = 9n;
        const operationId = ethers.encodeBytes32String("sell (ERC20,TAC) DVM shares");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const sttonTokenAddress = await sttonToken.getAddress();
        const wethAddress = await tacoWETH.getAddress();
        const tacoNativeAddress = await tacoProxy._ETH_ADDRESS_();

        const target = await tacoProxy.getAddress();
        const methodName = "sellShares(bytes,bytes)";

        let pools = await tacoDVMFactory.getDODOPool(wethAddress, sttonTokenAddress);
        expect(pools.length).to.be.equal(1);

        const dvmPool = (new ethers.Contract(pools[0], dvmPoolAbi, admin)) as unknown as IDVM;

        // pool balances before removing liquidity
        const baseBalanceBefore = await tacoWETH.balanceOf(await dvmPool.getAddress());
        const quoteBalanceBefore = await sttonToken.balanceOf(await dvmPool.getAddress());
        const tacCCLBalanceBefore = await ethers.provider.getBalance(testSdk.getCrossChainLayerAddress());

        const lpTokensOnCCL = await dvmPool.balanceOf(testSdk.getCrossChainLayerAddress());
        expect(lpTokensOnCCL).to.be.gt(0n, "No LP tokens available to remove liquidity");

        const sharesToSell = lpTokensOnCCL / 2n;

        const baseMinAmount = 0n;
        const quoteMinAmount = 0n;
        const data = "0x00";
        const deadline = 19010987500n;

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,uint256,address,uint256,uint256,bytes,uint256)'],
            [
                [
                    await dvmPool.getAddress(),
                    sharesToSell,
                    tacoTestnetConfig.tacoCalleeHelperAddress,  // use TACO ETH helper - to autoconvert from wTAC to native TAC
                    baseMinAmount,
                    quoteMinAmount,
                    data,
                    deadline
                ]
            ]
        );

        // msg to remove liquidity
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [], // mint tokens
            [{ evmAddress: await dvmPool.getAddress(), amount: sharesToSell }], // unlock LP tokens
            0n, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );

        // pool balances after
        const baseBalanceAfter = await tacoWETH.balanceOf(await dvmPool.getAddress());
        const quoteBalanceAfter = await sttonToken.balanceOf(await dvmPool.getAddress());
        const tacCCLBalanceAfter = await ethers.provider.getBalance(testSdk.getCrossChainLayerAddress());

        expect(baseBalanceAfter).to.be.lt(baseBalanceBefore, "Base token balance should decrease");
        expect(quoteBalanceAfter).to.be.lt(quoteBalanceBefore, "Quote token balance should decrease");
        expect(tacCCLBalanceBefore).to.be.lt(tacCCLBalanceAfter, "CCL TAC token balance should increase");

        const baseAmountRemoved = baseBalanceBefore - baseBalanceAfter;
        const quoteAmountRemoved = quoteBalanceBefore - quoteBalanceAfter;
        const nativeAmountAdded = tacCCLBalanceAfter - tacCCLBalanceBefore;

        expect(baseAmountRemoved).to.be.gte(baseMinAmount, "Base amount removed is less than minimum");
        expect(quoteAmountRemoved).to.be.gte(quoteMinAmount, "Quote amount removed is less than minimum");
        expect(nativeAmountAdded).to.be.eq(baseAmountRemoved, "delta wTAC = delta TAC");

        expect(outMessages.length).to.be.equal(1, "Should have one outbound message");
        const outMessage = outMessages[0];

        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await tacoProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(1, "Should bridge 0 tokens back to TON");
        expect(outMessage.tokensBurned.length).to.be.equal(1, "Should bridge 1 tokens back to TON");

        const burnedTokens = outMessage.tokensBurned.map(t => t.evmAddress);
        expect(burnedTokens).to.include(sttonTokenAddress, "Quote token not bridged back");

        const quoteTokenBridge = outMessage.tokensBurned.find(t => t.evmAddress === sttonTokenAddress);
        expect(quoteTokenBridge?.amount).to.be.equal(quoteAmountRemoved, "Incorrect quote token amount bridged");

        const lockedTokens = outMessage.tokensLocked.map(t => t.evmAddress);
        expect(lockedTokens).to.include(tacoNativeAddress, "Base token not bridged back");
    });

    it ("TACO test sell shares (remove liquidity) from quote-TAC DVM", async function () {
        const shardsKey = 10n;
        const operationId = ethers.encodeBytes32String("sell (ERC20,TAC) DVM shares");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const sttonTokenAddress = await sttonToken.getAddress();
        const wethAddress = await tacoWETH.getAddress();
        const tacoNativeAddress = await tacoProxy._ETH_ADDRESS_();

        const target = await tacoProxy.getAddress();
        const methodName = "sellShares(bytes,bytes)";

        let pools = await tacoDVMFactory.getDODOPool(sttonTokenAddress, wethAddress);
        expect(pools.length).to.be.equal(1);

        const dvmPool = (new ethers.Contract(pools[0], dvmPoolAbi, admin)) as unknown as IDVM;

        // pool balances before removing liquidity
        const baseBalanceBefore = await sttonToken.balanceOf(await dvmPool.getAddress());
        const quoteBalanceBefore = await tacoWETH.balanceOf(await dvmPool.getAddress());
        const tacCCLBalanceBefore = await ethers.provider.getBalance(testSdk.getCrossChainLayerAddress());

        const lpTokensOnCCL = await dvmPool.balanceOf(testSdk.getCrossChainLayerAddress());
        expect(lpTokensOnCCL).to.be.gt(0n, "No LP tokens available to remove liquidity");

        const sharesToSell = lpTokensOnCCL / 2n;

        const baseMinAmount = 0n;
        const quoteMinAmount = 0n;
        const data = "0x00";
        const deadline = 19010987500n;

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,uint256,address,uint256,uint256,bytes,uint256)'],
            [
                [
                    await dvmPool.getAddress(),
                    sharesToSell,
                    tacoTestnetConfig.tacoCalleeHelperAddress,  // use TACO ETH helper - to autoconvert from wTAC to native TAC
                    baseMinAmount,
                    quoteMinAmount,
                    data,
                    deadline
                ]
            ]
        );

        // msg to remove liquidity
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [], // mint tokens
            [{ evmAddress: await dvmPool.getAddress(), amount: sharesToSell }], // unlock LP tokens
            0n, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );

        // pool balances after
        const baseBalanceAfter = await sttonToken.balanceOf(await dvmPool.getAddress());
        const quoteBalanceAfter = await tacoWETH.balanceOf(await dvmPool.getAddress());
        const tacCCLBalanceAfter = await ethers.provider.getBalance(testSdk.getCrossChainLayerAddress());

        expect(baseBalanceAfter).to.be.lt(baseBalanceBefore, "Base token balance should decrease");
        expect(quoteBalanceAfter).to.be.lt(quoteBalanceBefore, "Quote token balance should decrease");
        expect(tacCCLBalanceBefore).to.be.lt(tacCCLBalanceAfter, "CCL TAC token balance should increase");

        const baseAmountRemoved = baseBalanceBefore - baseBalanceAfter;
        const quoteAmountRemoved = quoteBalanceBefore - quoteBalanceAfter;
        const nativeAmountAdded = tacCCLBalanceAfter - tacCCLBalanceBefore;

        expect(baseAmountRemoved).to.be.gte(baseMinAmount, "Base amount removed is less than minimum");
        expect(quoteAmountRemoved).to.be.gte(quoteMinAmount, "Quote amount removed is less than minimum");
        expect(nativeAmountAdded).to.be.eq(quoteAmountRemoved, "delta wTAC = delta TAC");

        expect(outMessages.length).to.be.equal(1, "Should have one outbound message");
        const outMessage = outMessages[0];

        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await tacoProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(1, "Should bridge 0 tokens back to TON");
        expect(outMessage.tokensBurned.length).to.be.equal(1, "Should bridge 1 tokens back to TON");

        const burnedTokens = outMessage.tokensBurned.map(t => t.evmAddress);
        expect(burnedTokens).to.include(sttonTokenAddress, "Base token not bridged back");

        const baseTokenBridge = outMessage.tokensBurned.find(t => t.evmAddress === sttonTokenAddress);
        expect(baseTokenBridge?.amount).to.be.equal(baseAmountRemoved, "Incorrect base token amount bridged");

        const lockedTokens = outMessage.tokensLocked.map(t => t.evmAddress);
        expect(lockedTokens).to.include(tacoNativeAddress, "Quote token not bridged back");
    });
});
