import hre, { ethers } from "hardhat";
import { AddressLike, BytesLike, Signer } from "ethers";
import { expect } from "chai";

import { TacLocalTestSdk, TokenMintInfo, TokenUnlockInfo} from "@tonappchain/evm-ccl";
import { ERC20 } from "@tonappchain/evm-ccl/dist/typechain-types";
import { LucidlyVaultProxy, ILucidlyTeller, ILucidlyQueue, IBoringVault, ISAFactory, IERC20 } from "../typechain-types";
import { deployLucidlyVault } from "../scripts/Lucidly/LucidlyVaultDeploy";
import { reset, setStorageAt } from "@nomicfoundation/hardhat-network-helpers";
import { lucidlyVaultMainnetConfig } from "../scripts/Lucidly/config/LucidlyMainnet.config";

const usdtAddress = "0xAF988C3f7CB2AceAbB15f96b19388a259b6C438f"
const ownerStorageSlotUsdt = BigInt("2")

describe("LucidlyVaultProxy", function () {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let lucidlyVaultProxy: LucidlyVaultProxy;
    let tacSAFactory: ISAFactory;
    let teller: ILucidlyTeller;
    let queue: ILucidlyQueue;
    let lucidlyVault: IERC20;
    let usdt: any;
    before(async function () {
        await reset(process.env.TAC_MAINNET_URL);
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        tacSAFactory = new ethers.Contract(testSdk.getSmartAccountFactoryAddress(), hre.artifacts.readArtifactSync('ISAFactory').abi, admin) as unknown as ISAFactory;
        lucidlyVaultProxy = await deployLucidlyVault(admin, crossChainLayerAddress, await tacSAFactory.getAddress());
        await setStorageAt(usdtAddress, ownerStorageSlotUsdt, await admin.getAddress());
        
        usdt = new ethers.Contract(usdtAddress, ['function mint(address,uint256) external', 'function balanceOf(address) external view returns (uint256)'], admin) as unknown;
        teller = new ethers.Contract(lucidlyVaultMainnetConfig.teller, hre.artifacts.readArtifactSync('ILucidlyTeller').abi, admin) as unknown as ILucidlyTeller;
        queue = new ethers.Contract(lucidlyVaultMainnetConfig.queue, hre.artifacts.readArtifactSync('ILucidlyQueue').abi, admin) as unknown as ILucidlyQueue;
        lucidlyVault = new ethers.Contract(lucidlyVaultMainnetConfig.lucidlyVault, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as IERC20;
        
    });

    it("Lucidly vault deposit", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Deposit to vault");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await lucidlyVaultProxy.getAddress();
        const methodName = "deposit(bytes,bytes)";
        const depositAmount = ethers.parseUnits("10000", 6);
        await usdt.connect(admin).mint(await lucidlyVaultProxy.getAddress(), depositAmount);



        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,uint256,uint256)'],
            [[
                usdtAddress,
                depositAmount,
                0n
            ]]
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

    });

    it("Tac vault withdraw funds", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Withdraw funds");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await lucidlyVaultProxy.getAddress();
        const methodName = "withdrawFunds(bytes,bytes)";

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address)'],
            [[
                await lucidlyVault.getAddress(),
            ]]
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
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(await lucidlyVault.getAddress());
        expect(outMessage.tokensLocked[0].amount).to.be.gt(0);
    });

    it("Tac vault withdraw", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Withdraw request");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await lucidlyVaultProxy.getAddress();
        const methodName = "withdrawRequest(bytes,bytes)";

        const withdrawAmount = ethers.parseUnits("1", 6n);
        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,uint256,uint256,uint256)'],
            [[
                usdtAddress,
                withdrawAmount,
                1n,
                9999n
            ]]
        );

        const withdrawTokens: TokenUnlockInfo[] = [
            {
                evmAddress: await lucidlyVault.getAddress(),
                amount: withdrawAmount
            }
        ];

        await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [],
            withdrawTokens,
            0n,
            extraData,
            operationId,
            timestamp
        );
    }); 
});