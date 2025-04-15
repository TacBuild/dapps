import hre, { ethers } from "hardhat";
import { AddressLike, BytesLike, Signer } from "ethers";
import { expect } from "chai";

import { deployMorphoProxy } from "../scripts/Morpho/MorphoProxyDeploy";
import { deployTacSAFactory } from "../scripts/TacSmartAccountFactory/FactoryDeploy";
import { deployTacSmartAccount } from "../scripts/TacSmartAccountFactory/SABlueprintDeploy";
import { morphoTestnetConfig } from "../scripts/Morpho/config/testnetConfig";
import { deployMockOracle } from "../scripts/Morpho/MockOracleDeploy";
import { TacLocalTestSdk, TokenMintInfo, NFTInfo, NFTMintInfo, NFTUnlockInfo, TokenUnlockInfo} from "@tonappchain/evm-ccl";
import { sttonTokenInfo, tacTokenInfo } from '../scripts/common/info/tokensInfo';
import { ERC20 } from "@tonappchain/evm-ccl/dist/typechain-types";
import { MorphoProxy, IMorpho, IURD, TacSAFactory, TacSmartAccount, IMorphoVault, MockOracle } from "../typechain-types";

export const MAXUINT128 = BigInt("340282366920938463463374607431768211455");

describe("MorphoProxy", function () {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let morphoProxy: MorphoProxy;
    let urd: IURD;
    let morpho: IMorpho;
    let morphoVaultAddress: string;
    let tacSAFactory: TacSAFactory;
    let tacSmartAccount: TacSmartAccount;
    let mockOracle: MockOracle;
    let stton: ERC20;
    let tac: ERC20;
    before(async function () {
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        tacSmartAccount = await deployTacSmartAccount(admin);
        tacSAFactory = await deployTacSAFactory(admin, await tacSmartAccount.getAddress());
        morphoProxy = await deployMorphoProxy(admin, crossChainLayerAddress, await tacSAFactory.getAddress());
        mockOracle = await deployMockOracle(admin);
        urd = new ethers.Contract(morphoTestnetConfig.urdAddress, hre.artifacts.readArtifactSync('IURD').abi, admin) as unknown as IURD;
        morpho = new ethers.Contract(morphoTestnetConfig.morphoAddress, hre.artifacts.readArtifactSync('IMorpho').abi, admin) as unknown as IMorpho;
        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);
        stton = new ethers.Contract(sttonEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        tac = new ethers.Contract(tacEVMAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        console.log("stton", await stton.getAddress());
        console.log("tac", await tac.getAddress());
        
    });

    it("Morpho create market", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Create market");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await morphoProxy.getAddress();
        const methodName = "createMarket(bytes,bytes)";

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(tuple(address,address,address,address,uint256))'],
            [[[
                await stton.getAddress(),
                await tac.getAddress(),
                await mockOracle.getAddress(),
                morphoTestnetConfig.lrmAddress,
                ethers.parseEther("0.945")
            ]]]
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

        const marketParamsId = computeMarketParamsId({
            loanToken: await stton.getAddress(),
            collateralToken: await tac.getAddress(),
            oracle: await mockOracle.getAddress(),
            irm: morphoTestnetConfig.lrmAddress,
            lltv: ethers.parseEther("0.945")
        });
        
        expect((await morpho.idToMarketParams(marketParamsId))[0]).to.equal(await stton.getAddress());
        expect((await morpho.idToMarketParams(marketParamsId))[1]).to.equal(await tac.getAddress());
        expect((await morpho.idToMarketParams(marketParamsId))[2]).to.equal(await mockOracle.getAddress());
        expect((await morpho.idToMarketParams(marketParamsId))[3]).to.equal(morphoTestnetConfig.lrmAddress);
        expect((await morpho.idToMarketParams(marketParamsId))[4]).to.equal(ethers.parseEther("0.945"));
    });

    it("Morpho supply collateral", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Supply collateral");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await morphoProxy.getAddress();
        const methodName = "supplyCollateral(bytes,bytes)";

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(tuple(address,address,address,address,uint256),uint256,bytes)'],
            [[[
                await stton.getAddress(),
                await tac.getAddress(),
                await mockOracle.getAddress(),
                morphoTestnetConfig.lrmAddress,
                ethers.parseEther("0.945")
            ],
            ethers.parseEther("1"),
            "0x"
            ]]
        );

        const mintTokens: TokenMintInfo[] = [
        {
            info: tacTokenInfo,
            amount: ethers.parseUnits("1", tacTokenInfo.decimals)
        }];

        const marketParamsId = computeMarketParamsId({
            loanToken: await stton.getAddress(),
            collateralToken: await tac.getAddress(),
            oracle: await mockOracle.getAddress(),
            irm: morphoTestnetConfig.lrmAddress,
            lltv: ethers.parseEther("0.945")
        });
        
        await testSdk.sendMessage(
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
        );
        const onBehalf = await tacSAFactory.getSmartAccountForApplication(tvmWalletCaller, await morphoProxy.getAddress());


        const supColAfter = await morpho.position(marketParamsId, onBehalf);
        console.log("supColAfter", supColAfter);
        expect(supColAfter.collateral).to.be.greaterThan(0);
    });

    it("Morpho supply loan", async function () {        
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Supply loan");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await morphoProxy.getAddress();
        const methodName = "supply(bytes,bytes)";

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(tuple(address,address,address,address,uint256),uint256,uint256,bytes)'],
            [[[
                await stton.getAddress(),
                await tac.getAddress(),
                await mockOracle.getAddress(),
                morphoTestnetConfig.lrmAddress,
                ethers.parseEther("0.945")
            ],
            ethers.parseUnits("1", sttonTokenInfo.decimals),
            0,
            "0x"
            ]]
        );

        const mintTokens: TokenMintInfo[] = [
        {
            info: sttonTokenInfo,
            amount: ethers.parseUnits("1", sttonTokenInfo.decimals)
        }];

        const marketParamsId = computeMarketParamsId({
            loanToken: await stton.getAddress(),
            collateralToken: await tac.getAddress(),
            oracle: await mockOracle.getAddress(),
            irm: morphoTestnetConfig.lrmAddress,
            lltv: ethers.parseEther("0.945")
        });

        const onBehalf = await tacSAFactory.getSmartAccountForApplication(tvmWalletCaller, await morphoProxy.getAddress());
        const supLoanBefore = await morpho.position(marketParamsId, onBehalf);

        await testSdk.sendMessage(
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
        );

        const supLoanAfter = await morpho.position(marketParamsId, onBehalf);
        
        expect(supLoanAfter.supplyShares).to.be.greaterThan(supLoanBefore.supplyShares);
    });

    it("Morpho borrow", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Borrow");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await morphoProxy.getAddress();
        const methodName = "borrow(bytes,bytes)";

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(tuple(address,address,address,address,uint256),uint256,uint256)'],
            [[[
                await stton.getAddress(),
                await tac.getAddress(),
                await mockOracle.getAddress(),
                morphoTestnetConfig.lrmAddress,
                ethers.parseEther("0.945")
            ],
            ethers.parseUnits("0.1", sttonTokenInfo.decimals),
            0,
            ]]
        );

        const marketParamsId = computeMarketParamsId({
            loanToken: await stton.getAddress(),
            collateralToken: await tac.getAddress(),
            oracle: await mockOracle.getAddress(),
            irm: morphoTestnetConfig.lrmAddress,
            lltv: ethers.parseEther("0.945")
        });

        const onBehalf = await tacSAFactory.getSmartAccountForApplication(tvmWalletCaller, await morphoProxy.getAddress());
        const borrowSharesBefore = await morpho.position(marketParamsId, onBehalf);  

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

        const borrowSharesAfter = await morpho.position(marketParamsId, onBehalf);
        expect(borrowSharesAfter.borrowShares).to.be.greaterThan(borrowSharesBefore.borrowShares);
    });

    it("Morpho repay debt", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Repay");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await morphoProxy.getAddress();
        const methodName = "repay(bytes,bytes)";

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(tuple(address,address,address,address,uint256),uint256,uint256,bytes)'],
            [[[
                await stton.getAddress(),
                await tac.getAddress(),
                await mockOracle.getAddress(),
                morphoTestnetConfig.lrmAddress,
                ethers.parseEther("0.945")
            ],
            ethers.parseUnits("0.1", sttonTokenInfo.decimals),
            0,
            "0x"
            ]]
        );

        const mintTokens: TokenMintInfo[] = [
            {
                info: sttonTokenInfo,
                amount: ethers.parseUnits("0.1", sttonTokenInfo.decimals)
            }];

        const marketParamsId = computeMarketParamsId({
            loanToken: await stton.getAddress(),
            collateralToken: await tac.getAddress(),
            oracle: await mockOracle.getAddress(),
            irm: morphoTestnetConfig.lrmAddress,
            lltv: ethers.parseEther("0.945")
        });

        const onBehalf = await tacSAFactory.getSmartAccountForApplication(tvmWalletCaller, await morphoProxy.getAddress());
        const repayDebtBefore = await morpho.position(marketParamsId, onBehalf);

        await testSdk.sendMessage(
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
        );

        const repayDebtAfter = await morpho.position(marketParamsId, onBehalf);
        expect(repayDebtAfter.borrowShares).to.be.lessThan(repayDebtBefore.borrowShares);
    });

    it("Morpho withdraw collateral", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Withdraw collateral");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await morphoProxy.getAddress();
        const methodName = "withdrawCollateral(bytes,bytes)";

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(tuple(address,address,address,address,uint256),uint256)'],
            [[[
                await stton.getAddress(),
                await tac.getAddress(),
                await mockOracle.getAddress(),
                morphoTestnetConfig.lrmAddress,
                ethers.parseEther("0.945")
            ],
            ethers.parseUnits("1", tacTokenInfo.decimals),
            ]]
        );

        const marketParamsId = computeMarketParamsId({
            loanToken: await stton.getAddress(),
            collateralToken: await tac.getAddress(),
            oracle: await mockOracle.getAddress(),
            irm: morphoTestnetConfig.lrmAddress,
            lltv: ethers.parseEther("0.945")
        });

        const onBehalf = await tacSAFactory.getSmartAccountForApplication(tvmWalletCaller, await morphoProxy.getAddress());
        const withdrawCollateralBefore = await morpho.position(marketParamsId, onBehalf);

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

        const withdrawCollateralAfter = await morpho.position(marketParamsId, onBehalf);
        expect(withdrawCollateralAfter.collateral).to.be.lessThan(withdrawCollateralBefore.collateral);
    });

    it("Morpho Create vault", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Create vault");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await morphoProxy.getAddress();
        const methodName = "createVault(bytes,bytes)";

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,uint256,address,string,string,bytes32)'],
            [[
                await admin.getAddress(),
                0,
                await stton.getAddress(),
                "Vault",
                "VLT",
                ethers.randomBytes(32)
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
            "event VaultCreated(address indexed vault)"
        ];

        const morphoProxyContractEvent = new ethers.Contract(await morphoProxy.getAddress(), abi, admin);
        const eventFilter = morphoProxyContractEvent.filters.VaultCreated
        const events = await morphoProxyContractEvent.queryFilter(eventFilter, -1);
        const event = events[0] as unknown as { args: { vault: string } };
        morphoVaultAddress = event.args.vault

        expect(morphoVaultAddress).to.not.equal(ethers.ZeroAddress);

        const morphoVault = new ethers.Contract(morphoVaultAddress, hre.artifacts.readArtifactSync('IMorphoVault').abi, admin) as unknown as IMorphoVault;
        let tx = await morphoVault.connect(admin).setCurator(await admin.getAddress());
        
        tx = await morphoVault.connect(admin).setFeeRecipient(await admin.getAddress());
        await tx.wait();
        tx = await morphoVault.connect(admin).setIsAllocator(await admin.getAddress(), true);
        await tx.wait();
        tx = await morphoVault.connect(admin).submitCap(
            {
                loanToken: await stton.getAddress(),
                collateralToken: await tac.getAddress(),
                oracle: await mockOracle.getAddress(),
                irm: morphoTestnetConfig.lrmAddress,
                lltv: ethers.parseEther("0.945")
            },
            ethers.parseEther("100")
        );
        await tx.wait();
        const marketParamsId = computeMarketParamsId({
            loanToken: await stton.getAddress(),
            collateralToken: await tac.getAddress(),
            oracle: await mockOracle.getAddress(),
            irm: morphoTestnetConfig.lrmAddress,
            lltv: ethers.parseEther("0.945")
        });

        tx = await morphoVault.connect(admin).acceptCap(
            {
                loanToken: await stton.getAddress(),
                collateralToken: await tac.getAddress(),
                oracle: await mockOracle.getAddress(),
                irm: morphoTestnetConfig.lrmAddress,
                lltv: ethers.parseEther("0.945")
            }
        );
        await tx.wait();
        tx = await morphoVault.connect(admin).setSupplyQueue(
            [marketParamsId]
        );
        await tx.wait();
    });

    it("Morpho Deposit to Vault", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Deposit to Vault");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await morphoProxy.getAddress();
        const methodName = "deposit(bytes,bytes)";

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,uint256)'],
            [[
                morphoVaultAddress,
                ethers.parseUnits("1", sttonTokenInfo.decimals)
            ]]
        );

        const mintTokens: TokenMintInfo[] = [
            {
                info: sttonTokenInfo,
                amount: ethers.parseUnits("1", sttonTokenInfo.decimals)
            }];

        await testSdk.sendMessage(
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
        );
    });

    it("Morpho Mint to Vault", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Mint to Vault");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await morphoProxy.getAddress();
        const methodName = "mint(bytes,bytes)";

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,uint256)'],
            [[
                morphoVaultAddress,
                ethers.parseUnits("1", sttonTokenInfo.decimals)
            ]]
        );

        const mintTokens: TokenMintInfo[] = [
            {
                info: sttonTokenInfo,
                amount: ethers.parseUnits("1", sttonTokenInfo.decimals)
            }];

        await testSdk.sendMessage(
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
        );
    });

    it("Morpho Withdraw from Vault", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Withdraw from Vault");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await morphoProxy.getAddress();
        const methodName = "withdraw(bytes,bytes)";

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,uint256)'],
            [[
                morphoVaultAddress,
                1n
            ]]
        );
        
        const unlockTokens: TokenUnlockInfo[] = [
            {
                evmAddress: morphoVaultAddress,
                amount: ethers.parseUnits("1", sttonTokenInfo.decimals)
            }
        ];

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
    });

    it("Morpho Redeem from Vault", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Redeem from Vault");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await morphoProxy.getAddress();
        const methodName = "redeem(bytes,bytes)";

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,uint256)'],
            [[
                morphoVaultAddress,
                1n
            ]]
        );

        const unlockTokens: TokenUnlockInfo[] = [
            {
                evmAddress: morphoVaultAddress,
                amount: ethers.parseUnits("1", sttonTokenInfo.decimals)
            }
        ];

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
    });
});

interface MarketParams {
    loanToken: string;
    collateralToken: string;
    oracle: string;
    irm: string;
    lltv: BigInt;
  }

function computeMarketParamsId(params: MarketParams): string {
    // Convert each address to 32 bytes and numbers to a 32-byte hex string
    const loanToken = ethers.zeroPadValue(params.loanToken, 32);
    const collateralToken = ethers.zeroPadValue(params.collateralToken, 32);
    const oracle = ethers.zeroPadValue(params.oracle, 32);
    const irm = ethers.zeroPadValue(params.irm, 32);
    const lltv = ethers.zeroPadValue(
      ethers.toBeHex(params.lltv.toString()),
      32
    );
  
    // Concatenate all the parameters
    const concatenatedParams =
      loanToken +
      collateralToken.slice(2) +
      oracle.slice(2) +
      irm.slice(2) +
      lltv.slice(2);
  
    // Compute the Keccak256 hash
    return ethers.keccak256(concatenatedParams);
  }