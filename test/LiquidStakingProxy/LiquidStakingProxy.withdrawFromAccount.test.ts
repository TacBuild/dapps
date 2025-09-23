import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { TacLocalTestSdk } from "@tonappchain/evm-ccl";
import { TacSAFactory__factory } from "@tonappchain/evm-ccl/dist/typechain-types";
import {
  deployLiquidStakingProxy,
  LiquidStakingDependencies,
  ONE_BN,
  ZERO_BN,
} from "./LiquidStakingProxy.fixture.test";
import { LiquidStakingProxy } from "../../typechain-types";
import { sendMessage } from "./LiquidStakingProxy.helpers.test";

describe("Method: withdrawFromAccount: ", () => {
  const TVM_CALLER = "TVM-USER-1";

  let ownerAccount: SignerWithAddress;

  let testSdk: TacLocalTestSdk;

  before(async () => {
    [ownerAccount] = await ethers.getSigners();

    testSdk = new TacLocalTestSdk();
  });

  async function deployFixture(): Promise<
    { liquidStakingProxy: LiquidStakingProxy } & LiquidStakingDependencies
  > {
    return await deployLiquidStakingProxy(testSdk, ownerAccount);
  }

  describe("When one of parameters is incorrect", () => {
    describe("When the caller is not a cross chain contract", () => {
      it("should revert with OnlyCrossChainLayer", async () => {
        const { liquidStakingProxy } = await loadFixture(deployFixture);

        await expect(
          liquidStakingProxy
            .connect(ownerAccount)
            .withdrawFromAccount("0x", "0x")
        )
          .to.be.revertedWithCustomError(
            liquidStakingProxy,
            "OnlyCrossChainLayer"
          )
          .withArgs();
      });
    });

    describe("When no balance to withdraw", () => {
      it("should revert with NoBalanceToWithdraw", async () => {
        const { liquidStakingProxy } = await loadFixture(deployFixture);

        await expect(
          sendMessage(
            testSdk,
            TVM_CALLER,
            liquidStakingProxy.target as string,
            "withdrawFromAccount(bytes,bytes)",
            "0x",
            ZERO_BN
          )
        ).to.be.rejectedWith(/ProxyCallError: custom error 0xbbd81708/); // NoBalanceToWithdraw()
      });
    });
  });

  describe("When all parameters correct", () => {
    let liquidStakingProxy: LiquidStakingProxy;

    before(async () => {
      const snapshot = await loadFixture(deployFixture);
      liquidStakingProxy = snapshot.liquidStakingProxy;
      const smartAccountFactory = TacSAFactory__factory.connect(
        snapshot.saFactoryAddress,
        ownerAccount
      );
      const smartAccountAddress =
        await smartAccountFactory.getSmartAccountForApplication(
          TVM_CALLER,
          liquidStakingProxy.target
        );
      await ownerAccount.sendTransaction({
        to: smartAccountAddress,
        value: ONE_BN,
      });
    });

    it("should success", async () => {
      await sendMessage(
        testSdk,
        TVM_CALLER,
        liquidStakingProxy.target as string,
        "withdrawFromAccount(bytes,bytes)",
        "0x",
        ZERO_BN
      );
    });
  });
});
