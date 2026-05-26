import hre, { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { expect } from "chai";
import { reset, setStorageAt, getStorageAt, setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { upgradeCurveLiteTwocryptoswapProxy } from "../scripts/CurveLite/twocryptoswap/deployProxy";
import { TacLocalTestSdk, TokenMintInfo, TokenUnlockInfo } from "@tonappchain/evm-ccl";

import { CurveLiteTwocryptoswapProxy } from "../typechain-types";
import { ISAFactory } from "../typechain-types";

const PROXY_ADDRESS = "0x402879F4a18C79747177a91DDeAb1aB18f97503F"
const PROXY_STORAGE_SLOT_CROSS_CHAIN_LAYER = "0x9b777d7f09ca6843192b146ee41249650756fb313cbc428aa2dd37d610f1d100"
const PROXY_STORAGE_SLOT_OWNER = "0x9016d09d72d40fdae2fd8ceac6b6234c7706214fd39c1cd1e609a0528c199300"

const CB_BTC_ADDRESS = "0x7048c9e4aBD0cf0219E95a17A8C6908dfC4f0Ee4"
const CB_BTC_BALANCE_STORAGE_SLOT = "0x52c63247e1f47db19d5ce0460030c497f067ca4cebf71ba98eeadabe20bace00"
const USDT_ADDRESS = "0xAF988C3f7CB2AceAbB15f96b19388a259b6C438f"
const USDT_OWNER_STORAGE_SLOT = 2n
const pool_USDT_CBBTC_ADDRESS = "0xE5948A817d7A061a0eF40128E91379046Da1009e"

const WTAC_ADDRESS = "0xB63B9f0eb4A6E6f191529D71d4D88cc8900Df2C9"
const pool_USDT_WTAC_ADDRESS = "0xAaD47973427b39bE737C1154F50DD6595083FA88"

const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
const TAC_SA_FACTORY_ADDRESS = "0x070820Ed658860f77138d71f74EfbE173775895b"

describe("CurveLiteTwocryptoswapProxy", function () {
    
    let cbBTC: any;
    let wtac: any;
    let usdt: any;
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let curveLiteTwocryptoswapProxy: CurveLiteTwocryptoswapProxy;
    let liquidityAddedUsdtCbBtc: bigint;
    let liquidityAddedUsdtWtac: bigint;
    let crossChainLayerAddress: string;
    let tacSaFactory: ISAFactory;
    let smartAccount: any;

    before(async function () {
        await reset(process.env.TAC_MAINNET_URL);
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        crossChainLayerAddress = await testSdk.create(ethers.provider);
        await setStorageAt(PROXY_ADDRESS, PROXY_STORAGE_SLOT_CROSS_CHAIN_LAYER, crossChainLayerAddress);
        await setStorageAt(PROXY_ADDRESS, PROXY_STORAGE_SLOT_OWNER, await admin.getAddress());
        curveLiteTwocryptoswapProxy = await upgradeCurveLiteTwocryptoswapProxy();
        cbBTC = new ethers.Contract(CB_BTC_ADDRESS, ["function balanceOf(address) external view returns (uint256)"], admin) as unknown
        usdt = new ethers.Contract(USDT_ADDRESS, ["function balanceOf(address) external view returns (uint256)", "function mint(address,uint256) external"], admin) as unknown;
        wtac = new ethers.Contract(WTAC_ADDRESS, ["function deposit() external payable", "function transfer(address,uint256) external", "function balanceOf(address) external view returns (uint256)"], admin) as unknown;

        await setBalance(await admin.getAddress(), ethers.parseEther("100000000"));
        let tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk"
        tacSaFactory = new ethers.Contract(TAC_SA_FACTORY_ADDRESS, hre.artifacts.readArtifactSync('ISAFactory').abi, admin) as unknown as ISAFactory;
        smartAccount = await tacSaFactory.getSmartAccountForApplication(tvmWalletCaller, await curveLiteTwocryptoswapProxy.getAddress());
    });

    it ("CurveLiteTwocryptoswap test add liquidity CBBTC USDT", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("add liquidity");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await curveLiteTwocryptoswapProxy.getAddress();
        const methodName = "addLiquidity(bytes,bytes)";

        const amountA = ethers.parseUnits("77000", 6);
        const amountB = ethers.parseUnits("1", 8);

        await usdtMint(await curveLiteTwocryptoswapProxy.getAddress(), amountA, admin, crossChainLayerAddress, usdt);
        await setERC20Balance(CB_BTC_ADDRESS, await curveLiteTwocryptoswapProxy.getAddress(), amountB, CB_BTC_BALANCE_STORAGE_SLOT);

        const encodedParameters = new ethers.AbiCoder().encode(
            ['tuple(address,uint256[2],uint256)'],
            [
                [
                    pool_USDT_CBBTC_ADDRESS,
                    [amountA, amountB],
                    0
                ]
            ],
        );

        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey, // shardsKey
            target, // proxy address
            methodName, // method name
            encodedParameters, // encoded arguments
            tvmWalletCaller, // tvm caller
            [], // mint tokens
            [], // unlock tokens
            0n, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );
        
        expect(await usdt.balanceOf(await curveLiteTwocryptoswapProxy.getAddress())).to.be.eq(0);
        expect(await cbBTC.balanceOf(await curveLiteTwocryptoswapProxy.getAddress())).to.be.eq(0);
        expect(await usdt.balanceOf(smartAccount)).to.be.eq(0);
        expect(await cbBTC.balanceOf(smartAccount)).to.be.eq(0);

        // check bridge lp back to user
        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await curveLiteTwocryptoswapProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(pool_USDT_CBBTC_ADDRESS);
        expect(outMessage.tokensLocked[0].amount).to.be.gt(0);
        liquidityAddedUsdtCbBtc = BigInt(outMessage.tokensLocked[0].amount);
    }); 

    it ("CurveLiteTwocryptoswap test exchange USDT -> CBBTC", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("exchange");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await curveLiteTwocryptoswapProxy.getAddress();
        const methodName = "exchange(bytes,bytes)";

        const amount = ethers.parseUnits("10000", 6);
        await usdtMint(await curveLiteTwocryptoswapProxy.getAddress(), amount, admin, crossChainLayerAddress, usdt);


        const encodedParameters = new ethers.AbiCoder().encode(
            ['tuple(address,uint256,uint256,uint256,uint256)'],
            [
                [
                    pool_USDT_CBBTC_ADDRESS,
                    0,
                    1,
                    amount,
                    0
                ]
            ],
        );

        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey, // shardsKey
            target, // proxy address
            methodName, // method name
            encodedParameters, // encoded arguments
            tvmWalletCaller, // tvm caller
            [], // mint tokens
            [], // unlock tokens
            0n, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );

        expect(await usdt.balanceOf(smartAccount)).to.be.eq(0);
        expect(await cbBTC.balanceOf(smartAccount)).to.be.eq(0);
        expect(await usdt.balanceOf(await curveLiteTwocryptoswapProxy.getAddress())).to.be.eq(0);
        expect(await cbBTC.balanceOf(await curveLiteTwocryptoswapProxy.getAddress())).to.be.eq(0);

        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await curveLiteTwocryptoswapProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(CB_BTC_ADDRESS);
        expect(outMessage.tokensLocked[0].amount).to.be.gt(0);
    });

    it ("CurveLiteTwocryptoswap test remove liquidity one coin USDT", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("remove liquidity one coin");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await curveLiteTwocryptoswapProxy.getAddress();
        const methodName = "removeLiquidityOneCoin(bytes,bytes)";

        const amount = liquidityAddedUsdtCbBtc / 5n;


        const liquidityTokenUnlockInfo: TokenUnlockInfo = {
            evmAddress: pool_USDT_CBBTC_ADDRESS,
            amount: amount,
        }

        const encodedParameters = new ethers.AbiCoder().encode(
            ['tuple(address,uint256,int128,uint256)'],
            [
                [
                    pool_USDT_CBBTC_ADDRESS,
                    amount,
                    0n,
                    0n
                ]
            ],
        );

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
        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await curveLiteTwocryptoswapProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(USDT_ADDRESS);
        expect(outMessage.tokensLocked[0].amount).to.be.gt(0);
    });

    it ("CurveLiteTwocryptoswap test remove liquidity USDT CBBTC", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("exchange");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await curveLiteTwocryptoswapProxy.getAddress();
        const methodName = "removeLiquidity(bytes,bytes)";

        const amount = liquidityAddedUsdtCbBtc / 5n;


        const liquidityTokenUnlockInfo: TokenUnlockInfo = {
            evmAddress: pool_USDT_CBBTC_ADDRESS,
            amount: amount,
        }

        const encodedParameters = new ethers.AbiCoder().encode(
            ['tuple(address, uint256, uint256[2])'],
            [
                [
                    pool_USDT_CBBTC_ADDRESS,
                    amount,
                    [0, 0]
                ]
            ],
        );

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
        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await curveLiteTwocryptoswapProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(2);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(USDT_ADDRESS);
        expect(outMessage.tokensLocked[0].amount).to.be.gt(0);
        expect(outMessage.tokensLocked[1].evmAddress).to.be.equal(CB_BTC_ADDRESS);
        expect(outMessage.tokensLocked[1].amount).to.be.gt(0);
    });

    it ("CurveLiteTwocryptoswap test add liquidity USDT WTAC(as erc20)", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("add liquidity");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await curveLiteTwocryptoswapProxy.getAddress();
        const methodName = "addLiquidity(bytes,bytes)";

        const amountA = ethers.parseUnits("100", 6);
        const amountB = ethers.parseUnits("5555", 18);

        await usdtMint(await curveLiteTwocryptoswapProxy.getAddress(), amountA, admin, crossChainLayerAddress, usdt);
        await wtacSupply(await curveLiteTwocryptoswapProxy.getAddress(), amountB, admin, wtac);

        const encodedParameters = new ethers.AbiCoder().encode(
            ['tuple(address,uint256[2],uint256)'],
            [
                [
                    pool_USDT_WTAC_ADDRESS,
                    [amountA, amountB],
                    0
                ]
            ],
        );

        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey, // shardsKey
            target, // proxy address
            methodName, // method name
            encodedParameters, // encoded arguments
            tvmWalletCaller, // tvm caller
            [], // mint tokens
            [], // unlock tokens
            0n, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );

        expect(await usdt.balanceOf(smartAccount)).to.be.eq(0);
        expect(await wtac.balanceOf(smartAccount)).to.be.eq(0);
        expect(await usdt.balanceOf(await curveLiteTwocryptoswapProxy.getAddress())).to.be.eq(0);
        expect(await wtac.balanceOf(await curveLiteTwocryptoswapProxy.getAddress())).to.be.eq(0);
        expect(await ethers.provider.getBalance(smartAccount)).to.be.eq(0);
        expect(await ethers.provider.getBalance(await curveLiteTwocryptoswapProxy.getAddress())).to.be.eq(0);

        // check bridge lp back to user
        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await curveLiteTwocryptoswapProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(pool_USDT_WTAC_ADDRESS);
        expect(outMessage.tokensLocked[0].amount).to.be.gt(0);
        liquidityAddedUsdtWtac = BigInt(outMessage.tokensLocked[0].amount);
    });

    it ("CurveLiteTwocryptoswap test add liquidity USDT WTAC(as native)", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("add liquidity");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await curveLiteTwocryptoswapProxy.getAddress();
        const methodName = "addLiquidity(bytes,bytes)";

        const amountA = ethers.parseUnits("100", 6);
        const amountB = ethers.parseUnits("5555", 18);

        await usdtMint(await curveLiteTwocryptoswapProxy.getAddress(), amountA, admin, crossChainLayerAddress, usdt);
        await testSdk.lockNativeTacOnCrossChainLayer(amountB);

        const encodedParameters = new ethers.AbiCoder().encode(
            ['tuple(address,uint256[2],uint256)'],
            [
                [
                    pool_USDT_WTAC_ADDRESS,
                    [amountA, amountB],
                    0
                ]
            ],
        );

        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey, // shardsKey
            target, // proxy address
            methodName, // method name
            encodedParameters, // encoded arguments
            tvmWalletCaller, // tvm caller
            [], // mint tokens
            [], // unlock tokens
            amountB, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );

        expect(await usdt.balanceOf(smartAccount)).to.be.eq(0);
        expect(await wtac.balanceOf(smartAccount)).to.be.eq(0);
        expect(await usdt.balanceOf(await curveLiteTwocryptoswapProxy.getAddress())).to.be.eq(0);
        expect(await wtac.balanceOf(await curveLiteTwocryptoswapProxy.getAddress())).to.be.eq(0);
        expect(await ethers.provider.getBalance(smartAccount)).to.be.eq(0);
        expect(await ethers.provider.getBalance(await curveLiteTwocryptoswapProxy.getAddress())).to.be.eq(0);

        // check bridge lp back to user
        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await curveLiteTwocryptoswapProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(pool_USDT_WTAC_ADDRESS);
        expect(outMessage.tokensLocked[0].amount).to.be.gt(0);

    });
    
    it ("CurveLiteTwocryptoswap test exchange USDT -> WTAC", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("exchange");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await curveLiteTwocryptoswapProxy.getAddress();
        const methodName = "exchange(bytes,bytes)";

        const amount = ethers.parseUnits("10", 6);
        await usdtMint(await curveLiteTwocryptoswapProxy.getAddress(), amount, admin, crossChainLayerAddress, usdt);

        const encodedParameters = new ethers.AbiCoder().encode(
            ['tuple(address,uint256,uint256,uint256,uint256)'],
            [
                [
                    pool_USDT_WTAC_ADDRESS,
                    0,
                    1,
                    amount,
                    0
                ]
            ],
        );

        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey, // shardsKey
            target, // proxy address
            methodName, // method name
            encodedParameters, // encoded arguments
            tvmWalletCaller, // tvm caller
            [], // mint tokens
            [], // unlock tokens
            0n, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );

        expect(await usdt.balanceOf(smartAccount)).to.be.eq(0);
        expect(await wtac.balanceOf(smartAccount)).to.be.eq(0);
        expect(await usdt.balanceOf(await curveLiteTwocryptoswapProxy.getAddress())).to.be.eq(0);
        expect(await wtac.balanceOf(await curveLiteTwocryptoswapProxy.getAddress())).to.be.eq(0);
        expect(await ethers.provider.getBalance(smartAccount)).to.be.eq(0);
        expect(await ethers.provider.getBalance(await curveLiteTwocryptoswapProxy.getAddress())).to.be.eq(0);

        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await curveLiteTwocryptoswapProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(NATIVE);
        expect(outMessage.tokensLocked[0].amount).to.be.gt(0);
    });

    
    it ("CurveLiteTwocryptoswap test exchange WTAC(as erc20) -> USDT", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("exchange");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await curveLiteTwocryptoswapProxy.getAddress();
        const methodName = "exchange(bytes,bytes)";

        const amount = ethers.parseUnits("5555", 18);
        
        await wtacSupply(await curveLiteTwocryptoswapProxy.getAddress(), amount, admin, wtac);

        const encodedParameters = new ethers.AbiCoder().encode(
            ['tuple(address,uint256,uint256,uint256,uint256)'],
            [
                [
                    pool_USDT_WTAC_ADDRESS,
                    1,
                    0,
                    amount,
                    0
                ]
            ],
        );

        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey, // shardsKey
            target, // proxy address
            methodName, // method name
            encodedParameters, // encoded arguments
            tvmWalletCaller, // tvm caller
            [], // mint tokens
            [], // unlock tokens
            0n, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );

        expect(await usdt.balanceOf(smartAccount)).to.be.eq(0);
        expect(await wtac.balanceOf(smartAccount)).to.be.eq(0);
        expect(await usdt.balanceOf(await curveLiteTwocryptoswapProxy.getAddress())).to.be.eq(0);
        expect(await wtac.balanceOf(await curveLiteTwocryptoswapProxy.getAddress())).to.be.eq(0);
        expect(await ethers.provider.getBalance(smartAccount)).to.be.eq(0);
        expect(await ethers.provider.getBalance(await curveLiteTwocryptoswapProxy.getAddress())).to.be.eq(0);

        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await curveLiteTwocryptoswapProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(USDT_ADDRESS);
        expect(outMessage.tokensLocked[0].amount).to.be.gt(0);
    });

    it ("CurveLiteTwocryptoswap test exchange WTAC(as native) -> USDT", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("exchange");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await curveLiteTwocryptoswapProxy.getAddress();
        const methodName = "exchange(bytes,bytes)";

        const amount = ethers.parseUnits("5555", 18); 
        
        await testSdk.lockNativeTacOnCrossChainLayer(amount);

        const encodedParameters = new ethers.AbiCoder().encode(
            ['tuple(address,uint256,uint256,uint256,uint256)'],
            [
                [
                    pool_USDT_WTAC_ADDRESS,
                    1,
                    0,
                    amount,
                    0
                ]
            ],
        );

        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey, // shardsKey
            target, // proxy address
            methodName, // method name
            encodedParameters, // encoded arguments
            tvmWalletCaller, // tvm caller
            [], // mint tokens
            [], // unlock tokens
            amount, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );

        expect(await usdt.balanceOf(smartAccount)).to.be.eq(0);
        expect(await wtac.balanceOf(smartAccount)).to.be.eq(0);
        expect(await usdt.balanceOf(await curveLiteTwocryptoswapProxy.getAddress())).to.be.eq(0);
        expect(await wtac.balanceOf(await curveLiteTwocryptoswapProxy.getAddress())).to.be.eq(0);
        expect(await ethers.provider.getBalance(smartAccount)).to.be.eq(0);
        expect(await ethers.provider.getBalance(await curveLiteTwocryptoswapProxy.getAddress())).to.be.eq(0);

        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await curveLiteTwocryptoswapProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(USDT_ADDRESS);
        expect(outMessage.tokensLocked[0].amount).to.be.gt(0);
    });
    
    it ("CurveLiteTwocryptoswap test remove liquidity one coin WTAC", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("remove liquidity one coin");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await curveLiteTwocryptoswapProxy.getAddress();
        const methodName = "removeLiquidityOneCoin(bytes,bytes)";

        const amount = liquidityAddedUsdtWtac / 5n;


        const liquidityTokenUnlockInfo: TokenUnlockInfo = {
            evmAddress: pool_USDT_WTAC_ADDRESS,
            amount: amount,
        }

        const encodedParameters = new ethers.AbiCoder().encode(
            ['tuple(address,uint256,int128,uint256)'],
            [
                [
                    pool_USDT_WTAC_ADDRESS,
                    amount,
                    1n,
                    0n
                ]
            ],
        );

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

        expect(await usdt.balanceOf(smartAccount)).to.be.eq(0);
        expect(await wtac.balanceOf(smartAccount)).to.be.eq(0);
        expect(await usdt.balanceOf(await curveLiteTwocryptoswapProxy.getAddress())).to.be.eq(0);
        expect(await wtac.balanceOf(await curveLiteTwocryptoswapProxy.getAddress())).to.be.eq(0);
        expect(await ethers.provider.getBalance(smartAccount)).to.be.eq(0);
        expect(await ethers.provider.getBalance(await curveLiteTwocryptoswapProxy.getAddress())).to.be.eq(0);

        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await curveLiteTwocryptoswapProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(NATIVE);
        expect(outMessage.tokensLocked[0].amount).to.be.gt(0);
    });
    
    it ("CurveLiteTwocryptoswap test remove liquidity USDT WTAC", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("exchange");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await curveLiteTwocryptoswapProxy.getAddress();
        const methodName = "removeLiquidity(bytes,bytes)";

        const amount = liquidityAddedUsdtWtac / 5n;


        const liquidityTokenUnlockInfo: TokenUnlockInfo = {
            evmAddress: pool_USDT_WTAC_ADDRESS,
            amount: amount,
        }

        const encodedParameters = new ethers.AbiCoder().encode(
            ['tuple(address,uint256,uint256[2])'],
            [
                [
                    pool_USDT_WTAC_ADDRESS,
                    amount,
                    [0, 0]
                ]
            ],
        );

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

        expect(await usdt.balanceOf(smartAccount)).to.be.eq(0);
        expect(await wtac.balanceOf(smartAccount)).to.be.eq(0);
        expect(await usdt.balanceOf(await curveLiteTwocryptoswapProxy.getAddress())).to.be.eq(0);
        expect(await wtac.balanceOf(await curveLiteTwocryptoswapProxy.getAddress())).to.be.eq(0);
        expect(await ethers.provider.getBalance(smartAccount)).to.be.eq(0);
        expect(await ethers.provider.getBalance(await curveLiteTwocryptoswapProxy.getAddress())).to.be.eq(0);

        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await curveLiteTwocryptoswapProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(2);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(USDT_ADDRESS);
        expect(outMessage.tokensLocked[0].amount).to.be.gt(0);
        expect(outMessage.tokensLocked[1].evmAddress).to.be.equal(NATIVE);
        expect(outMessage.tokensLocked[1].amount).to.be.gt(0);
    });
});

async function setERC20Balance(tokenAddress: string, userAddress: string, balance: bigint, slot: string) {
    const index = ethers.solidityPackedKeccak256(
      ["uint256", "uint256"],
      [userAddress, slot]
    );
    await setStorageAt(tokenAddress, index, ethers.toBeHex(balance, 32));
  }

  async function usdtMint(userAddress: string, amount: bigint, admin: Signer, crossChainLayerAddress: string, usdt: any) {
    await setStorageAt(USDT_ADDRESS, USDT_OWNER_STORAGE_SLOT, await admin.getAddress());
    await usdt.connect(admin).mint(userAddress, amount);
    await setStorageAt(USDT_ADDRESS, USDT_OWNER_STORAGE_SLOT, crossChainLayerAddress);
  }

  async function wtacSupply(userAddress: string, amount: bigint, admin: Signer, wtac: any) {
    await wtac.connect(admin).deposit({value: amount});
    await wtac.connect(admin).transfer(userAddress, amount);
  }

