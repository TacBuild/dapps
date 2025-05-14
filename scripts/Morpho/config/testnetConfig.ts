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
    smartAccountFactoryAddress: string;
    crossChainLayerAddress: string;
}

export const morphoTestnetConfig: MorphoTestnetConfig = {
    morphoAddress: "0xF0453e7368Ea01d6d6d6a222C26B5a06F1d816e9",
    urdAddress: "0x2506C1979F5C835f054A34F5D17ABcA5B6C31200",
    lrmAddress: "0x172FF09b5E3be27139f3ABF4820DeF486e7E9838",
    metaMorphoV1_1Address: "0xAD03a229163cBc902992C10F8Ea279C11A4d6f27"
}; 

export const morphoProxyDeployments: MorphoProxyDeployments = {
    proxyAddress: "0xfb1070cF7CE5173B24FC26A2F8581cC9D7A05924",
    MockOracleAddress: "0x9CFa108412593e27893FFd71d2D39F3A212a3700",
    vaultAddress: "0x4C46008D989D2B7dd931c909bc7C0cC35Ab79829",
    smartAccountFactoryAddress: "0x95e23BBa93b6c9Ef89A1bFB2659B020e9382C060",
    crossChainLayerAddress: "0x20B33b63fADd3cf09943b493ef79FC8C0845d577"
};