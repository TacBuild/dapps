import hre, { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { expect } from "chai";
import { reset, setStorageAt, getStorageAt } from "@nomicfoundation/hardhat-network-helpers";
import { upgradeCurveLiteStableswapProxy } from "../scripts/CurveLite/stableswap/deployStableSwapProxy";
import { TacLocalTestSdk, TokenUnlockInfo } from "@tonappchain/evm-ccl";


import { CurveLiteStableswapProxy, ISAFactory } from "../typechain-types";

const PROXY_ADDRESS = "0xfC99BD3dAABAcAC47c1040421A3Fb05bbf8c2b4b"
const PROXY_STORAGE_SLOT_CROSS_CHAIN_LAYER = "0x9b777d7f09ca6843192b146ee41249650756fb313cbc428aa2dd37d610f1d100"
const PROXY_STORAGE_SLOT_OWNER = "0x9016d09d72d40fdae2fd8ceac6b6234c7706214fd39c1cd1e609a0528c199300"
const USDT_ADDRESS = "0xAF988C3f7CB2AceAbB15f96b19388a259b6C438f"
const ownerStorageSlotUsdt = 2n
const poolUSDT_USN_ADDRESS = "0x24894F0c4f80837d61CA21730A75Fa216FED7200"
const USN_ADDRESS = "0x51A30E647D33A044967FA3DBb04d6ED6F45455F6"
const USN_BALANCE_STORAGE_SLOT = "0x52c63247e1f47db19d5ce0460030c497f067ca4cebf71ba98eeadabe20bace00"
const TAC_SA_FACTORY_ADDRESS = "0x070820Ed658860f77138d71f74EfbE173775895b"



describe("CurveLiteStableProxy", function () {

    
    let USDT: any;
    let USN: any;

    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let curveLiteStableProxy: CurveLiteStableswapProxy;
    let crossChainLayerAddress: string;
    let liquidityAdded: bigint;
    let tacSaFactory: ISAFactory;
    let smartAccount: string;
    before(async function () {
        await reset(process.env.TAC_MAINNET_URL);
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        crossChainLayerAddress = await testSdk.create(ethers.provider);
        await setStorageAt(PROXY_ADDRESS, PROXY_STORAGE_SLOT_CROSS_CHAIN_LAYER, crossChainLayerAddress);
        await setStorageAt(PROXY_ADDRESS, PROXY_STORAGE_SLOT_OWNER, await admin.getAddress());
        curveLiteStableProxy = await upgradeCurveLiteStableswapProxy();

        USDT = new ethers.Contract(USDT_ADDRESS, ["function mint(address,uint256) external", "function balanceOf(address) external view returns (uint256)"], admin) as unknown
        USN = new ethers.Contract(USN_ADDRESS, ["function balanceOf(address) external view returns (uint256)"], admin) as unknown;
        let tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";
        tacSaFactory = new ethers.Contract(TAC_SA_FACTORY_ADDRESS, hre.artifacts.readArtifactSync('ISAFactory').abi, admin) as unknown as ISAFactory;
        smartAccount = await tacSaFactory.getSmartAccountForApplication(tvmWalletCaller, await curveLiteStableProxy.getAddress());
    });


    it ("CurveLiteStableProxy test add liquidity USDT USN", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("add liquidity");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await curveLiteStableProxy.getAddress();
        const methodName = "addLiquidity(bytes,bytes)";

        const amountA = ethers.parseUnits("5", 18);
        const amountB = ethers.parseUnits("5", 6);

        await usdtMint(await curveLiteStableProxy.getAddress(), amountB, admin, crossChainLayerAddress, USDT);
        await setERC20Balance(USN_ADDRESS, await curveLiteStableProxy.getAddress(), amountA, USN_BALANCE_STORAGE_SLOT);

        const encodedParameters = new ethers.AbiCoder().encode(
            ['tuple(address, uint256[], uint256)'],
            [
                [
                    poolUSDT_USN_ADDRESS,
                    [amountA, amountB],
                    0n
                ]
            ],
        );
        
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedParameters,
            tvmWalletCaller,
            [],
            [],
            0n,
            extraData,
            operationId,
            timestamp
        );

        expect(await USDT.balanceOf(await curveLiteStableProxy.getAddress())).to.be.eq(0);
        expect(await USN.balanceOf(await curveLiteStableProxy.getAddress())).to.be.eq(0);
        expect(await USDT.balanceOf(smartAccount)).to.be.eq(0);
        expect(await USN.balanceOf(smartAccount)).to.be.eq(0);

        // check bridge lp back to user
        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await curveLiteStableProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(poolUSDT_USN_ADDRESS);
        expect(outMessage.tokensLocked[0].amount).to.be.gt(0);
        liquidityAdded = BigInt(outMessage.tokensLocked[0].amount);
    });

    it ("CurveLiteStableProxy test exchange USN -> USDT", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("exchange");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await curveLiteStableProxy.getAddress();
        const methodName = "exchange(bytes,bytes)";

        const amountA = ethers.parseUnits("5", 18);
        await setERC20Balance(USN_ADDRESS, await curveLiteStableProxy.getAddress(), amountA, USN_BALANCE_STORAGE_SLOT);

        const encodedParameters = new ethers.AbiCoder().encode(
            ['tuple(address, uint256, uint256, uint256, uint256)'],
            [
                [
                    poolUSDT_USN_ADDRESS,
                    0,
                    1,
                    amountA,
                    0
                ]
            ],
        );

        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedParameters,
            tvmWalletCaller,
            [],
            [],
            0n,
            extraData,
            operationId,
            timestamp
        );

        expect(await USDT.balanceOf(smartAccount)).to.be.eq(0);
        expect(await USN.balanceOf(smartAccount)).to.be.eq(0);
        expect(await USDT.balanceOf(await curveLiteStableProxy.getAddress())).to.be.eq(0);
        expect(await USN.balanceOf(await curveLiteStableProxy.getAddress())).to.be.eq(0);

        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await curveLiteStableProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(USDT_ADDRESS);
        expect(outMessage.tokensLocked[0].amount).to.be.gt(0);
    });

    it ("CurveLiteStableProxy test remove liquidity USDT USN", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("exchange");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await curveLiteStableProxy.getAddress();
        const methodName = "removeLiquidity(bytes,bytes)";

        const amount = liquidityAdded / 5n


        const liquidityTokenUnlockInfo: TokenUnlockInfo = {
            evmAddress: poolUSDT_USN_ADDRESS,
            amount: amount,
        }

        const encodedParameters = new ethers.AbiCoder().encode(
            ['tuple(address, uint256, uint256[])'],
            [
                [
                    poolUSDT_USN_ADDRESS,
                    amount,
                    [0, 0]
                ]
            ],
        );

        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedParameters,
            tvmWalletCaller,
            [],
            [liquidityTokenUnlockInfo],
            0n,
            extraData,
            operationId,
            timestamp
        );

        expect(await USDT.balanceOf(smartAccount)).to.be.eq(0);
        expect(await USN.balanceOf(smartAccount)).to.be.eq(0);
        expect(await USDT.balanceOf(await curveLiteStableProxy.getAddress())).to.be.eq(0);
        expect(await USN.balanceOf(await curveLiteStableProxy.getAddress())).to.be.eq(0);

        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.tokensLocked.length).to.be.equal(2);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(USN_ADDRESS);
        expect(outMessage.tokensLocked[0].amount).to.be.gt(0);
        expect(outMessage.tokensLocked[1].evmAddress).to.be.equal(USDT_ADDRESS);
        expect(outMessage.tokensLocked[1].amount).to.be.gt(0);
    });

    it ("CurveLiteStableProxy test remove liquidity one coin USN", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("exchange");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await curveLiteStableProxy.getAddress();
        const methodName = "remove_liquidity_one_coin(bytes,bytes)";

        const amount = liquidityAdded / 5n;


        const liquidityTokenUnlockInfo: TokenUnlockInfo = {
            evmAddress: poolUSDT_USN_ADDRESS,
            amount: amount,
        }

        const encodedParameters = new ethers.AbiCoder().encode(
            ['tuple(address, uint256, int128, uint256)'],
            [
                [
                    poolUSDT_USN_ADDRESS,
                    amount,
                    0n,
                    0n
                ]
            ],
        );

        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedParameters,
            tvmWalletCaller,
            [],
            [liquidityTokenUnlockInfo],
            0n,
            extraData,
            operationId,
            timestamp
        );

        expect(await USDT.balanceOf(smartAccount)).to.be.eq(0);
        expect(await USN.balanceOf(smartAccount)).to.be.eq(0);
        expect(await USDT.balanceOf(await curveLiteStableProxy.getAddress())).to.be.eq(0);
        expect(await USN.balanceOf(await curveLiteStableProxy.getAddress())).to.be.eq(0);

        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(USN_ADDRESS);
        expect(outMessage.tokensLocked[0].amount).to.be.gt(0);
    });

   
});

async function setERC20Balance(tokenAddress: string, userAddress: string, balance: bigint, slot: string) {
    const index = ethers.solidityPackedKeccak256(
      ["uint256", "uint256"],
      [userAddress, slot]
    );
    await setStorageAt(tokenAddress, index, ethers.toBeHex(balance, 32));
  }

async function usdtMint(target: string, amount: bigint, signer: Signer, crossChainLayerAddress: string, usdt: any) {
    await setStorageAt(USDT_ADDRESS, ownerStorageSlotUsdt, await signer.getAddress());
    await usdt.connect(signer).mint(target, amount);
    await setStorageAt(USDT_ADDRESS, ownerStorageSlotUsdt, crossChainLayerAddress);
}