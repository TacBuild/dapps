import hre, { ethers } from "hardhat";
import { AddressLike, BytesLike, Signer } from "ethers";
import {time} from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { expect } from "chai";

import { deployTacSAFactory } from "../scripts/TacSmartAccountFactory/FactoryDeploy";
import { deployTacSmartAccount } from "../scripts/TacSmartAccountFactory/SABlueprintDeploy";
import { TacLocalTestSdk, TokenMintInfo, TokenUnlockInfo} from "@tonappchain/evm-ccl";
import { sttonTokenInfo, tacTokenInfo } from '../scripts/common/info/tokensInfo';
import { ERC20 } from "@tonappchain/evm-ccl/dist/typechain-types";
import { TacSAFactory, TacSmartAccount, MerklProxy, CustomMerklProxyEuler } from "../typechain-types";
import { deployMerklProxy, deployCustomMerklProxyEuler } from "../scripts/Merkl/MerklProxyDeploy";

export const MAXUINT128 = BigInt("340282366920938463463374607431768211455");
const rEULAddress = "0xFd140871bABAe1176bA0E38f5813d56B6B53837F";
const EULAddress = "0x00bD3eFf25E6fB0A164026BD5f2916801bdf434E";

describe("MerklProxy", function () {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let merklProxy: MerklProxy;
    let customMerklProxyEuler: CustomMerklProxyEuler;
    let tacSAFactory: TacSAFactory;
    let tacSmartAccount: TacSmartAccount;
    let stton: ERC20;
    let tac: ERC20;
    before(async function () {
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        
        tacSmartAccount = await deployTacSmartAccount(admin);
        tacSAFactory = await deployTacSAFactory(admin, await tacSmartAccount.getAddress());
        merklProxy = await deployMerklProxy(admin, crossChainLayerAddress, await tacSAFactory.getAddress());
        customMerklProxyEuler = await deployCustomMerklProxyEuler(admin, await merklProxy.getAddress());
        
        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);
        stton = new ethers.Contract(sttonEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        tac = new ethers.Contract(tacEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;

        await merklProxy.setCustomMerklLogic(rEULAddress, await customMerklProxyEuler.getAddress());
        
    });

    it("Merkl regular claim", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Claim");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await merklProxy.getAddress();
        const methodName = "claim(bytes,bytes)";
        const amount = ethers.parseEther("50")
        const proof = [process.env.MERKL_PROOF_FOR_TEST_1, process.env.MERKL_PROOF_FOR_TEST_2];
        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address[],uint256[],bytes32[][],bool)'],
            [[
                [rEULAddress],
                [amount],
                [proof],
                false
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

        const rEUL = await ethers.getContractAt(hre.artifacts.readArtifactSync('IREUL').abi, rEULAddress);
        const balance = await rEUL.balanceOf(await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await merklProxy.getAddress()));
        expect(balance).to.equal(amount);
        
    });


    it("Merkl withdrawToByLockTimestamp rEUL case", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("customFunctionCall");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await merklProxy.getAddress();
        const methodName = "customFunctionCall(bytes,bytes)";
        const rEUL = await ethers.getContractAt(hre.artifacts.readArtifactSync('IREUL').abi, rEULAddress);
        const EUL = await ethers.getContractAt(hre.artifacts.readArtifactSync('contracts/faucet/interfaces/IERC20.sol:IERC20').abi, EULAddress);
        const saAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await merklProxy.getAddress());
        
        const account = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await merklProxy.getAddress());
        const lockTimestamp = (await rEUL.getLockedAmounts(account))[0][0];
        const functionSelector = customMerklProxyEuler.withdrawToByLockTimestamp.fragment.selector;
        const withdrawToByLockTimestampData = new ethers.AbiCoder().encode(
            ['tuple(address,uint256,bool)'],
            [[account, lockTimestamp, true]]
        )

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,bytes4[],bytes[],address[])'],
            [[
                rEULAddress,
                [functionSelector],
                [withdrawToByLockTimestampData],
                [EULAddress]
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

        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(EULAddress);
        expect(outMessage.tokensLocked[0].amount).to.be.gt(0);

    });
});