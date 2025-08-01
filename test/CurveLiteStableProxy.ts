import hre, { ethers } from "hardhat";
import { AddressLike, BytesLike, Contract, Signer } from "ethers";
import { expect } from "chai";

import { CurveLiteStableswapMainnetConfig } from "../scripts/CurveLite/stableswap/mainnetConfig";
import { deployCurveLiteStableswapProxy } from "../scripts/CurveLite/stableswap/deployStableSwapProxy";
import { TacLocalTestSdk, TokenMintInfo, TokenUnlockInfo } from "@tonappchain/evm-ccl";


import { ERC20, IWTAC } from "@tonappchain/evm-ccl/dist/typechain-types";
import { CurveLiteStableswapProxy, ISAFactory } from "../typechain-types";
import { factoryAbi } from "../scripts/CurveLite/stableswap/factoryAbi"
import { implementationAbi } from "../scripts/CurveLite/stableswap/implementationAbi"
import { sttonTokenInfo, tacTokenInfo } from '../scripts/common/info/tokensInfo';


describe("CurveLiteStableProxy", function () {

    const NATIVE = "0xB63B9f0eb4A6E6f191529D71d4D88cc8900Df2C9"

    let poolPresetParams = {
        name: "test",
        symbol: "test",
        coins: ["", ""],
        A: 100,
        fee: 1000000,
        _offpeg_fee_multiplier: 20000000000,
        _ma_exp_time: 866,
        _implementation_idx: 0,
        _asset_types: ["0", "0"],
        _method_ids: [ "0x00000000", "0x00000000" ],
        _oracles: [ "0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000" ]

    };
    let sttonEVM: ERC20;
    let tacEVM: ERC20;
    let WTAC: ERC20;

    let pool: Contract
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let curveLiteStableProxy: CurveLiteStableswapProxy;
    let factoryContract: Contract;
    let tacSAFactory: ISAFactory;

    before(async function () {
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        tacSAFactory = new ethers.Contract(testSdk.getSmartAccountFactoryAddress(), hre.artifacts.readArtifactSync('ISAFactory').abi, admin) as unknown as ISAFactory;
        WTAC = new ethers.Contract(NATIVE, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        curveLiteStableProxy = await deployCurveLiteStableswapProxy(admin, crossChainLayerAddress, await tacSAFactory.getAddress(), await WTAC.getAddress());
        factoryContract = new ethers.Contract(CurveLiteStableswapMainnetConfig.CurveLiteStableswapFactory, factoryAbi, admin) as unknown as Contract;
        console.log("factoryContract", factoryContract.getAddress());
        console.log("curveLiteStableProxy", await curveLiteStableProxy.getAddress());
        console.log("crossChainLayerAddress", crossChainLayerAddress);
        console.log("tacSAFactory", await tacSAFactory.getAddress());
        console.log("admin", await admin.getAddress());
    });

    it("deploy tokens", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("add ERC20 DVM");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";
        const target = await admin.getAddress();
        await testSdk.lockNativeTacOnCrossChainLayer(10n**20n);
        const mintAmount = 10n**20n

        const sttonTokenMintInfo: TokenMintInfo = {
            info: sttonTokenInfo,
            amount: mintAmount,
        }
        const tacTokenMintInfo: TokenMintInfo = {
            info: tacTokenInfo,
            amount: mintAmount,
        }

        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey, // shardsKey
            target, // proxy address
            "", // method name
            "0x", // encoded arguments
            tvmWalletCaller, // tvm caller
            [sttonTokenMintInfo, tacTokenMintInfo], // mint tokens
            [], // unlock tokens
            10n**18n, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );
        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);
        expect(sttonEVMAddress).to.be.equal(deployedTokens[0].evmAddress);
        expect(tacEVMAddress).to.be.equal(deployedTokens[1].evmAddress);
        sttonEVM = new ethers.Contract(sttonEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        tacEVM = new ethers.Contract(tacEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        
        
        expect(await sttonEVM.balanceOf(await admin.getAddress())).to.be.equal(mintAmount);
        expect(await tacEVM.balanceOf(await admin.getAddress())).to.be.equal(mintAmount);

    });


    
    it("CurveLiteTwocryptoswap pool deploy pool", async function () {
        const poolCountBefore = await factoryContract.pool_count()

        const tx = await factoryContract.deploy_plain_pool(
            poolPresetParams.name,
            poolPresetParams.symbol,
            [await sttonEVM.getAddress(), await tacEVM.getAddress()],
            poolPresetParams.A,
            poolPresetParams.fee,
            poolPresetParams._offpeg_fee_multiplier,
            poolPresetParams._ma_exp_time,
            poolPresetParams._implementation_idx,
            poolPresetParams._asset_types,
            poolPresetParams._method_ids,
            poolPresetParams._oracles,
            {
                gasLimit: 10000000
            }
        );
        const receipt = await tx.wait();
        
        
        expect(poolCountBefore).to.be.equal(await factoryContract.pool_count() - 1n);
        
        const PoolAddress = await factoryContract.find_pool_for_coins(await sttonEVM.getAddress(), await tacEVM.getAddress())
        pool = new ethers.Contract(PoolAddress, implementationAbi, admin) as unknown as Contract;
        expect(await pool.coins(0)).to.be.equal(await sttonEVM.getAddress());
        expect(await pool.coins(1)).to.be.equal(await tacEVM.getAddress());
        expect(await pool.balances(0)).to.be.equal(await sttonEVM.balanceOf(await pool.getAddress()));
        expect(await pool.balances(1)).to.be.equal(await tacEVM.balanceOf(await pool.getAddress()));
        expect(await pool.getAddress()).to.be.equal(PoolAddress);


    });


    it ("CurveLiteTwocryptoswap test add liquidity", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("add liquidity");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await curveLiteStableProxy.getAddress();
        const methodName = "addLiquidity(bytes,bytes)";

        const amountA = 10000n*10n**(await sttonEVM.decimals())
        const amountB = 10000n*10n**(await tacEVM.decimals())

        //await testSdk.lockNativeTacOnCrossChainLayer(amountA);

        const sttonTokenMintInfo: TokenMintInfo = {
            info: sttonTokenInfo,
            amount: amountA,
        }
        const tacTokenMintInfo: TokenMintInfo = {
            info: tacTokenInfo,
            amount: amountB,
        }

        const encodedParameters = new ethers.AbiCoder().encode(
            ['tuple(address, uint256[], uint256)'],
            [
                [
                    await pool.getAddress(),
                    [amountA, amountB],
                    0n
                ]
            ],
        );

        const balanceBeforeA = await pool.balances(0);
        const balanceBeforeB = await pool.balances(1);
        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey, // shardsKey
            target, // proxy address
            methodName, // method name
            encodedParameters, // encoded arguments
            tvmWalletCaller, // tvm caller
            [sttonTokenMintInfo, tacTokenMintInfo], // mint tokens
            [], // unlock tokens
            0n, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );

        expect(balanceBeforeA+amountA).to.be.equal(await pool.balances(0));
        expect(balanceBeforeB+amountB).to.be.equal(await pool.balances(1));

        // check bridge lp back to user
        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await curveLiteStableProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(1);

        // check lp token locked
        const liquidity = await pool.balanceOf(testSdk.getCrossChainLayerAddress());
        expect(liquidity).to.gte(0n);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(await pool.getAddress());
        expect(outMessage.tokensLocked[0].amount).to.be.equal(liquidity);

    });

    it ("CurveLiteTwocryptoswap test exchange", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("exchange");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await curveLiteStableProxy.getAddress();
        const methodName = "exchange(bytes,bytes)";

        const amount = 1n*10n**(await sttonEVM.decimals());


        const sttonTokenMintInfo: TokenMintInfo = {
            info: sttonTokenInfo,
            amount: amount,
        }

        const encodedParameters = new ethers.AbiCoder().encode(
            ['tuple(address, uint256, uint256, uint256, uint256)'],
            [
                [
                    await pool.getAddress(),
                    0,
                    1,
                    amount,
                    0
                ]
            ],
        );

        const balanceBeforeA = await pool.balances(0);
        const balanceBeforeB = await pool.balances(1);
        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey, // shardsKey
            target, // proxy address
            methodName, // method name
            encodedParameters, // encoded arguments
            tvmWalletCaller, // tvm caller
            [sttonTokenMintInfo], // mint tokens
            [], // unlock tokens
            0n, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );
        expect(balanceBeforeA + amount).to.be.equal(await pool.balances(0));
        expect(balanceBeforeB).to.be.gt(await pool.balances(1));

        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await curveLiteStableProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(0);
    });

    it ("CurveLiteTwocryptoswap test remove liquidity", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("exchange");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await curveLiteStableProxy.getAddress();
        const methodName = "removeLiquidity(bytes,bytes)";

        const amount = 1n*10n**(await pool.decimals()-5n);


        const liquidityTokenUnlockInfo: TokenUnlockInfo = {
            evmAddress: await pool.getAddress(),
            amount: amount,
        }

        const encodedParameters = new ethers.AbiCoder().encode(
            ['tuple(address, uint256, uint256[])'],
            [
                [
                    await pool.getAddress(),
                    amount,
                    [0, 0]
                ]
            ],
        );

        const balanceBeforeA = await pool.balances(0);
        const balanceBeforeB = await pool.balances(1);
        const liquidityBefore = await pool.balanceOf(testSdk.getCrossChainLayerAddress());
        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey, // shardsKey
            target, // proxy address
            methodName, // method name
            encodedParameters, // encoded arguments
            tvmWalletCaller, // tvm caller
            [], // mint tokens
            [liquidityTokenUnlockInfo], // unlock tokens
            0n, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );
        expect(balanceBeforeA).to.be.gt(await pool.balances(0));
        expect(balanceBeforeB).to.be.gt(await pool.balances(1));
        expect(liquidityBefore-amount).to.be.equal(await pool.balanceOf(testSdk.getCrossChainLayerAddress()));
        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(0);
    });

   
});

