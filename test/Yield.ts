import hre, { ethers } from "hardhat";
import { AddressLike, BytesLike, Signer } from "ethers";
import { expect } from "chai";

import { deployYieldProxy } from "../scripts/Yield/deployProxy";
import { deployTacSAFactory } from "../scripts/TacSmartAccountFactory/FactoryDeploy";
import { deployTacSmartAccount } from "../scripts/TacSmartAccountFactory/SABlueprintDeploy";
import { yiedTestnetConfig } from "../scripts/Yield/config/testnetConfig";
import { TacLocalTestSdk, TokenMintInfo, NFTInfo, NFTMintInfo, NFTUnlockInfo, TokenUnlockInfo} from "@tonappchain/evm-ccl";
import { sttonTokenInfo, tacTokenInfo } from '../scripts/common/info/tokensInfo';
import { ERC20 } from "@tonappchain/evm-ccl/dist/typechain-types";
import { YieldManagerProxy, TacSAFactory, TacSmartAccount } from "../typechain-types";

describe("YieldProxy", function () {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let yieldProxy: YieldManagerProxy;
    let tacSAFactory: TacSAFactory;
    let tacSmartAccount: TacSmartAccount;
    let stton: ERC20;
    let tac: ERC20;
    before(async function () {
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        console.log("crossChainLayerAddress", crossChainLayerAddress);
        
        tacSmartAccount = await deployTacSmartAccount(admin);
        tacSAFactory = await deployTacSAFactory(admin, await tacSmartAccount.getAddress());
        yieldProxy = await deployYieldProxy(admin, crossChainLayerAddress, await tacSAFactory.getAddress());
        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);
        stton = new ethers.Contract(sttonEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        tac = new ethers.Contract(tacEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        
    });

});