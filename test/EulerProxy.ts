import hre, { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";
import { SaHooksBuilder } from "../scripts/TacSmartAccountFactory/SDK/SaHooksSDK";
import { TacLocalTestSdk, TokenUnlockInfo} from "@tonappchain/evm-ccl";
import { ERC20 } from "@tonappchain/evm-ccl/dist/typechain-types";
import { deployEulerProxy } from "../scripts/Euler/EulerProxyDeploy";
import { deployTacSmartAccount } from "../scripts/TacSmartAccountFactory/SABlueprintDeploy";
import { deployTacSAFactory } from "../scripts/TacSmartAccountFactory/FactoryDeploy";
import { TacSmartAccount, TacSAFactory, EulerProxy } from "../typechain-types";


export const MAXUINT128 = BigInt("340282366920938463463374607431768211455");
const vaultAddress = "0x8d5f39a9149a2cb04f9e48c1c95a36b36aa51def";
const borrowVaultAddress = "0x4b2e3a2dc6536235196e5a48d430ff8c66e6b4d6"
const assetAddress = "0x990e64388db00eff7a9c9f01c3748d5401df5082";
const borrowAssetAddress = "0x3B0DE40DdCAa337CEBc1ba435c77c656AF286CA8";
const ETH_VAULT_CONNECTOR = "0x272911fC4a3Cae478F29d13df85127f9a556B36D";
const PERMIT_2_ADDRESS = "0x63079e13441219D3Acf1012269127EBf304616D8";


describe("EulerProxy", function () {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let tacSmartAccount: TacSmartAccount;
    let tacSAFactory: TacSAFactory;
    let eulerProxy: EulerProxy;
    let asset: ERC20;
    let borrowAsset: ERC20;
    

    before(async function () {
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        tacSmartAccount = await deployTacSmartAccount(admin);
        tacSAFactory = await deployTacSAFactory(admin, await tacSmartAccount.getAddress());
        eulerProxy = await deployEulerProxy(admin, crossChainLayerAddress, await tacSAFactory.getAddress());
        asset = new ethers.Contract(assetAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        borrowAsset = new ethers.Contract(borrowAssetAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        
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
        const amount = ethers.parseUnits("70", 6);
        hooks.addContractInterface(vaultAddress, [
            'function deposit(uint256,address) external',
          ])
        hooks.addContractInterface(PERMIT_2_ADDRESS, [
            'function approve(address,address,uint160,uint48) external',
          ])

        const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await eulerProxy.getAddress())
          hooks.addContractInterface(assetAddress, ['function approve(address,uint256) external', 'function transfer(address,uint256) external'])        
          hooks.addPreHookCallFromSA(assetAddress, 'approve', [vaultAddress, amount])
          hooks.addPreHookCallFromSelf(assetAddress, 'transfer', [userAddress, amount])
          hooks.setMainCallHookCallFromSA(vaultAddress, 'deposit', [amount, await eulerProxy.getAddress()])
      
          const callData = new ethers.AbiCoder().encode([hooks.tupleString(), hooks.bridgeString()], [hooks.build(), [[vaultAddress]]])
          await asset.connect(admin).transfer(await eulerProxy.getAddress(), amount)        

        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
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

        const outMessage = outMessages[0];
        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect((outMessage.tokensLocked[0].evmAddress).toString().toLowerCase()).to.be.equal((vaultAddress).toLowerCase());
        expect(outMessage.tokensLocked[0].amount).to.be.equal(amount);
    });

    it("Euler deposit to borrow vault test", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("deposit_to_borrow_vault");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await eulerProxy.getAddress();
        const methodName = "call(bytes,bytes)";
        const hooks = new SaHooksBuilder()
        const amount = ethers.parseUnits("10", 18);
        hooks.addContractInterface(borrowVaultAddress, [
            'function deposit(uint256,address) external',
          ])
        

        const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await eulerProxy.getAddress())
          hooks.addContractInterface(borrowAssetAddress, ['function approve(address,uint256) external', 'function transfer(address,uint256) external'])        
          hooks.addPreHookCallFromSA(borrowAssetAddress, 'approve', [borrowVaultAddress, amount])
          hooks.addPreHookCallFromSelf(borrowAssetAddress, 'transfer', [userAddress, amount])
          hooks.setMainCallHookCallFromSA(borrowVaultAddress, 'deposit', [amount, await eulerProxy.getAddress()])
      
          const callData = new ethers.AbiCoder().encode([hooks.tupleString(), hooks.bridgeString()], [hooks.build(), [[borrowVaultAddress]]])
          await borrowAsset.connect(admin).transfer(await eulerProxy.getAddress(), amount)        

        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
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

        const outMessage = outMessages[0];
        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect((outMessage.tokensLocked[0].evmAddress).toString().toLowerCase()).to.be.equal((borrowVaultAddress).toLowerCase());
        expect(outMessage.tokensLocked[0].amount).to.be.equal(amount);
    });

    it("Euler borrow test", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("borrow");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await eulerProxy.getAddress();
        const methodName = "call(bytes,bytes)";
        const hooks = new SaHooksBuilder()
        const amount = ethers.parseUnits("0.001", 18);
        hooks.addContractInterface(vaultAddress, [
            'function transfer(address,uint256) external',
          ])

        hooks.addContractInterface(borrowVaultAddress, [
            "function borrow(uint256 amount, address receiver) external returns (uint256)",
          ])
        hooks.addContractInterface(ETH_VAULT_CONNECTOR, [
            "function enableCollateral(address account, address vault) external payable",
            "function enableController(address account, address vault) external payable",
          ])
        

        const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await eulerProxy.getAddress())
          hooks.addPreHookCallFromSA(ETH_VAULT_CONNECTOR, 'enableCollateral', [userAddress, vaultAddress])
          hooks.addPreHookCallFromSA(ETH_VAULT_CONNECTOR, 'enableController', [userAddress, borrowVaultAddress])
          hooks.addPreHookCallFromSelf(vaultAddress, 'transfer', [userAddress, ethers.parseUnits("50", 6)])
          hooks.setMainCallHookCallFromSA(borrowVaultAddress, 'borrow', [amount, await eulerProxy.getAddress()])
      
          const callData = new ethers.AbiCoder().encode([hooks.tupleString(), hooks.bridgeString()], [hooks.build(), [[borrowAssetAddress]]])


          const unlockInfo : TokenUnlockInfo = {
            evmAddress: vaultAddress,
            amount: ethers.parseUnits("50", 6)
          }
        

        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            callData,
            tvmWalletCaller,
            [],
            [unlockInfo],
            0n,
            extraData,
            operationId,
            timestamp
        );

        const outMessage = outMessages[0];
        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect((outMessage.tokensLocked[0].evmAddress).toString().toLowerCase()).to.be.equal((borrowAssetAddress).toLowerCase());
        expect(outMessage.tokensLocked[0].amount).to.be.equal(amount);
    });


    it("Euler repay test", async function () {
      const shardsKey = 1n;
      const operationId = ethers.encodeBytes32String("repay");
      const extraData = "0x";
      const timestamp = BigInt(Math.floor(Date.now() / 1000));
      const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

      const target = await eulerProxy.getAddress();
      const methodName = "call(bytes,bytes)";
      const hooks = new SaHooksBuilder()
      const amount = ethers.parseUnits("0.001", 18);

        hooks.addContractInterface(borrowAssetAddress, [
          'function approve(address,uint256) external',
          'function transfer(address,uint256) external',
        ])

      hooks.addContractInterface(borrowVaultAddress, [
          "function repay(uint256 amount, address receiver) external returns (uint256)"
        ])
      hooks.addContractInterface(ETH_VAULT_CONNECTOR, [
          "function disableCollateral(address account, address vault) external payable",
          "function disableController(address account) external payable",
        ])
      

      const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await eulerProxy.getAddress())
        hooks.addPreHookCallFromSelf(borrowAssetAddress, 'transfer', [userAddress, amount])
        hooks.addPreHookCallFromSA(borrowAssetAddress, 'approve', [borrowVaultAddress, amount])

        hooks.setMainCallHookCallFromSA(borrowVaultAddress, 'repay', [ethers.MaxUint256, await eulerProxy.getAddress()])

        hooks.addPostHookCallFromSA(ETH_VAULT_CONNECTOR, 'disableController', [userAddress])
        // hooks.addPostHookCallFromSA(ETH_VAULT_CONNECTOR, 'disableCollateral', [userAddress, vaultAddress])

    
        const callData = new ethers.AbiCoder().encode([hooks.tupleString(), hooks.bridgeString()], [hooks.build(), [[vaultAddress]]])


        const unlockInfo : TokenUnlockInfo = {
          evmAddress: borrowAssetAddress,
          amount: amount
        }
      

      const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
          shardsKey,
          target,
          methodName,
          callData,
          tvmWalletCaller,
          [],
          [unlockInfo],
          0n,
          extraData,
          operationId,
          timestamp
      );

      // const outMessage = outMessages[0];
      // expect(outMessage.tokensLocked.length).to.be.equal(1);
      // expect((outMessage.tokensLocked[0].evmAddress).toString().toLowerCase()).to.be.equal((vaultAddress).toLowerCase());
      // expect(outMessage.tokensLocked[0].amount).to.be.equal(ethers.parseUnits("50", 6));
  });


    it("Euler withdraw test", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("withdraw");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await eulerProxy.getAddress();
        const methodName = "call(bytes,bytes)";
        const hooks = new SaHooksBuilder()
        const amount = ethers.parseUnits("0.1", 6);
        hooks.addContractInterface(vaultAddress, [
            'function withdraw(uint256,address,address) external',
            'function approve(address,uint256) external',
            'function transfer(address,uint256) external',
          ])
        

        const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await eulerProxy.getAddress())
          hooks.addPreHookCallFromSA(vaultAddress, 'approve', [vaultAddress, amount])
          hooks.addPreHookCallFromSelf(vaultAddress, 'transfer', [userAddress, amount])
          hooks.setMainCallHookCallFromSelf(vaultAddress, 'withdraw', [amount, await eulerProxy.getAddress(), userAddress])
      
          const callData = new ethers.AbiCoder().encode([hooks.tupleString(), hooks.bridgeString()], [hooks.build(), [[assetAddress]]])
          const unlockInfo : TokenUnlockInfo = {
            evmAddress: vaultAddress,
            amount: amount
          }
        

          const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            callData,
            tvmWalletCaller,
            [],
            [unlockInfo],
            0n,
            extraData,
            operationId,
            timestamp
        );
        const outMessage = outMessages[0];
        
        expect(outMessage.tokensLocked.length).to.be.equal(1);

        // check lp token locked
        expect((outMessage.tokensLocked[0].evmAddress).toString().toLowerCase()).to.be.equal((await asset.getAddress()).toLowerCase());
        expect(outMessage.tokensLocked[0].amount).to.be.equal(amount);
    });

    
});