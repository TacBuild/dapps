export interface TacVaultMainnetConfig {
    teller: string;
    boringOnChainQueue: string;
    boringVault: string;
    proxyAddress: string;
}

export const tacVaultMainnetConfig: TacVaultMainnetConfig = {
    teller: "0x4d258f37F09425E54e167b3356D119874D5aD4b2",
    boringOnChainQueue: "0xE51e76A6315dC8edEe7f8e04363CdAC0f56fc5fB",
    boringVault: "0x450C6BAA2c0Bc5328a461771bC32E01bA41F31ae",
    proxyAddress: "0x4619d0Ed01a66D25F7C83E70C8515897D502cDBF"
}
