import hre, { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";
import { reset, setStorageAt, getStorageAt, time } from "@nomicfoundation/hardhat-network-helpers"
import { TacLocalTestSdk } from "@tonappchain/evm-ccl";
import { ChiSqProxy, ISAFactory  } from "../typechain-types";
import { deployChiSqProxyTestnet } from "../scripts/ChiSq/deployTestnet";
import testnetConfig from "../scripts/ChiSq/config/testnet";

export const MAXUINT128 = BigInt("340282366920938463463374607431768211455");
const usdtAddress = "0xbA7EbAC1D2bB8a68F808cd235BB6A50E7B9F9220"
const ownerStorageSlotUsdt = 2n
const tacSaFactoryTestnet = "0x5919D1D0D1b36F08018d7C9650BF914AEbC6BAd6"

describe("ChiSq Proxy", function () {
    let admin: Signer;
    let relayer: Signer;
    let testSdk: TacLocalTestSdk;
    let tacSAFactory: ISAFactory;
    let chiSqProxy: ChiSqProxy;
    let usdt: any;

    before(async function () {
        await reset(process.env.TAC_TESTNET_SPB_URL || "");
        
        [admin, relayer] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        await setStorageAt(usdtAddress, ownerStorageSlotUsdt, await admin.getAddress());

        tacSAFactory = new ethers.Contract(tacSaFactoryTestnet, hre.artifacts.readArtifactSync('ISAFactory').abi, admin) as unknown as ISAFactory;
        chiSqProxy = await deployChiSqProxyTestnet(admin, crossChainLayerAddress, await tacSAFactory.getAddress(), true, await relayer.getAddress());
        usdt = new ethers.Contract(usdtAddress, ['function mint(address,uint256) external', 'function balanceOf(address) external view returns (uint256)'], admin) as unknown;
    });

    it("ChiSq proxy add liquidity", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("addLiquidity");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await chiSqProxy.getAddress();
        const methodName = "addLiquidity(bytes,bytes)";
        const amount = ethers.parseUnits("10000", 6);

        await usdt.connect(admin).mint(await chiSqProxy.getAddress(), amount);
        
        const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await chiSqProxy.getAddress())
        console.log("userAddress", userAddress);
        const encodedArguments = new ethers.AbiCoder().encode(
            ['uint256'],
            [amount]
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

        let abi = [
            "event AddedLiquidity(address indexed user, uint256 amount, string tvmCaller)"
        ];

        const chiSqProxyEvent = new ethers.Contract(await chiSqProxy.getAddress(), abi, admin);
        const eventFilter = chiSqProxyEvent.filters.AddedLiquidity
        const events = await chiSqProxyEvent.queryFilter(eventFilter, -1);
        
        const event = events[0] as unknown as { args: { user: string, amount: string, tvmCaller: string } };
        expect(event.args.user).to.be.equal(userAddress);
        expect(event.args.amount).to.be.equal(amount);
        expect(event.args.tvmCaller).to.be.equal(tvmWalletCaller);


    });

    it("ChiSq proxy deposit", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("depositToSmartAccount");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await chiSqProxy.getAddress();
        const methodName = "depositToSmartAccount(bytes,bytes)";
        const amount = ethers.parseUnits("10000", 6);

        await usdt.connect(admin).mint(await chiSqProxy.getAddress(), amount);
        
        const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await chiSqProxy.getAddress())
        const encodedArguments = new ethers.AbiCoder().encode(
            ['uint256'],
            [amount]
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

        let abi = [
            "event DepositedToSmartAccount(address indexed user, uint256 amount, string tvmCaller)"
        ];

        const chiSqProxyEvent = new ethers.Contract(await chiSqProxy.getAddress(), abi, admin);
        const eventFilter = chiSqProxyEvent.filters.DepositedToSmartAccount
        const events = await chiSqProxyEvent.queryFilter(eventFilter, -1);
        
        const event = events[0] as unknown as { args: { user: string, amount: string, tvmCaller: string } };
        expect(event.args.user).to.be.equal(userAddress);
        expect(event.args.amount).to.be.equal(amount);
        expect(event.args.tvmCaller).to.be.equal(tvmWalletCaller);


    });

    it("ChiSq proxy place bet", async function () {
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await chiSqProxy.getAddress())
        const currentTime = BigInt(Math.floor(Date.now() / 1000));
        const expectedExpiresAt = currentTime / 10n * 10n + 60n;
        await time.increaseTo(currentTime);
        let tx = await chiSqProxy.connect(relayer).placeBet("eth", 4n, 1n, expectedExpiresAt, 120n, userAddress, ethers.parseUnits("99", 6));
        await tx.wait();

        let abi = [
            "event PlacedBet(address indexed onBehalfOf, uint256 indexed tokenId, uint256 amount, string assetId, uint8 row, uint8 column, uint64 expiresAt, uint256 multiplier)"
        ];

        const chiSqProxyEvent = new ethers.Contract(await chiSqProxy.getAddress(), abi, admin);
        const eventFilter = chiSqProxyEvent.filters.PlacedBet
        const events = await chiSqProxyEvent.queryFilter(eventFilter, -1);
        
        const event = events[0] as unknown as { args: { onBehalfOf: string, tokenId: string, amount: string, assetId: string, row: string, column: string, expiresAt: string, multiplier: string } };
        expect(event.args.onBehalfOf).to.be.equal(userAddress);
        expect(event.args.tokenId).to.be.not.null;
        expect(event.args.amount).to.be.equal(ethers.parseUnits("99", 6));
        expect(event.args.assetId).to.be.equal("eth");
        expect(event.args.row).to.be.equal(4n);
        expect(event.args.column).to.be.equal(1n);
        expect(event.args.expiresAt).to.be.equal(expectedExpiresAt);
        expect(event.args.multiplier).to.be.equal(120n);

    });
    // Claim should be prepared from protocol side, so, tested before launch and after, now should be skipped
    it.skip("ChiSq claim payout", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("claim payout");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await chiSqProxy.getAddress();
        const methodName = "claimPayout(bytes,bytes)";
        const tokenId = 94n;
        const bridgeToTon = false;

        const encodedArguments = new ethers.AbiCoder().encode(
            ['uint256[]', 'bool'],
            [[BigInt(tokenId)], bridgeToTon]
        );
        const usdtBaanceOfSmartAccount = await usdt.balanceOf(await tacSAFactory.getSmartAccountForApplication(tvmWalletCaller, await chiSqProxy.getAddress()));

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
        const usdtBaanceOfSmartAccountAfter = await usdt.balanceOf(await tacSAFactory.getSmartAccountForApplication(tvmWalletCaller, await chiSqProxy.getAddress()));
        expect(usdtBaanceOfSmartAccountAfter).to.be.gt(usdtBaanceOfSmartAccount);

    });

    it("ChiSq withdraw from smart account", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("withdrawFromSmartAccount");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await chiSqProxy.getAddress();
        const methodName = "withdrawFromSmartAccount(bytes,bytes)";
        const amount = ethers.parseUnits("10", 6);

        
        const encodedArguments = new ethers.AbiCoder().encode(
            ['uint256'],
            [amount]
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
        expect((outMessage.tokensLocked[0].evmAddress).toString().toLowerCase()).to.be.equal((usdtAddress).toLowerCase());
        expect(outMessage.tokensLocked[0].amount).to.be.equal(amount); 


    });

    it("ChiSq withdraw liquidity", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("withdrawLiquidity");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await chiSqProxy.getAddress();
        const methodName = "withdrawLiquidity(bytes,bytes)";
        const amount = ethers.parseUnits("100", 6);

        await time.increase(60 * 60 * 2);
        const encodedArguments = new ethers.AbiCoder().encode(
            ['uint256'],
            [amount]
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
        expect((outMessage.tokensLocked[0].evmAddress).toString().toLowerCase()).to.be.equal((usdtAddress).toLowerCase());
        expect(outMessage.tokensLocked[0].amount).to.be.equal(amount); 


    });

    
    
});