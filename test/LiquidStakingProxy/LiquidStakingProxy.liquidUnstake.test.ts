import { expect } from "chai";
import { ethers } from "hardhat";
import { parseEther } from "ethers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { TacLocalTestSdk } from "@tonappchain/evm-ccl";
import {
  deployLiquidStakingProxy,
  LiquidStakingDependencies,
  ZERO_BN,
} from "./LiquidStakingProxy.fixture.test";
import { LiquidStakingProxy, LiquidTacToken } from "../../typechain-types";
import { sendMessage } from "./LiquidStakingProxy.helpers.test";

const abiCoder = ethers.AbiCoder.defaultAbiCoder();

describe("Method: liquidUnstake: ", () => {
  const TVM_CALLER = "TVM-USER-1";
  const UNSTAKE_AMOUNT = parseEther("1");

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
          liquidStakingProxy.connect(ownerAccount).liquidUnstake("0x", "0x")
        )
          .to.be.revertedWithCustomError(
            liquidStakingProxy,
            "OnlyCrossChainLayer"
          )
          .withArgs();
      });
    });

    describe("When the passed amount equal zero", () => {
      it("should revert with InvalidAmount", async () => {
        const { liquidStakingProxy } = await loadFixture(deployFixture);

        const encoded = abiCoder.encode(["uint256"], [ZERO_BN]);

        await expect(
          sendMessage(
            testSdk,
            TVM_CALLER,
            liquidStakingProxy.target as string,
            "liquidUnstake(bytes,bytes)",
            encoded,
            ZERO_BN
          )
        ).to.be.rejectedWith(/ProxyCallError: custom error 0x2c5211c6/); // InvalidAmount()
      });
    });
  });

  describe("When all parameters correct", () => {
    let liquidStakingProxy: LiquidStakingProxy;
    let liquidTacToken: LiquidTacToken;
    let encoded: string;

    before(async () => {
      const snapshot = await loadFixture(deployFixture);
      liquidStakingProxy = snapshot.liquidStakingProxy;
      liquidTacToken = snapshot.gTACContract;

      encoded = abiCoder.encode(["uint256"], [UNSTAKE_AMOUNT]);

      const LIQUID_STAKING = await liquidTacToken.LIQUID_STAKING();
      await liquidTacToken.grantRole(LIQUID_STAKING, ownerAccount);
      await liquidTacToken.mint(liquidStakingProxy.target, UNSTAKE_AMOUNT);
    });

    it("should success", async () => {
      await sendMessage(
        testSdk,
        TVM_CALLER,
        liquidStakingProxy.target as string,
        "liquidUnstake(bytes,bytes)",
        encoded,
        ZERO_BN
      );
    });
  });
});
