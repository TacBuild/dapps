export interface MorphoTestnetConfig {
    morphoAddress: string;
    urdAddress: string;
    lrmAddress: string;
    metaMorphoV1_1Address: string;
}

export interface MorphoProxyDeployments {
    proxyAddress: string;
    MockOracleAddress: string;
    vaultAddress: string;
}

export const morphoTestnetConfig: MorphoTestnetConfig = {
    morphoAddress: "0xF0453e7368Ea01d6d6d6a222C26B5a06F1d816e9",
    urdAddress: "0x2506C1979F5C835f054A34F5D17ABcA5B6C31200",
    lrmAddress: "0x172FF09b5E3be27139f3ABF4820DeF486e7E9838",
    metaMorphoV1_1Address: "0xAD03a229163cBc902992C10F8Ea279C11A4d6f27"
}; 

export const morphoProxyDeployments: MorphoProxyDeployments = {
    proxyAddress: "0xd3e1AEf84Ac1fadfc9CE7b98641F09291A13957f",
    MockOracleAddress: "0x9CFa108412593e27893FFd71d2D39F3A212a3700",
    vaultAddress: "0x752165E0098205C576f15bEB1158E3bAe4db2192"
};