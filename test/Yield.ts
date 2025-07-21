import hre, { ethers } from "hardhat";
import { AddressLike, BytesLike, Signer } from "ethers";
import { expect } from "chai";

import { deployYieldProxy } from "../scripts/Yield/deployProxy";
import { yiedTestnetConfig } from "../scripts/Yield/config/testnetConfig";
import { TacLocalTestSdk, TokenMintInfo, NFTInfo, NFTMintInfo, NFTUnlockInfo, TokenUnlockInfo} from "@tonappchain/evm-ccl";
import { sttonTokenInfo, tacTokenInfo } from '../scripts/common/info/tokensInfo';
import { ERC20 } from "@tonappchain/evm-ccl/dist/typechain-types";
import { YieldManagerProxy, ManagerMock, TestToken, ReceiptMock, ISAFactory, ITacSmartAccount } from "../typechain-types";
<<<<<<< HEAD
import { yiedMainnetConfig } from "../scripts/Yield/config/mainnetConfig";

const USDT_MAINNET_ADDRESS = "0xAF988C3f7CB2AceAbB15f96b19388a259b6C438f"
=======
>>>>>>> develop

describe("YieldProxy", function () {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let yieldProxy: YieldManagerProxy;
    let tacSAFactory: ISAFactory;
<<<<<<< HEAD
    let usdt: ERC20;
    let yUsd: ERC20;
   
=======
    let tacSmartAccount: ITacSmartAccount;
    let stton: ERC20;
    let tac: ERC20;
    let mockManager: ManagerMock;
    let mockReceipt: ReceiptMock;
    let mockSUSDT: TestToken;
    let mockYUSDT: TestToken;
    let mockYUSDTTVMAddress: string;
>>>>>>> develop

    before(async function () {
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        tacSAFactory = await hre.ethers.getContractAt("ISAFactory", testSdk.getSmartAccountFactoryAddress()) as unknown as ISAFactory;
        yieldProxy = await deployYieldProxy(admin, yiedMainnetConfig.managerAddress, yiedMainnetConfig.yUSD, await tacSAFactory.getAddress(), crossChainLayerAddress);
        usdt = new ethers.Contract(USDT_MAINNET_ADDRESS, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        yUsd = new ethers.Contract(yiedMainnetConfig.yUSD, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        
    });

    it("deposit with Manage", async function () {
    const shardsKey = 1n;
    const operationId = ethers.encodeBytes32String("Deposit to Vault");
    const extraData = "0x";
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

    const target = await yieldProxy.getAddress();
    const methodName = "deposit(bytes,bytes)";

    const amount = ethers.parseEther("100")
    const user = await tacSAFactory.getSmartAccountForApplication(tvmWalletCaller, await yieldProxy.getAddress());

    // bridge immitation 
    await usdt.connect(admin).transfer(await yieldProxy.getAddress(), ethers.parseUnits("0.01", 6));


        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,address,uint256,address,address,bytes,bytes32)'],
            [[
                yiedMainnetConfig.yUSD,
                await usdt.getAddress(),
                ethers.parseUnits("0.01", 6n),
                user,
                ethers.ZeroAddress,
                "0x",
                ethers.encodeBytes32String("0x")
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
    )
});



    

});