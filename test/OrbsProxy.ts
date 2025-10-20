import hre, { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";

import { TacLocalTestSdk, TokenUnlockInfo} from "@tonappchain/evm-ccl";
import { OrbsProxy, ISAFactory } from "../typechain-types";
import { setStorageAt, impersonateAccount} from "@nomicfoundation/hardhat-network-helpers"
import { reset } from "@nomicfoundation/hardhat-network-helpers"
import { deployOrbsProxy } from "../scripts/Orbs/deployProxy";

const USDT_MAINNET_ADDRESS = "0xAF988C3f7CB2AceAbB15f96b19388a259b6C438f"

describe("OrbsProxy", function () {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let orbsProxy: OrbsProxy;
    let tacSAFactory: ISAFactory;
    let usdt: any;
   

    before(async function () {
        await reset(process.env.TAC_MAINNET_URL || "", 6467381);
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        tacSAFactory = await hre.ethers.getContractAt("ISAFactory", testSdk.getSmartAccountFactoryAddress()) as unknown as ISAFactory;
        orbsProxy = await deployOrbsProxy(admin, crossChainLayerAddress, await tacSAFactory.getAddress());
        // usdt = new ethers.Contract(USDT_MAINNET_ADDRESS, ['function mint(address,uint256) external', 'function balanceOf(address) external view returns (uint256)'], admin) as unknown;
        // await setStorageAt(USDT_MAINNET_ADDRESS,2,await admin.getAddress());
    });

    it("add account", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Deposit to Vault");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await orbsProxy.getAddress();
        const methodName = "addAccount(bytes,bytes)";

        const name = "test";
            const encodedArguments = new ethers.AbiCoder().encode(
                ['string'],
                [name]
            );
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
    });
    
    it("edit account name", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Deposit to Vault");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await orbsProxy.getAddress();
        const methodName = "editAccountName(bytes,bytes)";

        //TODO account? 
        const account = await tacSAFactory.getSmartAccountForApplication(tvmWalletCaller, await orbsProxy.getAddress());
        const name = "test2";
        const encodedArguments = new ethers.AbiCoder().encode(
            ['address', 'string'],
            [account, name]
        );
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
    })

    it("deposit and allocate for account", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Deposit to Vault");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await orbsProxy.getAddress();
        const methodName = "depositAndAllocateForAccount(bytes,bytes)";
        // TODO account? 
        const account = await tacSAFactory.getSmartAccountForApplication(tvmWalletCaller, await orbsProxy.getAddress());
        const amount = ethers.parseUnits("100", 6);
        const encodedArguments = new ethers.AbiCoder().encode(
            ['address', 'uint256'],
            [account, amount]
        );
        // TODO mint usdt for a proxy to immitate bridge
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
    })
    it("delegate accesses", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Deposit to Vault");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await orbsProxy.getAddress();
        const methodName = "delegateAccesses(bytes,bytes)";
        // TODO correct selectors, state, target and account
        const account = await tacSAFactory.getSmartAccountForApplication(tvmWalletCaller, await orbsProxy.getAddress());
        const amount = ethers.parseUnits("100", 6);
        const selectors = [0x12345678, 0x87654321];
        const state = true;
        const encodedArguments = new ethers.AbiCoder().encode(
            ['address', 'address', 'bytes4[]', 'bool'],
            [account, target, selectors, state]
        );
        // TODO mint usdt for a proxy to immitate bridge
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
    })
    it("withdraw from account", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Deposit to Vault");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await orbsProxy.getAddress();
        const methodName = "withdrawFromAccount(bytes,bytes)";
        // TODO account? 
        const account = await tacSAFactory.getSmartAccountForApplication(tvmWalletCaller, await orbsProxy.getAddress());
        const amount = ethers.parseUnits("100", 6);
        const encodedArguments = new ethers.AbiCoder().encode(
            ['address', 'uint256'],
            [account, amount]
        );
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
    })

});