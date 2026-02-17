import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { Signer } from "ethers";

import { TacLocalTestSdk, TokenUnlockInfo } from "@tonappchain/evm-ccl";
import { deployMidasProxy } from "../scripts/Midas/deployMidasProxy";
import { ISAFactory, MidasProxy } from "../typechain-types";
import { midasTestnetConfig } from "../scripts/Midas/config/testnetConfig";
import { reset, setStorageAt } from "@nomicfoundation/hardhat-network-helpers"
import {TAC_MAINNET_URL} from "../hardhat.config";


const TON_TOKEN_ADDRESS = "0xb76d91340F5CE3577f0a056D29f6e3Eb4E88B140"

describe("MidasProxy", function () {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let midasProxy: MidasProxy;
    let tonToken: any;
    let depositVault: any;
    let redemptionVault: any;
    let tacSAFactory: ISAFactory;
    let mTokenAmount: bigint;
    let mTokenAddress: string;

    before(async function () {
        await reset(TAC_MAINNET_URL, 8629415);
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);     
        
        await setStorageAt(TON_TOKEN_ADDRESS, 2, await admin.getAddress());
        tonToken = new ethers.Contract(TON_TOKEN_ADDRESS, ['function mint(address,uint256) external', 'function balanceOf(address) external view returns (uint256)'], admin) as unknown;
        tacSAFactory = await hre.ethers.getContractAt("ISAFactory", testSdk.getSmartAccountFactoryAddress()) as unknown as ISAFactory;
        depositVault = new ethers.Contract(midasTestnetConfig.depositVaultAddress, ['function currentRequestId() external view returns (uint256)'], admin) as unknown;
        redemptionVault = new ethers.Contract(midasTestnetConfig.redemptionVaultAddress, ['function currentRequestId() external view returns (uint256)'], admin) as unknown;
        midasProxy = await deployMidasProxy(admin, await tacSAFactory.getAddress(), midasTestnetConfig.depositVaultAddress, midasTestnetConfig.redemptionVaultAddress, crossChainLayerAddress);
        
    });


    it("midas deposit instant", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("deposit instant");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await midasProxy.getAddress();
        const methodName = "depositInstant(bytes,bytes)";

        const amount = ethers.parseUnits("1000", 9n)
        await tonToken.mint(await midasProxy.getAddress(), amount);

        const encodedArguments = new ethers.AbiCoder().encode(
            ['address', 'uint256', 'uint256', 'bytes32'],
            [
                TON_TOKEN_ADDRESS, // tokenIn
                amount, // amountToken
                0n, // minReceiveAmount
                ethers.encodeBytes32String("0x") // referrerId
            ]
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
        );

        const outMessage = outMessages[0];
        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(midasTestnetConfig.mToken);
        expect(outMessage.tokensLocked[0].amount).to.be.gt(0);
        mTokenAmount = BigInt(outMessage.tokensLocked[0].amount);
        mTokenAddress = String(outMessage.tokensLocked[0].evmAddress);
        
    });

    it("midas deposit request", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("deposit request");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await midasProxy.getAddress();
        const methodName = "depositRequest(bytes,bytes)";

        const amount = ethers.parseUnits("1000", 9n)
        await tonToken.mint(await midasProxy.getAddress(), amount);

        const encodedArguments = new ethers.AbiCoder().encode(
            ['address', 'uint256', 'bytes32'],
            [
                TON_TOKEN_ADDRESS, // tokenIn
                amount, // amountToken
                ethers.encodeBytes32String("0x") // referrerId
            ]
        );

        const currentRequestId = await depositVault.currentRequestId();


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
        const currentRequestIdAfter = await depositVault.currentRequestId();
        expect(currentRequestIdAfter).to.be.equal(currentRequestId + 1n);

    });

    it("midas redeem instant via bridge", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("redeem instant");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await midasProxy.getAddress();
        const methodName = "redeemInstant(bytes,bytes)";

        const amount = mTokenAmount / 4n

        const encodedArguments = new ethers.AbiCoder().encode(
            ['address', 'uint256', 'uint256', "bool"],
            [
                TON_TOKEN_ADDRESS, // tokenOut
                amount, // amountMTokenIn
                0n, // minReceiveAmount
                false // fromSmartAccount: true if redeeming from smart account balance, false if redeeming from bridge
            ]
        );



        const unlockTokens: TokenUnlockInfo[] = [{
            evmAddress: mTokenAddress,
            amount: amount,
        }]

        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [],
            unlockTokens,
            0n,
            extraData,
            operationId,
            timestamp
        );
        const outMessage = outMessages[0];
        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(TON_TOKEN_ADDRESS);
        expect(outMessage.tokensLocked[0].amount).to.be.gt(0);
    });


    it("midas redeem request", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("redeem request");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await midasProxy.getAddress();
        const methodName = "redeemRequest(bytes,bytes)";

        const amount = (mTokenAmount / 2n) - 1n

        const encodedArguments = new ethers.AbiCoder().encode(
            ['address', 'uint256', "bool"],
            [
                TON_TOKEN_ADDRESS, // tokenOut
                amount, // amountMTokenIn
                false // fromSmartAccount: true if redeeming from smart account balance, false if redeeming from bridge
            ]
        );



        const unlockTokens: TokenUnlockInfo[] = [{
            evmAddress: mTokenAddress,
            amount: amount,
        }]

        const currentRequestId = await redemptionVault.currentRequestId();

        await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [],
            unlockTokens,
            0n,
            extraData,
            operationId,
            timestamp
        );
        const currentRequestIdAfter = await redemptionVault.currentRequestId();
        expect(currentRequestIdAfter).to.be.equal(currentRequestId + 1n);
    });

    it("claim sa", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("claim sa");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await midasProxy.getAddress();
        const methodName = "claimSA(bytes,bytes)";

        const saAddress = await tacSAFactory.getSmartAccountForApplication(tvmWalletCaller, await midasProxy.getAddress());

        await tonToken.connect(admin).mint(saAddress, ethers.parseUnits("1000", 9n))
        
        const encodedArguments = new ethers.AbiCoder().encode(
            ['address'],
            [
                TON_TOKEN_ADDRESS,// token to claim, can be underlying token, mToken or any other token
            ]
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
        );

        const outMessage = outMessages[0];
        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(TON_TOKEN_ADDRESS);
        expect(outMessage.tokensLocked[0].amount).to.be.gt(0);
    });


});
