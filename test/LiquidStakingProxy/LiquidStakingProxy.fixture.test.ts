import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { TacLocalTestSdk } from "@tonappchain/evm-ccl";
import {
  LiquidStakingMock,
  LiquidStakingProxy,
  LiquidTacToken,
} from "../../typechain-types";

export const LIQUIDSTAKING_PRECOMPILE =
  "0x0000000000000000000000000000000000001600";
export const ZERO_ADDRESS = `0x${"".padStart(40, "0")}`;
export const ZERO_BN = 0n;
export const ONE_BN = 1n;

export interface LiquidStakingDependencies {
  gTACContract: LiquidTacToken;
  liquidStakingMockContract: LiquidStakingMock;
  crossChainLayerAddress: string;
  saFactoryAddress: string;
}

export async function deployLiquidStakingDependencies(
  testSdk: TacLocalTestSdk,
  deployer: SignerWithAddress
): Promise<LiquidStakingDependencies> {
  const gTACContract = await ethers
    .getContractFactory("LiquidTacToken")
    .then((f) => f.connect(deployer).deploy(deployer));

  const liquidStakingMockContract = await ethers
    .getContractFactory("LiquidStakingMock")
    .then((f) => f.connect(deployer).deploy(gTACContract.target));
  const code = await ethers.provider.getCode(
    await liquidStakingMockContract.getAddress()
  );
  await network.provider.send("hardhat_setCode", [
    LIQUIDSTAKING_PRECOMPILE,
    code,
  ]);

  const LIQUID_STAKING = await gTACContract.LIQUID_STAKING();
  await gTACContract.grantRole(LIQUID_STAKING, LIQUIDSTAKING_PRECOMPILE);

  const crossChainLayerAddress = await testSdk.create(ethers.provider);
  await setBalance(crossChainLayerAddress, ethers.parseEther("1000"));
  const saFactoryAddress = testSdk.getSmartAccountFactoryAddress();

  return {
    gTACContract,
    liquidStakingMockContract,
    crossChainLayerAddress,
    saFactoryAddress,
  };
}

export async function deployLiquidStakingProxy(
  testSdk: TacLocalTestSdk,
  deployer: SignerWithAddress
): Promise<
  {
    liquidStakingProxy: LiquidStakingProxy;
  } & LiquidStakingDependencies
> {
  const dependencies = await deployLiquidStakingDependencies(testSdk, deployer);

  const liquidStakingProxy = await ethers
    .getContractFactory("LiquidStakingProxy")
    .then((f) =>
      f
        .connect(deployer)
        .deploy(
          dependencies.crossChainLayerAddress,
          dependencies.saFactoryAddress,
          dependencies.gTACContract.target,
          deployer
        )
    );

  return { liquidStakingProxy, ...dependencies };
}
