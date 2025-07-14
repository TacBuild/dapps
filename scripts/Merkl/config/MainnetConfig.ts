export interface MerklMainnetConfig {
    merklAddress: string;
    crossChainLayerAddress: string;
}

export interface rEULMainnetConfig {
    rEULAddress: string;
    EULAddress: string;
}

export interface MerklDeployments {
    merklProxy: string;
    customMerklProxyEuler?: string;
}

export const merklMainnetConfig: MerklMainnetConfig = {
    merklAddress: "0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae",
    crossChainLayerAddress: "0x9fee01e948353E0897968A3ea955815aaA49f58d"
};

export const merklDeployments: MerklDeployments = {
    merklProxy: "",
};