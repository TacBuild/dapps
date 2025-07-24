import hre, { upgrades } from 'hardhat';
import { deployUpgradable } from '@tonappchain/evm-ccl';
import { WTACCoverterProxyConfig } from './config';
import { WTACConverterProxy } from '../../typechain-types';
import { Signer } from 'ethers';

export async function deployWTACConverterProxy(deployer: Signer, config: WTACCoverterProxyConfig): Promise<WTACConverterProxy> {
    return await deployUpgradable<WTACConverterProxy>(
        deployer,
        hre.artifacts.readArtifactSync('WTACConverterProxy'),
        [
            config.adminAddress,
            config.crossChainLayerAddress,
            config.wTACAddress
        ],
        {
            initializer: 'initialize',
            kind: 'uups'
        }
    );
}

export async function upgradeWTACConverterProxy(
    deployer: Signer,
    proxyAddress: string
): Promise<void>{
    
}