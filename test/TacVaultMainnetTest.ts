import hre, { ethers } from "hardhat";
import { AddressLike, BytesLike, Signer } from "ethers";
import { expect } from "chai";
import {time} from "@nomicfoundation/hardhat-network-helpers"
import { TacLocalTestSdk, TokenMintInfo, TokenUnlockInfo, JettonInfo} from "@tonappchain/evm-ccl";
import { sttonTokenInfo, tacTokenInfo, TONTokenInfo } from '../scripts/common/info/tokensInfo';
import { ERC20 } from "@tonappchain/evm-ccl/dist/typechain-types";
import { TacBoringVaultProxy, ITellerWithMultiAssetSupport, IBoringOnChainQueue, IBoringVault, ISAFactory } from "../typechain-types";
import { deployTacVaultMainnet } from "../scripts/TacVault/TacVaultDeploy";
import { tacVaultMainnetConfig } from "../scripts/TacVault/config/TacVaultMainnetConfig";
describe("TacVaultProxyMainnet", function () {
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
        tacVaultProxy = await deployTacVaultMainnet(admin, crossChainLayerAddress, await tacSAFactory.getAddress());
        const tonEVMAddress = testSdk.getEVMJettonAddress(TONTokenInfo.tvmAddress)
        
        ton = new ethers.Contract(tonEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        teller = new ethers.Contract(tacVaultMainnetConfig.teller, hre.artifacts.readArtifactSync('ITellerWithMultiAssetSupport').abi, admin) as unknown as ITellerWithMultiAssetSupport;
        boringOnChainQueue = new ethers.Contract(tacVaultMainnetConfig.boringOnChainQueue, hre.artifacts.readArtifactSync('IBoringOnChainQueue').abi, admin) as unknown as IBoringOnChainQueue;
        boringVault = new ethers.Contract(tacVaultMainnetConfig.boringVault, hre.artifacts.readArtifactSync('IBoringVault').abi, admin) as unknown as IBoringVault;
        
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
        const assetAddress = "0xb76d91340F5CE3577f0a056D29f6e3Eb4E88B140"
        console.log("admin", await admin.getAddress());
        const asset = new ethers.Contract(assetAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        await asset.connect(admin).transfer(target, depositAmount);

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,uint256,uint256)'],
            [[
                assetAddress,
                depositAmount,
                0n
            ]]
        );

        const assetToMint : TokenMintInfo = {
            info: TONTokenInfo,
            amount: ethers.parseUnits("0.001", TONTokenInfo.decimals)
        }
        
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [assetToMint],
            [],
            0n,
            extraData,
            operationId,
            timestamp
        );

        

    });

    it("Tac vault withdraw funds after 1 day lock", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Withdraw funds");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await tacVaultProxy.getAddress();
        const methodName = "withdrawFunds(bytes,bytes)";        

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address)'],
            [[
                await boringVault.getAddress(),
            ]]
        );
        await time.increase(100000);

        const {outMessages} = await testSdk.sendMessage(
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

    
});