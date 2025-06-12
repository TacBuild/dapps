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

        console.log(await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, target));
        const proof = "0xd27fbefae92899cc7156acd926c3191a641e2c7e9ac13a9fb91f3a3b4ae717c6"
        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address[],uint256[],bytes32[][],bytes)'],
            [[
                ["0x05225a6416EDaeeC7227027E86F7A47D18A06b91"],
                [ethers.parseUnits("100", 6)],
                [[proof]],
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

        let abi = [
            "event AccountRegistrated(address indexed user, string indexed tvmCaller)"
        ];

        const merklProxyContractEvent = new ethers.Contract(await merklProxy.getAddress(), abi, admin);
        const eventFilter = merklProxyContractEvent.filters.AccountRegistrated
        const events = await merklProxyContractEvent.queryFilter(eventFilter, -1);
        const event = events[0] as unknown as { args: { user: string, tvmCaller: string } };
        console.log(event);
        
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