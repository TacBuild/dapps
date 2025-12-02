import hre, { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";

import { TacLocalTestSdk, TokenUnlockInfo} from "@tonappchain/evm-ccl";
import { OrbsProxy, ISAFactory } from "../typechain-types";
import { setStorageAt, impersonateAccount, time, mine} from "@nomicfoundation/hardhat-network-helpers"
import { reset } from "@nomicfoundation/hardhat-network-helpers"
import { deployOrbsProxy } from "../scripts/Orbs/deployProxy";
import { orbsMainnetConfig } from "../scripts/Orbs/config/config";
import IMultiAccountAbi from "../artifacts/contracts/proxies/Orbs/interface/IMultiAccount.sol/IMultiAccount.json";
const USDT_MAINNET_ADDRESS = "0xAF988C3f7CB2AceAbB15f96b19388a259b6C438f"

describe("OrbsProxy", function () {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let orbsProxy: OrbsProxy;
    let tacSAFactory: ISAFactory;
    let usdt: any;
    let accountAddress: string;
    let multiAccount: any;
   

    before(async function () {
        //9992809
        await reset(process.env.TAC_MAINNET_URL || "", 9997707);
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        tacSAFactory = await hre.ethers.getContractAt("ISAFactory", testSdk.getSmartAccountFactoryAddress()) as unknown as ISAFactory;
        orbsProxy = await deployOrbsProxy(admin, crossChainLayerAddress, await tacSAFactory.getAddress());
        usdt = new ethers.Contract(USDT_MAINNET_ADDRESS, ['function mint(address,uint256) external', 'function balanceOf(address) external view returns (uint256)'], admin) as unknown;
        await setStorageAt(USDT_MAINNET_ADDRESS,2,await admin.getAddress());
        multiAccount = new ethers.Contract(orbsMainnetConfig.multiAccountAddress, ['function accounts(address,uint256) external view returns(address,string)', 'function referrals(address) external view returns(address)'], admin) as unknown;
    });

    it("add account", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Deposit to Vault");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await orbsProxy.getAddress();
        const methodName = "addAccount(bytes,bytes)";
        const account = await tacSAFactory.getSmartAccountForApplication(tvmWalletCaller, await orbsProxy.getAddress());

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
        accountAddress = await multiAccount.accounts(account, 0);
        expect(accountAddress[0]).to.be.not.equal(ethers.ZeroAddress);
        expect(accountAddress[1]).to.be.equal(name);
    });

    it("add account with referral", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Add account with referral");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await orbsProxy.getAddress();
        const methodName = "addAccountWithReferral(bytes,bytes)";
        const account = await tacSAFactory.getSmartAccountForApplication(tvmWalletCaller, await orbsProxy.getAddress());

        const name = "New";
        const referrer = "0x342A092906e3d48e11f0477e322340C462a3CE2f";
            const encodedArguments = new ethers.AbiCoder().encode(
                ['string', 'address'],
                [name, referrer]
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
        expect(await multiAccount.referrals(account)).to.be.equal(referrer);
        // const multiAccountContract = new ethers.Contract(await multiAccount.getAddress(), IMultiAccountAbi.abi, admin);
        // const eventFilter = multiAccountContract.filters.AddAccount
        // const events = await multiAccount.queryFilter(eventFilter, -1);
        // const event = events[0] as unknown as { args: { user: string, account: string, name: string } };
        const accAddr2 = await multiAccount.accounts(account, 1);
        expect(accAddr2[0]).to.be.not.equal(ethers.ZeroAddress);
        expect(accAddr2[1]).to.be.equal(name);
    });


    it("add account with referral and deposit and allocate", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Op2");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP8BmKn59TGly2Jk";

        const target = await orbsProxy.getAddress();
        const methodName = "addAccountWithReferralAndDepositAndAllocate(bytes,bytes)";
        await usdt.connect(admin).mint(await orbsProxy.getAddress(), ethers.parseUnits("100", 6));
        const account = await tacSAFactory.getSmartAccountForApplication(tvmWalletCaller, await orbsProxy.getAddress());
        const amount = ethers.parseUnits("100", 6);
        const name = "New3";
        const referrer = "0x543737D90160b64FC27f92A9B359297EB2B0d974";
        const encodedArguments = new ethers.AbiCoder().encode(
            ['string', 'address', 'uint256'],
            [name, referrer, amount]
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
        const multiAccountContract = new ethers.Contract(await multiAccount.getAddress(), IMultiAccountAbi.abi, admin);
        const eventFilter = multiAccountContract.filters.DepositForAccount
        const events = await multiAccount.queryFilter(eventFilter, -1);
        const event = events[0] as unknown as { args: { user: string, account: string, amount: string } };
        expect(event.args.user).to.be.equal(account);
        expect(event.args.amount).to.be.equal(amount);
        
        const eventFilter2 = multiAccountContract.filters.AllocateForAccount
        const events2 = await multiAccount.queryFilter(eventFilter, -1);
        const event2 = events[0] as unknown as { args: { user: string, account: string, amount: string } };
        expect(event2.args.user).to.be.equal(account);
        expect(event2.args.amount).to.be.equal(amount);
    })


    
    it("edit account name", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Deposit to Vault");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await orbsProxy.getAddress();
        const methodName = "editAccountName(bytes,bytes)";

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
        accountAddress = await multiAccount.accounts(account, 0);
        expect(accountAddress[0]).to.be.not.equal(ethers.ZeroAddress);
        expect(accountAddress[1]).to.be.equal(name);
    })

    it("deposit and allocate for account", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Deposit to Vault");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await orbsProxy.getAddress();
        const methodName = "depositAndAllocateForAccount(bytes,bytes)";
        await usdt.connect(admin).mint(await orbsProxy.getAddress(), ethers.parseUnits("100", 6));
        const account = await tacSAFactory.getSmartAccountForApplication(tvmWalletCaller, await orbsProxy.getAddress());
        const amount = ethers.parseUnits("100", 6);
        const encodedArguments = new ethers.AbiCoder().encode(
            ['address', 'uint256'],
            [accountAddress[0], amount]
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
    it("delegate accesses", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Deposit to Vault");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await orbsProxy.getAddress();
        const methodName = "delegateAccesses(bytes,bytes)";
        const account = await tacSAFactory.getSmartAccountForApplication(tvmWalletCaller, await orbsProxy.getAddress());
        const selectors = ["0x12345678", "0x87654321"];
        const state = true;
        const encodedArguments = new ethers.AbiCoder().encode(
            ['address', 'address', 'bytes4[]', 'bool'],
            [accountAddress[0], target, selectors, state]
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

    it("deposit for account", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Deposit for account");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await orbsProxy.getAddress();
        const methodName = "depositForAccount(bytes,bytes)";
        await usdt.connect(admin).mint(await orbsProxy.getAddress(), ethers.parseUnits("100", 6));
        const account = await tacSAFactory.getSmartAccountForApplication(tvmWalletCaller, await orbsProxy.getAddress());
        const amount = ethers.parseUnits("100", 6);
        const encodedArguments = new ethers.AbiCoder().encode(
            ['address', 'uint256'],
            [accountAddress[0], amount]
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
    it("withdraw from account", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Deposit to Vault");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await orbsProxy.getAddress();
        const methodName = "withdrawFromAccount(bytes,bytes)";
        const amount = ethers.parseUnits("100", 6);
        await time.increase(12 * 60 * 60 * 24);
        await mine(10000)
        const encodedArguments = new ethers.AbiCoder().encode(
            ['address', 'uint256'],
            [accountAddress[0], amount]
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