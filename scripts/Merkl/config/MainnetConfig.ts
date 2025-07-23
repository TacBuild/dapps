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

export const rEULMainnetConfig: rEULMainnetConfig = {
    rEULAddress: "0xCf623E50430CCb55214985F9C986a5Fa50aD7686",
    EULAddress: "0x38C043856A109066d64a60c82e07848a1C58e7Dc"
}

export const merklDeployments: MerklDeployments = {
    merklProxy: "0x74e6b5e701bA5de3245653d72A075c7709EeFDC4",
    customMerklProxyEuler: "0xE9ab6A1318783E1A433a57D10AcF946Db71cE390"
};