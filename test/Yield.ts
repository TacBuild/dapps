import hre, { ethers } from "hardhat";
import { AddressLike, BytesLike, Signer } from "ethers";
import { expect } from "chai";

import { deployYieldProxy } from "../scripts/Yield/deployProxy";
import { yiedTestnetConfig } from "../scripts/Yield/config/testnetConfig";
import { TacLocalTestSdk, TokenMintInfo, NFTInfo, NFTMintInfo, NFTUnlockInfo, TokenUnlockInfo} from "@tonappchain/evm-ccl";
import { sttonTokenInfo, tacTokenInfo } from '../scripts/common/info/tokensInfo';
import { ERC20 } from "@tonappchain/evm-ccl/dist/typechain-types";
import { YieldManagerProxy, ManagerMock, TestToken, ReceiptMock, ISAFactory, ITacSmartAccount } from "../typechain-types";

describe("YieldProxy", function () {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let yieldProxy: YieldManagerProxy;
    let tacSAFactory: ISAFactory;
    let tacSmartAccount: ITacSmartAccount;
    let stton: ERC20;
    let tac: ERC20;
    let mockManager: ManagerMock;
    let mockReceipt: ReceiptMock;
    let mockSUSDT: TestToken;
    let mockYUSDT: TestToken;
    let mockYUSDTTVMAddress: string;

    before(async function () {
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        console.log("crossChainLayerAddress", crossChainLayerAddress);
        const mockManagerFactory = await ethers.getContractFactory("ManagerMock", admin);
        const testTokenFactory = await ethers.getContractFactory("TestToken", admin);
        const mockReceiptFactory = await ethers.getContractFactory("ReceiptMock", admin);
        mockManager = await mockManagerFactory.deploy();
        mockReceipt = await mockReceiptFactory.deploy();
        mockSUSDT = await testTokenFactory.deploy("sUSD","sUSD");
        mockYUSDT = await testTokenFactory.deploy("yUSD","yUSD");
        tacSmartAccount = await deployTacSmartAccount(admin);
        tacSAFactory = await deployTacSAFactory(admin, await tacSmartAccount.getAddress());
        yieldProxy = await deployYieldProxy(admin, await mockManager.getAddress(), await mockReceipt.getAddress(), await mockSUSDT.getAddress(), await mockYUSDT.getAddress(), await tacSAFactory.getAddress(), crossChainLayerAddress);
        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);
        stton = new ethers.Contract(sttonEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        tac = new ethers.Contract(tacEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        
    });

    it("configurate mockManager", async function () {
        await mockManager.setTokens(await mockSUSDT.getAddress(), await mockYUSDT.getAddress(), false);
        await mockManager.setAsset(await stton.getAddress(), true);
        await mockManager.setReceipt(await mockReceipt.getAddress());
    });

    it("deposit with ManagerMock", async function () {
    // ==== Setup ====
    const shardsKey = 1n;
    const operationId = ethers.encodeBytes32String("Deposit to Vault");
    const extraData = "0x";
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

    const target = await yieldProxy.getAddress();
    const methodName = "deposit(bytes,bytes)";

    const amount = ethers.parseEther("100")
        
    const payload  = {
        token: await stton.getAddress(),
        receiver: await yieldProxy.getAddress(),
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
        payload.token,
        payload.receiver,
        payload.amount,
        payload.sharePrice,
        payload.sAmount,
        payload.fee,
        payload.deadline,
        payload.trxnType
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



    const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
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

    const yBalance = await mockYUSDT.balanceOf(await testSdk.getCrossChainLayerAddress());
    expect(yBalance).to.equal(42);
});

it("withdraw with ManagerMock", async function () {
    // ==== Setup ====
    const shardsKey = 1n;
    const operationId = ethers.encodeBytes32String("Withdraw from Vault");
    const extraData = "0x";
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

    const target = await yieldProxy.getAddress();
    const methodName = "withdraw(bytes,bytes)";

    const amount = 42;

    const payload  = {
        token: await stton.getAddress(), 
        receiver: await yieldProxy.getAddress(),
        amount: amount,
        sharePrice: 0,    
        sAmount: amount,
        fee: 0,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        trxnType: ethers.keccak256(ethers.toUtf8Bytes("WITHDRAW")),
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
            payload.token,
            payload.receiver,
            payload.amount,
            payload.sharePrice,
            payload.sAmount,
            payload.fee,
            payload.deadline,
            payload.trxnType
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

    const unlockTokens: TokenUnlockInfo[] = [{
            evmAddress: await mockYUSDT.getAddress(),
            amount: amount,
        }]

    

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


    const nftBalance = await mockReceipt.balanceOf(await testSdk.getCrossChainLayerAddress());
    expect(nftBalance).to.be.gt(0);

});


    

});