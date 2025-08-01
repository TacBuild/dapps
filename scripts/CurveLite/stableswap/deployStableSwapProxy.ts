import { CurveLiteStableswapProxy } from '../../../typechain-types';
import hre, { ethers } from 'hardhat';
import { ContractFactory, Signer } from 'ethers';
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { proxyOptsUUPS} from "../../utils"
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";


const proxyOpts: DeployProxyOptions = {
    kind: "uups",
    unsafeAllow: ["constructor"]
};

export async function deployCurveLiteStableswapProxy(deployer: Signer, crossChainLayerAddress: string, smartAccountFactory: string, WTAC: string): Promise<CurveLiteStableswapProxy> {
    const CurveLiteStableswapProxy = await deployUpgradable<CurveLiteStableswapProxy>(
        deployer,
        hre.artifacts.readArtifactSync('CurveLiteStableswapProxy'),
        [await deployer.getAddress(), crossChainLayerAddress, smartAccountFactory],
        proxyOpts,
        undefined,
        true);
    await CurveLiteStableswapProxy.waitForDeployment();
    await CurveLiteStableswapProxy.setWTACAddress(WTAC);
    return CurveLiteStableswapProxy;
}
