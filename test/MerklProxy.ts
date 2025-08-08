import hre, { ethers } from "hardhat";
import { AddressLike, BytesLike, Signer } from "ethers";
import {setStorageAt, getStorageAt} from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { expect } from "chai";

import { deployTacSAFactory } from "../scripts/TacSmartAccountFactory/FactoryDeploy";
import { deployTacSmartAccount } from "../scripts/TacSmartAccountFactory/SABlueprintDeploy";
import { TacLocalTestSdk, TokenMintInfo, TokenUnlockInfo} from "@tonappchain/evm-ccl";
import { sttonTokenInfo, tacTokenInfo } from '../scripts/common/info/tokensInfo';
import { ERC20 } from "@tonappchain/evm-ccl/dist/typechain-types";
import { MerklProxy, CustomMerklProxyEuler, ISAFactory } from "../typechain-types";
import { deployMerklProxy, deployCustomMerklProxyEuler } from "../scripts/Merkl/MerklProxyDeploy";

export const MAXUINT128 = BigInt("340282366920938463463374607431768211455");
const rEULAddress = "0xFd140871bABAe1176bA0E38f5813d56B6B53837F";
const EULAddress = "0x00bD3eFf25E6fB0A164026BD5f2916801bdf434E";

describe("MerklProxy", function () {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let merklProxy: MerklProxy;
    let customMerklProxyEuler: CustomMerklProxyEuler;
    let tacSAFactory: ISAFactory;
    let stton: ERC20;
    let tac: ERC20;
    before(async function () {
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider)
        const tacSAFactoryAddress = "0x95e23BBa93b6c9Ef89A1bFB2659B020e9382C060"
        
        tacSAFactory = new ethers.Contract( tacSAFactoryAddress, hre.artifacts.readArtifactSync('ISAFactory').abi, admin) as unknown as ISAFactory;
        merklProxy = await deployMerklProxy(admin, crossChainLayerAddress, await tacSAFactory.getAddress());
        customMerklProxyEuler = await deployCustomMerklProxyEuler(admin, await merklProxy.getAddress());
        
        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);
        stton = new ethers.Contract(sttonEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        tac = new ethers.Contract(tacEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;

        await merklProxy.setCustomMerklLogic(rEULAddress, await customMerklProxyEuler.getAddress());
        
    });

    it("Merkl Claim rEUL", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Claim");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await merklProxy.getAddress();
        const methodName = "claim(bytes,bytes)";
        const amount = ethers.parseEther("100")
        const proof = [ "0x2caabac2efd7e4a0decb3525e9f7c74a8b3f65448fb1904482417ea031b2e735", "0x8b0ebacad283afff5b56349b554f7b1f31197ee779fc15c433b71203d8029cf1", "0x014e2032ab79de698095a3c69ff9c4f076a5223640777cde8bbaedd9aec8025c", "0xe2aad897f868143d332062cf3f74e90ce2c921baab537bf284f7e2843244c351", "0xfc472b9c6a9513886be1c11dd5c82b538612f88b3c22dbf6f6141fa4e889b696"]
        const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await merklProxy.getAddress());
        console.log("userAddress", userAddress);
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

    it("Merkl claim WTAC", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Claim");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await merklProxy.getAddress();
        const methodName = "claim(bytes,bytes)";
        const amount = ethers.parseEther("2")
        const proof = ["0xe41ad7320b930742c351ebb868c87d1a7510eeb8ec01a822d6dde18b7b9ba9b5", "0x660bdd9d305ec8efb57ef505648352d43803f40be0412a4f2cf1f922ae6043f5",
"0xe0af51a1a8e0ccaab16e82992f4a2a154f49a78b1cc286c82ef8236cf5b9a680", "0xd387fee0d25979b4efcc57d16f384bf0a012cbb66412a8fa5ff74b53be5191a5",  "0xfc472b9c6a9513886be1c11dd5c82b538612f88b3c22dbf6f6141fa4e889b696"]
        const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await merklProxy.getAddress());
        console.log("userAddress", userAddress);
        const wtacAddress = "0xf6408c39E150fB5CF065f64C08826Ea6ea0046E2"
        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address[],uint256[],bytes32[][],bool)'],
            [[
                [wtacAddress],
                [amount],
                [proof],
                true
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
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal("0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE");
        expect(outMessage.tokensLocked[0].amount).to.be.eq(amount);
        
    });


    it("Merkl withdrawToByLockTimestamp rEUL case", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("customFunctionCall");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await merklProxy.getAddress();
        const functionSelector = customMerklProxyEuler.withdrawToByLockTimestamp.fragment.selector;
        console.log("functionSelector", functionSelector);
        const methodName = "customFunctionCall(bytes,bytes)";
        const rEUL = await ethers.getContractAt(hre.artifacts.readArtifactSync('IREUL').abi, rEULAddress);
        const EUL = await ethers.getContractAt(hre.artifacts.readArtifactSync('contracts/faucet/interfaces/IERC20.sol:IERC20').abi, EULAddress);
        
        const account = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await merklProxy.getAddress());
        const lockTimestamp = (await rEUL.getLockedAmounts(account))[0][0];
        
        const withdrawToByLockTimestampData = new ethers.AbiCoder().encode(
            ['tuple(uint256,bool)'],
            [[lockTimestamp, true]]
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