import hre, { ethers } from "hardhat";
import { AddressLike, BytesLike, Signer } from "ethers";
import { expect } from "chai";

import { deployTacSAFactory } from "../scripts/TacSmartAccountFactory/FactoryDeploy";
import { deployTacSmartAccount } from "../scripts/TacSmartAccountFactory/SABlueprintDeploy";
import { TacLocalTestSdk, TokenMintInfo, TokenUnlockInfo} from "@tonappchain/evm-ccl";
import { sttonTokenInfo, tacTokenInfo, TONTokenInfo } from '../scripts/common/info/tokensInfo';
import { ERC20 } from "@tonappchain/evm-ccl/dist/typechain-types";
import { TacSAFactory, TacSmartAccount, TacBoringVaultProxy, ITellerWithMultiAssetSupport, IBoringOnChainQueue, IBoringVault } from "../typechain-types";
import { deployTacVault } from "../scripts/TacVault/TacVaultDeploy";
import { tacVaultTestnetConfig } from "../scripts/TacVault/config/TacVaultTestnetConfig";
describe("TacVaultProxy", function () {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let tacVaultProxy: TacBoringVaultProxy;
    let tacSAFactory: TacSAFactory;
    let tacSmartAccount: TacSmartAccount;
    let teller: ITellerWithMultiAssetSupport;
    let boringOnChainQueue: IBoringOnChainQueue;
    let boringVault: IBoringVault;
    let ton: ERC20;
    before(async function () {
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        tacSmartAccount = await deployTacSmartAccount(admin);
        tacSAFactory = await deployTacSAFactory(admin, await tacSmartAccount.getAddress());
        tacVaultProxy = await deployTacVault(admin, crossChainLayerAddress, await tacSAFactory.getAddress());
        const tonEVMAddress = testSdk.getEVMJettonAddress(TONTokenInfo.tvmAddress);
        // console.log(tonEVMAddress);
        // console.log(await admin.getAddress());
        
        ton = new ethers.Contract(tonEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        teller = new ethers.Contract(tacVaultTestnetConfig.teller, hre.artifacts.readArtifactSync('ITellerWithMultiAssetSupport').abi, admin) as unknown as ITellerWithMultiAssetSupport;
        boringOnChainQueue = new ethers.Contract(tacVaultTestnetConfig.boringOnChainQueue, hre.artifacts.readArtifactSync('IBoringOnChainQueue').abi, admin) as unknown as IBoringOnChainQueue;
        boringVault = new ethers.Contract(tacVaultTestnetConfig.boringVault, hre.artifacts.readArtifactSync('IBoringVault').abi, admin) as unknown as IBoringVault;
        
    });

    it("Tac vault deposit", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Deposit to vault");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await tacVaultProxy.getAddress();
        const methodName = "deposit(bytes,bytes)";

        const depositAmount = ethers.parseUnits("0.001", TONTokenInfo.decimals);
        const asset = new ethers.Contract("0xe3a2296bE422768a630eb35014978A808D106899", hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,uint256,uint256)'],
            [[
                await asset.getAddress(),
                depositAmount,
                0n
            ]]
        );

        await asset.connect(admin).transfer(target, depositAmount);

        const balance = await asset.balanceOf(await tacVaultProxy.getAddress());

        const {} = await testSdk.sendMessage(
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

    it("Tac vault withdraw", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Withdraw request");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await tacVaultProxy.getAddress();
        const methodName = "withdrawRequest(bytes,bytes)";

        const withdrawAmount = ethers.parseUnits("0.001", sttonTokenInfo.decimals);

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,uint256,uint256,uint256)'],
            [[
                await ton.getAddress(),
                withdrawAmount,
                0n,
                9999n
            ]]
        );

        const withdrawTokens: TokenUnlockInfo[] = [
            {
                evmAddress: await boringVault.getAddress(),
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

    it("Tac vault withdraw funds", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Withdraw funds");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await tacVaultProxy.getAddress();
        const user = await tacSAFactory.getSmartAccountForApplication(tvmWalletCaller, await tacVaultProxy.getAddress());
        const methodName = "withdrawFunds(bytes,bytes)";
        const withdrawAmount = ethers.parseUnits("0.1", sttonTokenInfo.decimals);
        const asset = new ethers.Contract("0xe3a2296bE422768a630eb35014978A808D106899", hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;

        await asset.connect(admin).transfer(user, withdrawAmount);

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address)'],
            [[
                await ton.getAddress(),
            ]]
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
        );
        
    });

    
});