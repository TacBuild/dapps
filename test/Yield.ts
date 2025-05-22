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
import { YieldManagerProxy, MockManager ,TacSAFactory, TacSmartAccount } from "../typechain-types";

describe("YieldProxy", function () {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let yieldProxy: YieldManagerProxy;
    let tacSAFactory: TacSAFactory;
    let tacSmartAccount: TacSmartAccount;
    let stton: ERC20;
    let tac: ERC20;
    let mockManager: MockManager;

    before(async function () {
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        console.log("crossChainLayerAddress", crossChainLayerAddress);
        const mockFactory = await ethers.getContractFactory("MockManager", admin);
        mockManager = await mockFactory.deploy();

        tacSmartAccount = await deployTacSmartAccount(admin);
        tacSAFactory = await deployTacSAFactory(admin, await tacSmartAccount.getAddress());
        yieldProxy = await deployYieldProxy(admin, await mockManager.getAddress(), await tacSAFactory.getAddress(), crossChainLayerAddress);
        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);
        stton = new ethers.Contract(sttonEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        tac = new ethers.Contract(tacEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        
    });

    it("deposit", async function () {
        // ==== Setup ====
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Deposit to Vault");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await yieldProxy.getAddress();
        const methodName = "deposit(bytes,bytes)";

        const amount = ethers.parseEther("100")
            
        const payloadExpected  = {
            token: await stton.getAddress(),
            receiver: await admin.getAddress(),
            amount: amount,
            sharePrice: 0,       // used only on L2, можно поставить 0
            sAmount: amount,
            fee: 0,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            trxnType: ethers.keccak256(ethers.toUtf8Bytes("DEPOSIT")),
        };

        const encodedPayload = new ethers.AbiCoder().encode(
        [
            "address",
            "address",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "bytes32",
        ],
        [
            payloadExpected .token,
            payloadExpected .receiver,
            payloadExpected .amount,
            payloadExpected .sharePrice,
            payloadExpected .sAmount,
            payloadExpected .fee,
            payloadExpected .deadline,
            payloadExpected .trxnType
        ]
        );

        const fakeSignature = "0x" + "11".repeat(65);

        
        
        const encodedArguments = new ethers.AbiCoder().encode(
            ["bytes", "bytes"],
            [
                encodedPayload,
                fakeSignature
            ]
        );

        const mintTokens: TokenMintInfo[] = [
                {
                    info: sttonTokenInfo,
                    amount: amount
                }];

        
            
        

            

        testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            mintTokens,
            [],
            0n,
            extraData,
            operationId,
            timestamp
        )

        const managerPayload = await mockManager.getLastOrderPayload()

        console.log(Object.values(payloadExpected))
        console.log(managerPayload)
            
        expect(Object.values(payloadExpected)).to.be.equal(managerPayload);
            

    });

});