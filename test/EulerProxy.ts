import hre, { ethers } from "hardhat";
import { AddressLike, BytesLike, Signer } from "ethers";
import { expect } from "chai";
import { SaHooks, SaHooksBuilder } from "../scripts/TacSmartAccountFactory/SDK/SaHooksSDK";
import { TacLocalTestSdk} from "@tonappchain/evm-ccl";
import { sttonTokenInfo, tacTokenInfo } from '../scripts/common/info/tokensInfo';
import { ERC20 } from "@tonappchain/evm-ccl/dist/typechain-types";
import { deployEulerProxy } from "../scripts/Euler/EulerProxyDeploy";
import { deployTacSmartAccount } from "../scripts/TacSmartAccountFactory/SABlueprintDeploy";
import { deployTacSAFactory } from "../scripts/TacSmartAccountFactory/FactoryDeploy";
import { TacSmartAccount, TacSAFactory, EulerProxy } from "../typechain-types";

export const MAXUINT128 = BigInt("340282366920938463463374607431768211455");
const MAXUINT48 = BigInt("281474976710654");
const vaultAddress = "0x8d5f39a9149a2cb04f9e48c1c95a36b36aa51def";
const assetAddress = "0x990e64388db00eff7a9c9f01c3748d5401df5082";
const ETH_VAULT_CONNECTOR = "0x272911fC4a3Cae478F29d13df85127f9a556B36D";
const PERMIT_2_ADDRESS = "0x63079e13441219D3Acf1012269127EBf304616D8";


describe("EulerProxy", function () {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let tacSmartAccount: TacSmartAccount;
    let tacSAFactory: TacSAFactory;
    let eulerProxy: EulerProxy;
    let asset: ERC20;
    

    before(async function () {
        [admin] = await ethers.getSigners();
        console.log(await admin.getAddress());
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        tacSmartAccount = await deployTacSmartAccount(admin);
        tacSAFactory = await deployTacSAFactory(admin, await tacSmartAccount.getAddress());
        eulerProxy = await deployEulerProxy(admin, crossChainLayerAddress, await tacSAFactory.getAddress());
        asset = new ethers.Contract(assetAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        
    });

    it("Euler deposit test", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("deposit");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await eulerProxy.getAddress();
        const methodName = "call(bytes,bytes)";
        const hooks = new SaHooksBuilder()
        const amount = ethers.parseUnits("0.1", 6);
        hooks.addContractInterface(vaultAddress, [
            'function deposit(uint256,address) external',
          ])
        hooks.addContractInterface(PERMIT_2_ADDRESS, [
            'function approve(address,address,uint160,uint48) external',
          ])

        const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await eulerProxy.getAddress())
          console.log(userAddress)
          hooks.addContractInterface(assetAddress, ['function approve(address,uint256) external', 'function transfer(address,uint256) external'])        
          hooks.addPreHookCallFromSA(assetAddress, 'approve', [vaultAddress, amount])
          hooks.addPreHookCallFromSelf(assetAddress, 'transfer', [userAddress, amount])
          hooks.setMainCallHookCallFromSelf(vaultAddress, 'deposit', [amount, await eulerProxy.getAddress()])
      
          const hookData = hooks.encode()
          console.log(hooks.build())
          const bridgeData = new ethers.AbiCoder().encode(
            ['tuple(address[])'],
            [[[vaultAddress]]],
          )
          const callData = new ethers.AbiCoder().encode([hooks.tupleString(), hooks.bridgeString()], [hooks.build(), [[vaultAddress]]])
          console.log(await asset.balanceOf(await admin.getAddress()));
          await asset.connect(admin).transfer(await eulerProxy.getAddress(), amount)
          console.log(await asset.balanceOf(await eulerProxy.getAddress()));
        

        // const fee = 3000;
        // const currentPoint = 0;

        // const encodedArguments = new ethers.AbiCoder().encode(
        //     ['tuple(address,address,uint24,int24)'],
        //     [[
        //         sttonEVMAddress,
        //         tacEVMAddress,
        //         fee,
        //         currentPoint
        //     ]]
        // );

        // const initialPoolAddress = await pool.pool(sttonEVMAddress, tacEVMAddress, fee);
        // expect(initialPoolAddress).to.equal(ethers.ZeroAddress);

        await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            callData,
            tvmWalletCaller,
            [],
            [],
            0n,
            extraData,
            operationId,
            timestamp
        );

        // const newPoolAddress = await pool.pool(sttonEVMAddress, tacEVMAddress, fee);
        // expect(newPoolAddress).to.not.equal(ethers.ZeroAddress);

        // const pointDelta = await pool.fee2pointDelta(fee);
        // expect(pointDelta).to.not.equal(0);
    });

    
});