import { ethers, upgrades } from "hardhat";
import { liquidStakingConfig } from "./config/mainnetConfig";

async function main(): Promise<void> {
  const CONTRACT_NAME = "LiquidStakingProxy";

  const LiquidStakingProxyFactory = await ethers.getContractFactory(
    CONTRACT_NAME
  );
  const liquidStakingProxy = await upgrades.deployProxy(
    LiquidStakingProxyFactory,
    [
      liquidStakingConfig.crossChainLayer,
      liquidStakingConfig.smartAccountFactory,
      liquidStakingConfig.liquidTacToken,
      liquidStakingConfig.owner,
    ],
    {
      kind: "uups",
      constructorArgs: [
        liquidStakingConfig.crossChainLayer,
        liquidStakingConfig.smartAccountFactory,
        liquidStakingConfig.liquidTacToken,
        liquidStakingConfig.owner,
      ],
    }
  );
  await liquidStakingProxy.waitForDeployment();

  console.log(
    "LiquidStakingProxy deployed to:",
    await liquidStakingProxy.getAddress()
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
