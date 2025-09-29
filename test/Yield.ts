import hre, { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";

import { deployYieldProxy } from "../scripts/Yield/deployProxy";
import { TacLocalTestSdk, TokenUnlockInfo} from "@tonappchain/evm-ccl";
import { YieldManagerProxy, ISAFactory } from "../typechain-types";
import { yiedMainnetConfig } from "../scripts/Yield/config/mainnetConfig";
import { setStorageAt, impersonateAccount} from "@nomicfoundation/hardhat-network-helpers"
import { reset } from "@nomicfoundation/hardhat-network-helpers"

const USDT_MAINNET_ADDRESS = "0xAF988C3f7CB2AceAbB15f96b19388a259b6C438f"
const orderExecutor = "0x944416e5dF03eE4c14EC44C01495005564e6b07E"

describe("YieldProxy", function () {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let yieldProxy: YieldManagerProxy;
    let tacSAFactory: ISAFactory;
    let usdt: any;
    let receipt: any;
    let yUsd: any;
    let manager: any;
    let redeemAmount: bigint;
   

    before(async function () {
        await reset(process.env.TAC_MAINNET_URL || "", 6467381);
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        tacSAFactory = await hre.ethers.getContractAt("ISAFactory", testSdk.getSmartAccountFactoryAddress()) as unknown as ISAFactory;
        yieldProxy = await deployYieldProxy(admin, yiedMainnetConfig.managerAddress, yiedMainnetConfig.yUSD, await tacSAFactory.getAddress(), crossChainLayerAddress);
        usdt = new ethers.Contract(USDT_MAINNET_ADDRESS, ['function mint(address,uint256) external', 'function balanceOf(address) external view returns (uint256)'], admin) as unknown;
        yUsd = new ethers.Contract(yiedMainnetConfig.yUSD, ['function balanceOf(address) external view returns (uint256)', 'function previewDeposit(uint256) external view returns (uint256)', 'function previewRedeem(uint256) external view returns (uint256)'], admin) as unknown;
        await setStorageAt(USDT_MAINNET_ADDRESS,2,await admin.getAddress());
        receipt = new ethers.Contract(yiedMainnetConfig.receiptAddress, ['function balanceOf(address) external view returns (uint256)', 'function counter() external view returns (uint256)'], admin) as unknown;
        manager = new ethers.Contract(yiedMainnetConfig.managerAddress, ['function executeOrder(uint256,uint256,uint256,uint256) external'], admin) as unknown;
    });

    it("deposit with Manage", async function () {
    const shardsKey = 1n;
    const operationId = ethers.encodeBytes32String("Deposit to Vault");
    const extraData = "0x";
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

    const target = await yieldProxy.getAddress();
    const methodName = "deposit(bytes,bytes)";

    const amount = ethers.parseUnits("100", 6n)
    const user = await tacSAFactory.getSmartAccountForApplication(tvmWalletCaller, await yieldProxy.getAddress());

    const executor = await ethers.getSigner(orderExecutor);
    await impersonateAccount(orderExecutor);

    await usdt.connect(admin).mint(await yieldProxy.getAddress(), amount);


        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,address,uint256,address,bytes,bytes32)'],
            [[
                yiedMainnetConfig.yUSD, /// yUSD address
                await usdt.getAddress(), /// asset address
                amount, /// amount
                ethers.ZeroAddress, // callback address
                "0x", // callback data
                ethers.encodeBytes32String("0x") // referral code
            ]]
        );
    expect(await receipt.connect(admin).balanceOf(user)).to.be.equal(0);
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
    )
    expect(await receipt.connect(admin).balanceOf(user)).to.be.equal(1n);

    const yUsdAmount = await yUsd.connect(admin).previewDeposit(amount);
    expect(await yUsd.connect(admin).balanceOf(user)).to.be.equal(0n);
    const orderId = await receipt.connect(admin).counter();
    console.log("orderId", orderId);
    await manager.connect(executor).executeOrder(orderId, yUsdAmount, 0, 0);
    expect(await yUsd.connect(admin).balanceOf(user)).to.be.gt(0n);

});



it("claim yUsd token", async function () {
    const shardsKey = 1n;
    const operationId = ethers.encodeBytes32String("Claim yToken");
    const extraData = "0x";
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

    const target = await yieldProxy.getAddress();
    const methodName = "claimYToken(bytes,bytes)";


    const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
        shardsKey,
        target,
        methodName,
        "0x",
        tvmWalletCaller,
        [],
        [],
        0n,
        extraData,
        operationId,
        timestamp
    )
    const outMessage = outMessages[0];
    expect(outMessage.tokensLocked.length).to.be.equal(1);
    expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(yiedMainnetConfig.yUSD);
    expect(outMessage.tokensLocked[0].amount).to.be.gt(0);
    redeemAmount = BigInt(outMessage.tokensLocked[0].amount);

});


it("redeem yUsd token", async function () {
    const shardsKey = 1n;
    const operationId = ethers.encodeBytes32String("Redeem yToken");
    const extraData = "0x";
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

    const target = await yieldProxy.getAddress();
    const methodName = "redeem(bytes,bytes)";

    const user = await tacSAFactory.getSmartAccountForApplication(tvmWalletCaller, await yieldProxy.getAddress());

    const executor = await ethers.getSigner(orderExecutor);
    await impersonateAccount(orderExecutor);
    const unlock : TokenUnlockInfo = {
        evmAddress: yiedMainnetConfig.yUSD,
        amount: redeemAmount
    }


        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,address,uint256,address,bytes)'],
            [[
                yiedMainnetConfig.yUSD,
                await usdt.getAddress(),
                redeemAmount,
                ethers.ZeroAddress,
                "0x"
            ]]
        );
    expect(await receipt.connect(admin).balanceOf(user)).to.be.equal(0);
    await testSdk.sendMessage(
        shardsKey,
        target,
        methodName,
        encodedArguments,
        tvmWalletCaller,
        [],
        [unlock],
        0n,
        extraData,
        operationId,
        timestamp
    )
    expect(await receipt.connect(admin).balanceOf(user)).to.be.equal(1n);

    const usdAmount = await yUsd.connect(admin).previewRedeem(redeemAmount);
    expect(await usdt.connect(admin).balanceOf(user)).to.be.equal(0n);
    const orderId = await receipt.connect(admin).counter();
    await manager.connect(executor).executeOrder(orderId, usdAmount, 0, 0);
    expect(await usdt.connect(admin).balanceOf(user)).to.be.gt(0n);

});

it("claim usdt token", async function () {
    const shardsKey = 1n;
    const operationId = ethers.encodeBytes32String("Claim usdToken");
    const extraData = "0x";
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

    const target = await yieldProxy.getAddress();
    const methodName = "claimAsset(bytes,bytes)";

    const encodedArguments = new ethers.AbiCoder().encode(
        ['address'],
        [await usdt.getAddress()]
    );


    const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
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
    )
    const outMessage = outMessages[0];
    expect(outMessage.tokensLocked.length).to.be.equal(1);
    expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(await usdt.getAddress());
    expect(outMessage.tokensLocked[0].amount).to.be.gt(0);

});



    

});