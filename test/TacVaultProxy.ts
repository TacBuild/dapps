import hre, { ethers } from "hardhat";
import { AddressLike, BytesLike, Signer } from "ethers";
import { expect } from "chai";

import { TacLocalTestSdk, TokenMintInfo, TokenUnlockInfo} from "@tonappchain/evm-ccl";
import { sttonTokenInfo, tacTokenInfo, TONTokenInfo } from '../scripts/common/info/tokensInfo';
import { ERC20 } from "@tonappchain/evm-ccl/dist/typechain-types";
import { TacBoringVaultProxy, ITellerWithMultiAssetSupport, IBoringOnChainQueue, IBoringVault, ISAFactory } from "../typechain-types";
import { deployTacVault } from "../scripts/TacVault/TacVaultDeploy";
import { tacVaultTestnetConfig } from "../scripts/TacVault/config/TacVaultTestnetConfig";
describe("TacVaultProxy", function () {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let tacVaultProxy: TacBoringVaultProxy;
    let tacSAFactory: ISAFactory;
    let teller: ITellerWithMultiAssetSupport;
    let boringOnChainQueue: IBoringOnChainQueue;
    let boringVault: IBoringVault;
    let ton: ERC20;
    before(async function () {
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        tacSAFactory = new ethers.Contract(testSdk.getSmartAccountFactoryAddress(), hre.artifacts.readArtifactSync('ISAFactory').abi, admin) as unknown as ISAFactory;
        tacVaultProxy = await deployTacVault(admin, crossChainLayerAddress, await tacSAFactory.getAddress());
        const tonEVMAddress = testSdk.getEVMJettonAddress(TONTokenInfo.tvmAddress)
        
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

        // check lp token locked
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(await boringVault.getAddress());
        expect(outMessage.tokensLocked[0].amount).to.be.gt(0);

    });

    it("Tac vault withdraw", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Withdraw request");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await tacVaultProxy.getAddress();
        const methodName = "withdrawRequest(bytes,bytes)";

        const withdrawAmount = ethers.parseUnits("0.01", 18n);
        const asset = new ethers.Contract("0xe3a2296bE422768a630eb35014978A808D106899", hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,uint256,uint256,uint256)'],
            [[
                await asset.getAddress(),
                withdrawAmount,
                1n,
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
                await asset.getAddress(),
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