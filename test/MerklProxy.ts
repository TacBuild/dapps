import hre, { ethers } from "hardhat";
import { AddressLike, BytesLike, Signer } from "ethers";
import { expect } from "chai";

import { deployTacSAFactory } from "../scripts/TacSmartAccountFactory/FactoryDeploy";
import { deployTacSmartAccount } from "../scripts/TacSmartAccountFactory/SABlueprintDeploy";
import { TacLocalTestSdk, TokenMintInfo, TokenUnlockInfo} from "@tonappchain/evm-ccl";
import { sttonTokenInfo, tacTokenInfo } from '../scripts/common/info/tokensInfo';
import { ERC20 } from "@tonappchain/evm-ccl/dist/typechain-types";
import { TacSAFactory, TacSmartAccount, MerklProxy, CustomMerklProxyEuler } from "../typechain-types";
import { deployMerklProxy, deployCustomMerklProxyEuler } from "../scripts/Merkl/MerklProxyDeploy";

export const MAXUINT128 = BigInt("340282366920938463463374607431768211455");

describe("MorphoProxy", function () {
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
        console.log("crossChainLayerAddress", crossChainLayerAddress);
        
        tacSmartAccount = await deployTacSmartAccount(admin);
        tacSAFactory = await deployTacSAFactory(admin, await tacSmartAccount.getAddress());
        merklProxy = await deployMerklProxy(admin, crossChainLayerAddress, await tacSAFactory.getAddress());
        customMerklProxyEuler = await deployCustomMerklProxyEuler(admin);

        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);
        stton = new ethers.Contract(sttonEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        tac = new ethers.Contract(tacEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        
    });

    it("Merkl regular claim", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Claim");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await merklProxy.getAddress();
        const methodName = "claim(bytes,bytes)";

        const token  = "0x05225a6416EDaeeC7227027E86F7A47D18A06b91"
        const amount = ethers.parseUnits("1000", 9)
        console.log(await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await merklProxy.getAddress()));
        const proof = [ "0x8940a89e90106036b2210385cfc7a8cdfb53f371b93842a68728b37412293f1c", "0xd812e953a0210862ba23e6776e4939fec6ef2f8c3c3ee9962a3e4d801df60eaf" ]
        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address[],uint256[],bytes32[][],bytes)'],
            [[
                [token],
                [amount],
                [proof],
                "0x"
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

    // it("Merkl custom rEUL claim", async function () {
    //     const shardsKey = 1n;
    //     const operationId = ethers.encodeBytes32String("Claim");
    //     const extraData = "0x";
    //     const timestamp = BigInt(Math.floor(Date.now() / 1000));
    //     const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

    //     const target = await merklProxy.getAddress();
    //     const methodName = "claim(bytes,bytes)";

    //     const encodedArguments = new ethers.AbiCoder().encode(
    //         ['tuple(address[],address[],uint256[],bytes32[])'],
    //         [[
    //             ["user evm"],
    //             ["token address"],
    //             ["amount"],
    //             ["proof"]
    //         ]]
    //     );

    //     await testSdk.sendMessage(
    //         shardsKey,
    //         target,
    //         methodName,
    //         encodedArguments,
    //         tvmWalletCaller,
    //         [],
    //         [],
    //         0n,
    //         extraData,
    //         operationId,
    //         timestamp
    //     );
    // });

    // it("Merkl withdrawTo rEUL case", async function () {
    //     const shardsKey = 1n;
    //     const operationId = ethers.encodeBytes32String("Claim");
    //     const extraData = "0x";
    //     const timestamp = BigInt(Math.floor(Date.now() / 1000));
    //     const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

    //     const target = await merklProxy.getAddress();
    //     const methodName = "claim(bytes,bytes)";

    //     const encodedArguments = new ethers.AbiCoder().encode(
    //         ['tuple(address[],address[],uint256[],bytes32[])'],
    //         [[
    //             ["user evm"],
    //             ["token address"],
    //             ["amount"],
    //             ["proof"]
    //         ]]
    //     );

    //     await testSdk.sendMessage(
    //         shardsKey,
    //         target,
    //         methodName,
    //         encodedArguments,
    //         tvmWalletCaller,
    //         [],
    //         [],
    //         0n,
    //         extraData,
    //         operationId,
    //         timestamp
    //     );
    // });

    // it("Merkl withdrawToByLockTimestamp rEUL case", async function () {
    //     const shardsKey = 1n;
    //     const operationId = ethers.encodeBytes32String("Claim");
    //     const extraData = "0x";
    //     const timestamp = BigInt(Math.floor(Date.now() / 1000));
    //     const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

    //     const target = await merklProxy.getAddress();
    //     const methodName = "claim(bytes,bytes)";

    //     const encodedArguments = new ethers.AbiCoder().encode(
    //         ['tuple(address[],address[],uint256[],bytes32[])'],
    //         [[
    //             ["user evm"],
    //             ["token address"],
    //             ["amount"],
    //             ["proof"]
    //         ]]
    //     );

    //     await testSdk.sendMessage(
    //         shardsKey,
    //         target,
    //         methodName,
    //         encodedArguments,
    //         tvmWalletCaller,
    //         [],
    //         [],
    //         0n,
    //         extraData,
    //         operationId,
    //         timestamp
    //     );
    // });

    // it("Merkl withdrawToByLockTimestamps rEUL case", async function () {
    //     const shardsKey = 1n;
    //     const operationId = ethers.encodeBytes32String("Claim");
    //     const extraData = "0x";
    //     const timestamp = BigInt(Math.floor(Date.now() / 1000));
    //     const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

    //     const target = await merklProxy.getAddress();
    //     const methodName = "claim(bytes,bytes)";

    //     const encodedArguments = new ethers.AbiCoder().encode(
    //         ['tuple(address[],address[],uint256[],bytes32[])'],
    //         [[
    //             ["user evm"],
    //             ["token address"],
    //             ["amount"],
    //             ["proof"]
    //         ]]
    //     );

    //     await testSdk.sendMessage(
    //         shardsKey,
    //         target,
    //         methodName,
    //         encodedArguments,
    //         tvmWalletCaller,
    //         [],
    //         [],
    //         0n,
    //         extraData,
    //         operationId,
    //         timestamp
    //     );
    // });
});