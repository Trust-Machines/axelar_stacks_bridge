import {
    createStacksPrivateKey,
    cvToJSON,
    hexToCV,
    listCV,
    signMessageHashRsv,
    tupleCV,
    uintCV,
} from "@stacks/transactions";
import { bufferFromAscii, bufferFromHex } from "@stacks/transactions/dist/cl";
import { Signers } from "./types";

// following code to generate
// pubkey => priv
export const SIGNER_KEYS: Record<string, string> = {
    '03b0d54fcba4ebcf78ae822be1bd1983007230930ad3a45e51c289d843a4dfaeb0': 'c49e900e5ecf01e09e290933b133e557ff909afa00cd163ae8a81a9c9a0ef321',
    '027a581db31d7b00c75a7c3f05f2a0c0ca977424efcfc44c908c1dc9233702d15c': '5bc30e7f33fcdadef29b0b2642ca1cd3007ebd4bc912f1f2d4eaa71e6a2f1af9',
    '0248657ec60e824f28aebd268af0b66684b7e79ff3b6487a9a80d2f74cbdfb646d': 'bd42f7be0d0c60beceeb1b168b0e127a28cfff3d5216f810f37f633fd42f9406',
    '024ca31f858cbede6ef3713f2fd32a239cc37ca4379bb37cae45400b42e14ef124': 'd63e75d731a5f4ad684c8e72df46a89cb3c14d5b7a37e38ee6ae59d46ef7c9ec',
    '03b5ea644255f3f788007d17955e1288d6fa5b1b6e0502ce3ff31879f3de24b4a6': 'a1e62471694d9962f69032216fdddf7b16cb4025ad71a3c2836360db21280f76',
    '034f1f9141e06f0641806785045cf375e36cfb97eb5870a6ed89f92a1dec30a3f2': '5a6fbfcfebbf99bb9a718704aa6a21f87b57e7eefa2ea7ce88916b42a830316d',
    '02508735a5ea8a85a706717ff52c64b3d8f22d66fd13100de5159aec610afcb983': '2b1e0c3d44b925d93a471ca0bf3c4244851e4db3303647571b606a431b4b1d03',
    '022e042de6b1966e9d56e18cfbff6a6a6dbdaf420ba85187194e9d79a169841488': 'c11148ef5b6fb96c8e23bd13173072fdd7065afe8de6486b1239bebaafeb4cf5',
    '03cd3de8654e9974ef56d0d3fa2ecc54ce29bfb2c4968177e8bce3bc64eb6ca372': 'a43fb39229e2ba36be0af5171a34d97aa5aca5ad0d7c4e22d1bedccb00417bd0',
    '02acd623205fb9f264b0b483a94269a814c0e1a3396308a08b739ee401d474c3ef': '3fa8349630736d974775415a7bda6aef6bab3bea89f8596cad4cc36fd8840fc8',
    '02e2f437a4231244bc185ce4ba5f9638d039e4337af71d280c3c366159e6d7bedc': '579adca6f3c2713888f278d22e7f1e6e63735183bca65f96bc246328601f8809',
    '0277ad46cf1f82953116604c137c41d11fc095694d046417820a3d77253363b904': '6ede4f3e502ccc069dffe54203299a796d4a94213322b8aa3a4fbbc36ce433d8',
    '031244d4c729f83c9e7898a85283e7460783a711746ba2ff24767443109ae1e64f': 'd5d5b166c709b70abc840199ae51d35eb76aa12a650d952ca780d76fe982a853',
    '03a59cff8eb6f7fd5972f24468e88ba23bd85960dfe0912c9434cabe92acf130d7': 'dc5caf304268cea1491e60a46325ddc051f76efb129effd206277373dfbfdd5d',
    '0319ea093014a1cc7f4aa0219506c20bc1de1480ea157b9b28a088d5f8a70e63cb': '305d609044f2930b5b602d352e4ae0d96081c31243cccdf2932a878da37ead9a',
    '03937d3e4b9b9befcba9cb967775946ba544be9c47e565eb35033c9acce38817f5': '053bdb0ee803bcbb4609c47fa26cc3ae93aa3ff4a9551c93f106d67a254e5d3b',
    '02ca1756eab680eae0a1d5eb09d743c291504281bab7caeedf6134d9f5cdd9b855': '4a344c278b08abaa2dc5ef659f7e5ea44902e6bbb40c7d5608b68c3e9cffd7b2',
    '032afd907ebd146ffcc28bad7c1c000e1c64cc3b16076105f9d7a80aa6b9df2a1c': 'e9c9a86307b713a33537e69f422a5e59c7343081923b60d63e8201a3ed69361f',
    '038546f7a176e691bca7da324329714e2d1ff29d449a2a2444193c9332e114ef93': '0b5b55aadf94b40f45a42fa21c1a3e096e3cda88ebc933b782c61f4e30a04359',
    '020c22bc2202afa6154a7f2a9ec6bc7a99bd27cc2c87c6c109122ab9dff19ad247': 'ffd3da8549c02bd249cbc5ec3b2bd759b4f26fa23552dd953111cc0b42d80c45',
    '033ff98fb3472bc7c11c55ec676b5a7bb242d6678c94cecf60884abc435ced09a8': '68db8ca5e1f0d259539a2fc5093f3a81ff6ebec0f8bfbf876102e8cc87cec6fa',
    '033ae9d929251dc5b3368422287a3147ac7d7ac5952777e33709a9bff75df47aef': '4dfdfc511feb5a85011354ac3ecee1d63a7c4413033f235b9ad27aca76f69b30',
    '03fd7c4c87db1c6d29ade32f580279b49ec875a91bb53675ab109f623ad80b62bc': 'f502bd8395eaa85cc3d7a9ecb1ae89398796b699539f57b4ced57280a014e2b3',
    '02477aac6c21e53167ca1b2a34f6bb641fbec3e2b8a7740df0aebf1651f67dce9b': '51b7eb2554e94be27ff7564e8c7b5e4e0a3b6cedab01fe6b14e6773d97557d22',
    '0314250c631e015959b6c4b4caea8cbd07b4d91126af30fcf2540d8d58ed773868': 'ff6caa0661cf7cdb5f4839bf6f49ded8fb7ee11a1e91de1d89837d1ec278af4d',
    '02caf01693c288b5efec1304b4f6dbad6ceb9ca8d7562eceae7faac283a70da76b': '901477d067e03a9160979dfc4d81b0a2ee0d38e095ef630f59816b034975c4f9',
    '028406a53db3fa97fcb55e86d990f5a43cbcf1780fc49d8815d4467f14c7937f5f': '37a68749fcae9df170839bc99cbae22770b9edf0688a36516caf902b7899031c',
    '02ccee71a125153d7cf21b6f15801a75b97386cfcd81bd2252aa24126daf535c18': '32e74dbe591fcf4ffef3cb9b3277d81895bb62b533abd4caec617c705324a41d',
    '032f5cdb6a5260829397870522bbbe47a2bfd82eb7f548f8232dc6c7a33097e1b4': '3196141086b9c3ea22248817d71476131a2f2dc09ce8c6efbedd6a3f067b1d9e',
    '03ba5c0199ddedbe49a02c8e953e8bfc255a90b181361691c092c4e3c94be8cbbf': 'cfaded039e3b0620e916cb9a7f0d5064af935fe7fcac737b1fb8197b53de137f',
    '02fe18d0fad29ff73040ffcf2fd1ff72192275b106abc8820cb8738e1ccb85ff10': 'b7f9dc470b9099edd09c565d8ac959e917288a065e1e011d4782893e5f34f195',
    '026c5924a9883e8dcbcd48e848036d6848a3acdc2c824951ff584a4466d6ef277b': '8c65e8b000d181c2d3512edc12554cf5c07f2919ceb7fd0068016084cbdeebe2',
    '03b7acd3f84be1062ee892f7ee0f3018c6475dbb31b3e474501ee1f2bbbb1081b5': '3fc10533efabf81aa42d5938b63f8e811ddce9c0a4afbe59b81a4889d59d8767',
    '03b9f0477da8d5ee92b7d13dc3fced5eea1469c1982cece60de97faf636f9155f0': '0c84da74ec45b5861f41e352ed0e0ffebc30d97f3dece537027f1db2b7be8afe',
    '035ff5fcbc4c905dc5b2429491c51ed0cf8ca1815cf0b6e3fa00ac5405c4a41dde': 'b648ee4a4cd2692917c45c23c08532151c4adf371741ebd413694b671aef530b',
    '025091d02c3cfd5c23148404e1d29bfbc9da34f02f45b6794c40a25f03a328953f': 'ffedb290b42992bb8269d2771be45157b28b57427bda0189ddfbd6ba2685d26e',
    '02408fd18e334ad846bb8cb374dae11bc565aa953df8f47cf42ccc02f15cbd5819': 'efa0aea82fedd8abbc773a1dfda5b410d559075d38581de6da8fa8e9d075eae2',
    '0337156ae39767e2a545eae25c2fca74daff516cb7198377d539d593a8cf139bf4': 'edca1ed3b0dc5148744ceffd11179bf3eca458dadc749da8a8233c3c99e02dd8',
    '02e8820489e14dc70e36c74523aa39134e2659a701c796568f29099043b0151d98': '545e929b0ad8779fb8cd764f77d6744284fac59c1a0fd26ef1f9a54bd924dd24',
    '02eb1ce0510aec881bc9be4cbe7b626c3d4e567c30dc5235eac41a581e658790a9': 'ad7b0b53f2e6cea8aca1e8c341ea56146e3fa02afc5ae0afb0c5a1a991c16569',
    '03e3407d198b59525b31db854301eb90fe6e33082b0b0de231923fd7eb80eb2f56': 'd79cdefbd9f0f35ecfa19d033422da43b66d45240ec0cc33cf090fe73d40d7d4',
    '02a3de8166e014736fb2dbdee99da2327be3a4104a8ee1c0428681d7c16d03d099': '5c3650d29a9771aae42028ed380fbd07f1c2e9c75c3876d3992c160d848dca73',
    '0366b63714478665b43a6f4393658a7ce0d4bd12a481ebd650734cf495f967b783': '933fcf86b6f808626f1b82c6a6e5d0a803ea174eb5658f52268ec9047818cf3c',
    '02d3c4881f47edfa33df608dc9e0d0d01b622b535643448eccde379b5c9a7f3a9d': 'dfa8a82132a225a19baa4af1407e7cb8d2812437d7284d7eb5e10bfb601a9ebb',
    '03460546faf7825988f4ca5ef55b18ae513bd1168388294cef54553a103c631562': '252500c66ce6743cde681dcf6e5e839f290a69877be4b3854a8e97445a32c8f1',
    '02b7531feeabbaae75dfc57596b04bcd43c3d2a7fe6a6b9209ba6850e98f098ed3': '37e5a258fdeb2f6272de30267753fde91e52061beb2147a8df0b2a76fb514e2e',
    '0352774c63241e440d8c3eb2a780c693c60375b1d85f562083b017b27460f27d85': '73315bca8603cdcf66634adf4959d4abb4ab2416062a0ec8abb66bc7418780e4',
    '021d770adae4065ef5c60d708f92b80ee98225404872c635466db9083449aa7226': 'fc6edcae4b5f71d30ee266e8b30325416573160d719e13a6b424407060aba00f',
    '03f9f463f4fcb7df9e6c37f5a3f9fc8b382fa2489fe2ea026d22574a3ec665a8ac': '4fec2bfb683272a1dd2f0f920d0aab8da07e886879c30c28c64d436cbf7713c7'
}

/*
import { makeRandomPrivKey, privateKeyToString, publicKeyFromSignatureRsv } from "@stacks/transactions";
const pubs: Record<string, string> = {};

for (let x = 0; x < 50; x++) {
    const priv = makeRandomPrivKey();
    const strPriv = privateKeyToString(priv)

    const messageHash = "0ebdc3317b75839f643387d783535adc360ca01f33c75f7c1e7373adcd675c0b";

    const signature = signMessageHashRsv({
        messageHash: messageHash,
        privateKey: priv
    })

    const pubKey = publicKeyFromSignatureRsv(messageHash, signature)

    pubs[pubKey] = strPriv
}

console.log(pubs)
*/

export const signMessageHashForAddress = (messageHash: string, address: string) => {
    return signMessageHashRsv({
        messageHash: messageHash,
        privateKey: createStacksPrivateKey(
            SIGNER_KEYS[address]
        ),
    }).data;
}

export const signersToCv = (data: Signers) => {
    return tupleCV({
        "signers": listCV([
            ...data.signers.map(x => tupleCV({
                "signer": bufferFromHex(x.signer),
                "weight": uintCV(x.weight)
            }))

        ]),
        "threshold": uintCV(data.threshold),
        "nonce": bufferFromAscii(data.nonce)
    })
}

export const makeProofCV = (data: Signers, messageHashToSign: string) => {
    return tupleCV({
        "signers": signersToCv(data),
        "signatures": listCV([
            ...data.signers.map((x) => bufferFromHex(signMessageHashForAddress(messageHashToSign.replace('0x', ''), x.signer)))
        ])
    });
}

export const getSigners = (start: number, end: number, weight: number, threshold: number, nonce: string): Signers => {
    return {
        signers: Object.keys(SIGNER_KEYS).slice(start, end).map(s => ({
            signer: s,
            weight
        })),
        threshold,
        nonce
    }
}



export const signersRotatedEventsToObj = (rawHex: string): { type: string, epoch: number, signersHash: string, signers: Signers } => {
    const json = cvToJSON(hexToCV(rawHex));

    const signers: Signers = {
        signers: json.value['signers'].value.signers.value.map((s: any) => ({ signer: s.value.signer.value, weight: Number(s.value.weight.value) })),
        threshold: Number(json.value['signers'].value.threshold.value),
        nonce: Buffer.from(bufferFromHex(json.value['signers'].value.nonce.value).buffer).toString('ascii')
    }

    return {
        type: json.value['type'].value,
        epoch: Number(json.value['epoch'].value),
        signersHash: Buffer.from(json.value['signers-hash'].value).toString('ascii'),
        signers: signers
    }
}


